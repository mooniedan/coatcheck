/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root (a stray lockfile lives in the home dir) so Vercel
  // file-tracing resolves against this project, not C:\Users\mooni.
  outputFileTracingRoot: import.meta.dirname,
};

export default nextConfig;
