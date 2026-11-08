import type { NextConfig } from "next";

if (process.env.NODE_ENV === "production") {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  const localCheckBuild = process.env.WANDR_LOCAL_BUILD === "1" && apiBaseUrl === "http://localhost:8787";
  let isHttps = false;
  try { isHttps = new URL(apiBaseUrl ?? "").protocol === "https:"; } catch { /* invalid or missing URL */ }
  if (!localCheckBuild && !isHttps) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be set to a valid HTTPS Worker API URL before building the static site.");
  }
}

const config: NextConfig = { output: "export", trailingSlash: true, images: { unoptimized: true }, devIndicators: false };
export default config;
