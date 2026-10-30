import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSessionUser } from '@/lib/auth';
import { getPrisma as __getPrisma } from '@/lib/db';

export const runtime='nodejs';
const updateSchema=z.object({status:z.enum(['ACTIVE','SUSPENDED','REVOKED'])});
export async function PATCH(request:Request,context:{params:Promise<{id:string;licenseId:string}>}) {
 const user=await getSessionUser(); if(!user)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {id,licenseId}=await context.params;
 const parsed=updateSchema.safeParse(await request.json().catch(()=>null)); if(!parsed.success)return NextResponse.json({error:'Invalid license status.'},{status:400});
 const license=await (await __getPrisma()).license.findFirst({where:{id:licenseId,projectId:id,project:{ownerId:user.id}},select:{id:true}});
 if(!license)return NextResponse.json({error:'License not found.'},{status:404});
 const updated=await (await __getPrisma()).license.update({where:{id:licenseId},data:{status:parsed.data.status},select:{id:true,status:true}});
 await (await __getPrisma()).auditLog.create({data:{actorId:user.id,action:'license.status_changed',target:licenseId,metadata:JSON.stringify({status:parsed.data.status})}});
 return NextResponse.json({license:updated});
}
