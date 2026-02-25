import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async rewrites() {
    return [
      // Serve Contento index.html for /contento and /contento/
      { source: "/contento", destination: "/contento/index.html" },
      { source: "/contento/", destination: "/contento/index.html" },
    ];
  },
};

export default nextConfig;
