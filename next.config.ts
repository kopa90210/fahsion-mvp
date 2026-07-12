import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHostname = supabaseUrl
  ? new URL(supabaseUrl).hostname
  : "svbkadgcpbpnbfzaqvsf.supabase.co";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: supabaseHostname,
        pathname: "/storage/v1/object/public/wardrobe-images/**",
      },
    ],
  },
  // Allow connections from local network for testing on mobile devices
  allowedDevOrigins: ["192.168.1.36", "shaking-heading-erased.ngrok-free.dev", "*.ngrok-free.dev"],
  experimental: {
    serverActions: {
      allowedOrigins: ["*.ngrok-free.dev", "*.ngrok.io", "*.ngrok.app", "localhost:3000"],
    },
  },
};

export default nextConfig;
