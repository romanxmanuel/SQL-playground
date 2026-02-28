/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js RSC bundler to never bundle better-sqlite3 (local dev only, native addon)
  serverExternalPackages: ['better-sqlite3'],

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Belt-and-suspenders: also tell webpack to leave better-sqlite3 alone
      config.externals = [...(config.externals || []), 'better-sqlite3']
    }
    return config
  },
}

module.exports = nextConfig
