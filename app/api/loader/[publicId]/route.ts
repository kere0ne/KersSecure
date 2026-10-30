import { NextResponse } from 'next/server';
import { createHash, createHmac } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { z } from 'zod';
import { prisma } from '@/lib/db';

export const runtime='nodejs';
const input=z.object({licenseKey:z.string().min(8).max(160),deviceId:z.string().min(8).max(256)});
function keyHash(key:string){const secret=process.env.LICENSE_HASH_SECRET;if(!secret||secret.length<32)throw new Error('License service is not configured.');return createHmac('sha256',secret).update(key).digest('hex');}
function deviceHash(device:string){const secret=process.env.LICENSE_HASH_SECRET;if(!secret||secret.length<32)throw new Error('License service is not configured.');return createHmac('sha256',secret).update('device:'+device).digest('hex');}
function storage(){if(!process.env.S3_ENDPOINT||!process.env.S3_BUCKET||!process.env.S3_ACCESS_KEY_ID||!process.env.S3_SECRET_ACCESS_KEY)throw new Error('Private script storage is not configured.');return new S3Client({region:process.env.S3_REGION||'auto',endpoint:process.env.S3_ENDPOINT,forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY}});}
export async function POST(request:Request,context:{params:Promise<{publicId:string}>}) {
 const {publicId}=await context.params; const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return NextResponse.json({authorized:false,error:'Invalid authorization request.'},{status:400});
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
 const ipHash=createHash('sha256').update(ip).digest('hex');
 try{
  const script=await prisma.script.findUnique({where:{publicId},select:{id:true,storageKey:true,status:true,projectId:true}});
  const license=await prisma.license.findUnique({where:{keyHash:keyHash(parsed.data.licenseKey)},select:{id:true,status:true,expiresAt:true,maxDevices:true,devices:true,projectId:true,robloxUserId:true}});
  let reason='invalid_license';
  if(script&&license&&script.projectId===license.projectId&&script.status==='PUBLISHED'&&license.status==='ACTIVE'&&(!license.expiresAt||license.expiresAt>new Date())){
   const fingerprint=deviceHash(parsed.data.deviceId); const devices=license.devices;
   if(devices.includes(fingerprint)||devices.length<license.maxDevices){
    if(!devices.includes(fingerprint))await prisma.license.update({where:{id:license.id},data:{devices:{push:fingerprint},deviceHash:fingerprint}});
    if(script.storageKey){
     const result=await storage().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:script.storageKey}));
     const source=await result.Body?.transformToString();
     if(typeof source==='string'){
      await prisma.$transaction([prisma.authLog.create({data:{scriptId:script.id,licenseId:license.id,ipHash,outcome:'authorized'}}),prisma.executionLog.create({data:{scriptId:script.id,licenseId:license.id,ipHash,outcome:'authorized'}})]);
      return new NextResponse(source,{status:200,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate','X-Content-Type-Options':'nosniff'}});
     }
     reason='script_unavailable';
    }else reason='script_unavailable';
   }else reason='device_limit';
  }else if(license?.status!=='ACTIVE')reason='license_inactive';else if(license?.expiresAt&&license.expiresAt<=new Date())reason='license_expired';else if(script?.status!=='PUBLISHED')reason='script_unpublished';
  await prisma.authLog.create({data:{scriptId:script?.id,licenseId:license?.id,ipHash,outcome:'denied',detail:reason}});
  return NextResponse.json({authorized:false,error:'Authorization denied.',reason},{status:403,headers:{'Cache-Control':'no-store'}});
 }catch(error){console.error('Loader authorization failed:',error);return NextResponse.json({authorized:false,error:'Authorization service unavailable.'},{status:503});}
}
