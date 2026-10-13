import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Pin the workspace root: a package-lock.json higher up the disk made
  // Turbopack infer the wrong one and warn on every build.
  turbopack: { root: __dirname },
  // /bda and /review were the whole pre-redesign app. They are retired by
  // decision D4; anything still pointing at them lands on the projects list.
  async redirects() {
    return [
      { source: '/bda', destination: '/projects', permanent: false },
      { source: '/review', destination: '/projects', permanent: false },
      // AM11: Extract and Review became one Workspace screen.
      { source: '/projects/:projectId/extract', destination: '/projects/:projectId/workspace', permanent: false },
      { source: '/projects/:projectId/review', destination: '/projects/:projectId/workspace', permanent: false },
    ];
  },
};

export default nextConfig;
