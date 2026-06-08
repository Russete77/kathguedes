import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/onboarding"],
    },
    sitemap: "https://www.kathguedes.com.br/sitemap.xml",
  };
}
