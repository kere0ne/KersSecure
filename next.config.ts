import type { NextConfig } from 'next';
const config: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) { config.experiments = { ...config.experiments, asyncWebAssembly: true }; }
    return config;
  }, poweredByHeader:false,  experimental:{serverActions:{bodySizeLimit:'5mb'}} };
export default config;