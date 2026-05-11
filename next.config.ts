import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mjyhzufiejcavddcrtal.supabase.co',
      },
    ],
  },
};

export default nextConfig;
