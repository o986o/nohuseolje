import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Vercel은 standalone 불필요, Docker 로컬 배포 시에만 사용
  output: process.env.VERCEL ? undefined : 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.BACKEND_URL ?? 'http://localhost:8000/api'}/:path*`,
      },
    ]
  },
}

export default nextConfig
