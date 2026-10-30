import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime='nodejs';
const input=z.object({licenseKey:z.string().min(8).max(160),deviceId:z.string().min(8).max(256)});
function hashWith(prefix:string,value:string){const secret=process.env.LICENSE_HASH_SECRET;if(!secret||secret.length<32)throw new Error('License service is not configured.');return createHmac('sha256',secret).update(prefix+':'+value).digest('hex');}
function keyHash(key:string){return hashWith('key',key);}
function deviceHash(device:string){return hashWith('device',device);}
function storage(){if(!process.env.S3_ENDPOINT||!process.env.S3_BUCKET||!process.env.S3_ACCESS_KEY_ID||!process.env.S3_SECRET_ACCESS_KEY)throw new Error('Private script storage is not configured.');return new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});}

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

const hits=new Map<string,number[]>();
function rateLimited(scope:string,max:number,windowMs:number){const now=Date.now();const list=(hits.get(scope)||[]).filter(t=>now-t<windowMs);if(list.length>=max){hits.set(scope,list);return true;}list.push(now);hits.set(scope,list);if(hits.size>5000)hits.clear();return false;}

export async function POST(request:Request,context:{params:Promise<{publicId:string}>}) {
 const {publicId}=await context.params; const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({authorized:false,error:'Invalid authorization request.'},{status:400});
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const ipHash=createHash('sha256').update(ip).digest('hex');
 const keyH=keyHash(parsed.data.licenseKey);
 if(rateLimited('ldr:'+ipHash.slice(0,16)+':'+keyH.slice(0,12),30,60000))return NextResponse.json({authorized:false,error:'Too many requests.',reason:'rate_limited'},{status:429,headers:{'Cache-Control':'no-store'}});
 try{
  const prisma=await __getPrisma();
  const script=await prisma.script.findUnique({where:{publicId},select:{id:true,storageKey:true,code:true,status:true,projectId:true}});
  const license=await prisma.license.findUnique({where:{keyHash:keyH},select:{id:true,status:true,expiresAt:true,maxDevices:true,devices:true,projectId:true,userId:true,banned:true,usedCount:true,execLimit:true}});
  let reason='invalid_license';
  let authOk=false;
  if(script&&license&&script.projectId===license.projectId){
   if(script.status!=='PUBLISHED')reason='script_unpublished';
   else if(license.status!=='ACTIVE')reason='license_inactive';
   else if(license.banned)reason='license_banned';
   else if(license.expiresAt&&license.expiresAt<=new Date())reason='license_expired';
   else{
    if(license.userId){const owner=await prisma.user.findUnique({where:{id:license.userId},select:{suspended:true}});if(owner?.suspended)reason='account_suspended';}
    const maintRow=await prisma.platformSetting.findUnique({where:{key:'maintenance'}});
    if(maintRow){try{const m=JSON.parse(maintRow.value||'{}') as {enabled?:boolean};if(m.enabled)reason='maintenance';}catch{/* ignore malformed */}}
    if(reason==='invalid_license'){
     const fingerprint=deviceHash(parsed.data.deviceId); const devices=JSON.parse(license.devices||'[]') as string[];
     if(devices.includes(fingerprint)||devices.length<license.maxDevices){
      if(license.execLimit!=null&&license.usedCount>=license.execLimit)reason='exec_limit_reached';
      else authOk=true;
     }else reason='device_limit';
    }
   }
  }else if(license&&license.status!=='ACTIVE')reason='license_inactive';else if(license?.expiresAt&&license.expiresAt<=new Date())reason='license_expired';
  if(authOk&&script){
   let source: string|null=null;
   const hasS3=!!(process.env.S3_ENDPOINT&&process.env.S3_BUCKET&&process.env.S3_ACCESS_KEY_ID&&process.env.S3_SECRET_ACCESS_KEY);
   if(script.storageKey&&hasS3){
    try{
     const result=await storage().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:script.storageKey}));
     const body=await result.Body?.transformToString(); if(typeof body==='string')source=body; else source=script.code??null;
    }catch(err){console.error('S3 read failed:',err);source=script.code??null;}
   }else if(script.code){source=script.code;}
   if(source!==null){
    const fingerprint=deviceHash(parsed.data.deviceId);
    const devices=JSON.parse(license!.devices||'[]') as string[];
    await prisma.$transaction([
     prisma.authLog.create({data:{scriptId:script.id,licenseId:license!.id,ipHash,outcome:'authorized'}}),
     prisma.executionLog.create({data:{scriptId:script.id,licenseId:license!.id,ipHash,outcome:'authorized'}}),
     prisma.license.update({where:{id:license!.id},data:{usedCount:{increment:1},...(devices.includes(fingerprint)?{}:{devices:JSON.stringify([...devices,fingerprint])}),deviceHash:fingerprint}}),
    ]);
    return new NextResponse(source,{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'}});
   }
   authOk=false;
  }
  if(!authOk)await prisma.authLog.create({data:{scriptId:script?.id,licenseId:license?.id,ipHash,outcome:'denied',detail:reason}});
  return NextResponse.json({authorized:false,error:'Authorization denied.',reason},{status:403,headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('Loader authorization failed:',error);return NextResponse.json({authorized:false,error:'Authorization service unavailable.'},{status:503});}
}
