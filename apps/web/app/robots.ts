import type { MetadataRoute } from "next";
import { homepage } from "@/lib/landing-seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/auth/", "/dev/", "/my/", "/protected/"],
    },
    sitemap: new URL("sitemap.xml", homepage).href,
  };
}
