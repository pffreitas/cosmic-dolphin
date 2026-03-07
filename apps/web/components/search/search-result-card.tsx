"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HybridSearchResultItem } from "@cosmic-dolphin/api-client";

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

interface SearchResultCardProps {
  result: HybridSearchResultItem;
}

export function SearchResultCard({ result }: SearchResultCardProps) {
  const { bookmark, matchedChunks } = result;

  const siteName =
    bookmark.metadata?.openGraph?.siteName ||
    extractDomain(bookmark.sourceUrl || "");

  const description =
    bookmark.cosmicBriefSummary ||
    bookmark.metadata?.openGraph?.description ||
    "";

  const snippet =
    matchedChunks && matchedChunks.length > 0
      ? matchedChunks[0].slice(0, 200) + (matchedChunks[0].length > 200 ? "..." : "")
      : description;

  const image = bookmark.metadata?.openGraph?.image;

  return (
    <article className="group py-5 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div className="flex gap-5">
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          {siteName && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{siteName}</span>
              <a
                href={bookmark.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          <Link href={`/bookmarks/${bookmark.id}`} className="block">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {bookmark.title || "Untitled"}
            </h3>
          </Link>

          {snippet && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">
              {snippet}
            </p>
          )}

          {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {bookmark.cosmicTags.slice(0, 4).map((tag) => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="text-xs px-2 py-0 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {image && (
          <Link href={`/bookmarks/${bookmark.id}`} className="shrink-0">
            <div className="w-20 h-20 rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
              <img
                src={image}
                alt=""
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </Link>
        )}
      </div>
    </article>
  );
}
