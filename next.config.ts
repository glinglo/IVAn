import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-lib"],
  agentRules: false,
  async redirects() {
    return [
      { source: "/trimestre/:anio/:t", destination: "/impuestos/:anio/:t", permanent: false },
      { source: "/anual/:anio", destination: "/impuestos/:anio/390", permanent: false },
    ];
  },
};

export default nextConfig;
