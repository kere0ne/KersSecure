import { NextResponse } from 'next/server';
import { createHash, randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSessionUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const runtime = 'nodejs';
const MAX_BYTES = 2 * 1024 * 1024;
const allowed = new Set(['.lua', '.luau', '.txt']);
function storageClient() {
  const endpoint = process.env.S3_ENDPOINT; const region = process.env.S3_REGION || 'auto';
  if (!endpoint || !process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) throw new Error('Private script storage is not configured.');
  return new S3Client({ region, endpoint, forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY } });
}
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params; const project = await prisma.project.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  const form = await request.formData(); const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a script file.' }, { status: 400 });
  const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120); const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  if (!allowed.has(ext)) return NextResponse.json({ error: 'Only .lua, .luau and .txt files are accepted.' }, { status: 400 });
  if (file.size < 1 || file.size > MAX_BYTES) return NextResponse.json({ error: 'File must be between 1 byte and 2 MB.' }, { status: 400 });
  const bytes = Buffer.from(await file.arrayBuffer()); const checksum = createHash('sha256').update(bytes).digest('hex');
  const storageKey = 'projects/' + project.id + '/scripts/' + randomUUID() + '/' + filename;
  try {
    const client = storageClient();
    await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: storageKey, Body: bytes, ContentType: 'text/plain; charset=utf-8', ServerSideEncryption: 'AES256', Metadata: { checksum } }));
    const script = await prisma.script.create({ data: { name: filename.replace(/\.(lua|luau|txt)$/i, ''), filename, storageKey, projectId: project.id, versions: { create: { storageKey, version: 1, checksum } } } });
    await prisma.auditLog.create({ data: { actorId: user.id, action: 'script.uploaded', target: script.id } });
    return NextResponse.json({ script: { id: script.id, name: script.name, version: script.version } }, { status: 201 });
  } catch (error) {
    console.error('Script upload failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Script upload failed.' }, { status: 500 });
  }
}
