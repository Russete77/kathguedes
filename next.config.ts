import type { NextConfig } from "next";
import path from "node:path";

// CSP directives — começa em Report-Only para coletar violations.
// Após validar logs do console por alguns dias, mudar para
// "Content-Security-Policy" para enforce.
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.accounts.dev https://*.clerk.com https://*.kathguedes.com.br https://challenges.cloudflare.com https://*.vercel-scripts.com https://www.youtube.com https://*.asaas.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.clerk.accounts.dev https://*.clerk.com https://*.kathguedes.com.br https://clerk-telemetry.com https://*.clerk-telemetry.com https://*.asaas.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.clerk.accounts.dev https://*.kathguedes.com.br https://challenges.cloudflare.com https://www.youtube.com https://www.youtube-nocookie.com https://*.asaas.com",
  "media-src 'self' https: data: blob:",
  "worker-src 'self' blob:",
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
  { key: "Content-Security-Policy", value: cspDirectives },
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
      // Google Drive: links de compartilhamento são normalizados para o CDN
      // lh3.googleusercontent.com (ver src/lib/images.ts). drive.google.com fica
      // como fallback para links já salvos antes da normalização.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "drive.google.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
