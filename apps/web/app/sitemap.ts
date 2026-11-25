import type { MetadataRoute } from "next";
import { homepage } from "@/lib/landing-seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: homepage }];
}
