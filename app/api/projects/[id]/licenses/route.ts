import { NextResponse } from 'next/server';
import { createHmac, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime = 'nodejs';
const schema = z.object({ maxDevices: z.number().int().min(1).max(20).default(1), expiresInDays: z.number().int().min(1).max(3650).nullable().default(null), robloxUserId: z.string().trim().max(32).optional() });
function hashKey(key: string) { const secret = process.env.LICENSE_HASH_SECRET; if (!secret || secret.length < 32) throw new Error('LICENSE_HASH_SECRET must contain at least 32 characters.'); return createHmac('sha256', secret).update(key).digest('hex'); }
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
 const user=await getSessionUser(); if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id}=await context.params; const project=await (await __getPrisma()).project.findFirst({where:{id,ownerId:user.id},select:{id:true}});
 if(!project)return NextResponse.json({error:'Project not found'},{status:404});
 const licenses=await (await __getPrisma()).license.findMany({where:{projectId:id},orderBy:{createdAt:'desc'},select:{id:true,keyPrefix:true,status:true,maxDevices:true,devices:true,robloxUserId:true,expiresAt:true,createdAt:true}}).then(rows=>rows.map(l=>({...l,devices:JSON.parse(l.devices||'[]') as string[]})));
 return NextResponse.json({licenses},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request,context:{params:Promise<{id:string}>}) {
 const user=await getSessionUser(); if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id}=await context.params; const project=await (await __getPrisma()).project.findFirst({where:{id,ownerId:user.id},select:{id:true}});
 if(!project)return NextResponse.json({error:'Project not found'},{status:404});
 const parsed=schema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Invalid license settings.'},{status:400});
 try {
  const key='KSEC-'+randomBytes(24).toString('base64url').toUpperCase();
  const license=await (await __getPrisma()).license.create({data:{keyHash:hashKey(key),keyPrefix:key.slice(0,9),maxDevices:parsed.data.maxDevices,robloxUserId:parsed.data.robloxUserId||null,expiresAt:parsed.data.expiresInDays?new Date(Date.now()+parsed.data.expiresInDays*86400000):null,projectId:id}});
  await (await __getPrisma()).auditLog.create({data:{actorId:user.id,action:'license.created',target:license.id}});
  return NextResponse.json({license:{id:license.id,key,keyPrefix:license.keyPrefix,expiresAt:license.expiresAt}},{status:201,headers:{'Cache-Control':'no-store'}});
 } catch(error) { console.error('License creation failed:',error); return NextResponse.json({error:error instanceof Error?error.message:'Could not create license.'},{status:500}); }
}
