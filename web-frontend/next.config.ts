import type { NextConfig } from "next";

const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  // Send browser calls to "/api/..." over to the NestJS backend.
  // This keeps everything on one origin (the ngrok URL), so the public
  // link works without hard-coding the backend address anywhere.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:18320/api/:path*",
      },
    ];
  },
};

export default nextConfig;
