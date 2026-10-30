import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime='nodejs';
const input=z.object({licenseKey:z.string().min(8).max(160),deviceId:z.string().min(8).max(256)});
function keyHash(key:string){const secret=process.env.LICENSE_HASH_SECRET;if(!secret||secret.length<32)throw new Error('License service is not configured.');return createHmac('sha256',secret).update(key).digest('hex');}
function deviceHash(device:string){const secret=process.env.LICENSE_HASH_SECRET;if(!secret||secret.length<32)throw new Error('License service is not configured.');return createHmac('sha256',secret).update('device:'+device).digest('hex');}
function storage(){if(!process.env.S3_ENDPOINT||!process.env.S3_BUCKET||!process.env.S3_ACCESS_KEY_ID||!process.env.S3_SECRET_ACCESS_KEY)throw new Error('Private script storage is not configured.');return new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});}

// ── Luarmor-style bootstrap loader (GET) ──
const loaderTemplate = (endpoint:string, key:string) => `--========================================================--
--                  KERS SECURE LOADER                    --
--          https://kerssecure.itskers0ne.workers.dev     --
--========================================================--

local SCRIPT_KEY = "${key}"
local ENDPOINT = "${endpoint}"

if SCRIPT_KEY == "" then
	warn("[KERS] No license key. Run the loader URL with ?key=YOUR_KEY")
	return
end

print("[KERS] Checking whitelist...")

local hwid = "unknown"
pcall(function()
	if type(gethwid) == "function" then hwid = tostring(gethwid())
	elseif type(identifyexecutor) == "function" then hwid = tostring(identifyexecutor()) end
end)
if hwid == "unknown" then
	pcall(function() hwid = tostring(game:GetService("Players").LocalPlayer.UserId) end)
end

local HttpService = game:GetService("HttpService")
local ok, response = pcall(function()
	return HttpService:RequestAsync({
		Url = ENDPOINT,
		Method = "POST",
		Headers = { ["Content-Type"] = "application/json" },
		Body = HttpService:JSONEncode({ licenseKey = SCRIPT_KEY, deviceId = hwid })
	})
end)

if not ok then
	warn("[KERS] Connection error. Please try again.")
	return
end

if not response.Success then
	local reason = "denied"
	pcall(function()
		local data = HttpService:JSONDecode(response.Body)
		reason = data.reason or reason
	end)
	warn("[KERS] Not whitelisted. (" .. tostring(reason) .. ")")
	return
end

if not response.Body or #response.Body == 0 then
	warn("[KERS] Empty response. Please try again.")
	return
end

print("[KERS] Whitelisted! Loading script...")

local fn, err = loadstring(response.Body)
if not fn then
	warn("[KERS] Script failed to load.")
	return
end

local okRun, runErr = pcall(fn)
if not okRun then
	warn("[KERS] Script error: " .. tostring(runErr))
end
`;

export async function GET(request:Request,context:{params:Promise<{publicId:string}>}) {
  const {publicId}=await context.params;
  const url=new URL(request.url);
  const key=(url.searchParams.get('key')||'').replace(/[^A-Za-z0-9_-]/g,'').slice(0,64);
  const base=(process.env.APP_URL&&!process.env.APP_URL.startsWith('http://localhost')?process.env.APP_URL:url.origin).replace(/\/+$/,'');
  const endpoint=`${base}/api/loader/${encodeURIComponent(publicId)}`;
  return new NextResponse(loaderTemplate(endpoint,key),{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'}});
}

export async function POST(request:Request,context:{params:Promise<{publicId:string}>}) {
 const {publicId}=await context.params; const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({authorized:false,error:'Invalid authorization request.'},{status:400});
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const ipHash=createHash('sha256').update(ip).digest('hex');
 try{
  const script=await (await __getPrisma()).script.findUnique({where:{publicId},select:{id:true,storageKey:true,status:true,projectId:true}});
  const license=await (await __getPrisma()).license.findUnique({where:{keyHash:keyHash(parsed.data.licenseKey)},select:{id:true,status:true,expiresAt:true,maxDevices:true,devices:true,projectId:true,robloxUserId:true}});
  let reason='invalid_license';
  if(script&&license&&script.projectId===license.projectId&&script.status==='PUBLISHED'&&license.status==='ACTIVE'&&(!license.expiresAt||license.expiresAt>new Date())){
   const fingerprint=deviceHash(parsed.data.deviceId); const devices=JSON.parse(license.devices||'[]') as string[];
   if(devices.includes(fingerprint)||devices.length<license.maxDevices){
    if(!devices.includes(fingerprint))await (await __getPrisma()).license.update({where:{id:license.id},data:{devices:JSON.stringify([...devices,fingerprint]),deviceHash:fingerprint}});
    if(script.storageKey){
     const result=await storage().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:script.storageKey}));
     const source=await result.Body?.transformToString();
     if(typeof source==='string'){
      await (await __getPrisma()).$transaction([(await __getPrisma()).authLog.create({data:{scriptId:script.id,licenseId:license.id,ipHash,outcome:'authorized'}}),(await __getPrisma()).executionLog.create({data:{scriptId:script.id,licenseId:license.id,ipHash,outcome:'authorized'}})]);
      return new NextResponse(source,{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'}});
     }
     reason='script_unavailable';
    }else reason='script_unavailable';
   }else reason='device_limit';
  }else if(license?.status!=='ACTIVE')reason='license_inactive';else if(license?.expiresAt&&license.expiresAt<=new Date())reason='license_expired';else if(script?.status!=='PUBLISHED')reason='script_unpublished';
  await (await __getPrisma()).authLog.create({data:{scriptId:script?.id,licenseId:license?.id,ipHash,outcome:'denied',detail:reason}});
  return NextResponse.json({authorized:false,error:'Authorization denied.',reason},{status:403,headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('Loader authorization failed:',error);return NextResponse.json({authorized:false,error:'Authorization service unavailable.'},{status:503});}
}
