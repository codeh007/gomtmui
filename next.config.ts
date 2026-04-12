import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";

const mode = process.env.BUILD_MODE ?? "standalone";
const distDir = process.env.NEXT_BUILD_OUTPUT ?? ".next";
const isNextDev = process.argv.slice(2).includes("dev");

const nextConfig: NextConfig = {
  distDir,
  output: mode === "standalone" ? "standalone" : undefined,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        child_process: false,
        fs: false,
        net: false,
        os: false,
        path: false,
        tls: false,
      };
    }

    return config;
  },
  serverExternalPackages: ["cloudflare:email"],
};

export default nextConfig;

if (isNextDev) {
  initOpenNextCloudflareForDev({});
}
