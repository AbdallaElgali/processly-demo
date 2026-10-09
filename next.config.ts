import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // /bda and /review were the whole pre-redesign app. They are retired by
  // decision D4; anything still pointing at them lands on the projects list.
  async redirects() {
    return [
      { source: '/bda', destination: '/projects', permanent: false },
      { source: '/review', destination: '/projects', permanent: false },
    ];
  },
};

export default nextConfig;
