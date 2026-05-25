import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";

// CSP directives — começa em Report-Only para coletar violations.
// Após validar logs do Sentry/console por alguns dias, mudar para
// "Content-Security-Policy" para enforce.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://challenges.cloudflare.com https://*.vercel-scripts.com https://www.youtube.com https://*.asaas.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://*.clerk.com https://*.asaas.com https://*.sentry.io https://*.ingest.sentry.io https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.clerk.accounts.dev https://www.youtube.com https://*.asaas.com",
  "media-src 'self' https: data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy-Report-Only", value: cspDirectives },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: false },
  outputFileTracingRoot: path.resolve(__dirname),
  serverExternalPackages: ["web-push", "ioredis"],
  images: {
    // SEM wildcard "https://**" — proxy aberto via /_next/image é vetor SSRF.
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "**.magazord.com.br" },
      { protocol: "https", hostname: "**.mlstatic.com" },
      { protocol: "https", hostname: "m.media-amazon.com" },
      { protocol: "https", hostname: "images-na.ssl-images-amazon.com" },
      { protocol: "https", hostname: "cf.shopee.com.br" },
      { protocol: "https", hostname: "down-br.img.susercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  disableLogger: true,
  tunnelRoute: "/monitoring",
});
