import type { NextConfig } from "next";
import path from "path";

const supabaseHostname = process.env.SUPABASE_URL
  ? new URL(process.env.SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/generate": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    qualities: [75, 90],
    remotePatterns: supabaseHostname
      ? [
          {
            protocol: "https",
            hostname: supabaseHostname,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
