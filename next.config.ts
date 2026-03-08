import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output only when building inside Docker.
  // Vercel's build system handles its own packaging — standalone
  // output is only needed for the self-hosted container image.
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
};

export default nextConfig;
