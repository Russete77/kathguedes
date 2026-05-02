import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/onboarding"],
    },
    sitemap: "https://kathapp.com.br/sitemap.xml",
  };
}
