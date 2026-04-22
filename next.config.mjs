/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/swiftlatex/texlive/[engine]/[...slug]": [
      "./texlive/local/pdftex/**/*",
    ],
  },
};

export default nextConfig;
