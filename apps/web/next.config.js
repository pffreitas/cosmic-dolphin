const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  turbopack: {
    // Set the root directory for proper workspace resolution in Docker
    root: path.join(__dirname, "../.."),
  },
};

module.exports = nextConfig;
