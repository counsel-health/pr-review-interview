/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "sqlite3", "sqlite"],
};

export default nextConfig;
