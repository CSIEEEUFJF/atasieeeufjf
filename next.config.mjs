/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["better-sqlite3"],
  outputFileTracingIncludes: {
    "/api/swiftlatex/texlive/[engine]/[...slug]": [
      "./texlive/local/pdftex/**/*",
    ],
  },
};

export default nextConfig;
