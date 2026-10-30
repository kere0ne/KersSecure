import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader:false, serverExternalPackages:['@prisma/client'], experimental:{serverActions:{bodySizeLimit:'5mb'}} };
export default config;