/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    AMPLIFY_DATA_GhlIntegration_TABLE_NAME: process.env.AMPLIFY_DATA_GhlIntegration_TABLE_NAME,
  }
}

module.exports = nextConfig
