/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@1click/ui"],
  turbopack: {
    root: ".",
  },
}

export default nextConfig
