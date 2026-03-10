"use client";

import { Bookmark } from "@cosmic-dolphin/api-client";
import CosmicMarkdown from "@/components/markdown/CosmicMarkdown";
import OpenGraphWebpage from "@/components/opengraph/OpenGraphWebpage";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselItem,
  CarouselNext,
  CarouselContent,
  CarouselPrevious,
} from "@/components/ui/carousel";
import OpenGraphImage from "@/components/opengraph/OpenGraphImage";
import Link from "next/link";

export function SharedBookmarkView({
  bookmark,
  sharedByUserName,
}: {
  bookmark: Bookmark;
  sharedByUserName?: string;
}) {
  return (
    <div className="flex flex-col gap-8 max-w-screen-md mx-auto py-8 px-4">
      {sharedByUserName && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>Shared by {sharedByUserName}</span>
        </div>
      )}

      {bookmark.title && (
        <h1 className="text-3xl font-bold text-gray-900">{bookmark.title}</h1>
      )}

      {bookmark.metadata?.openGraph && (
        <OpenGraphWebpage
          title={bookmark.metadata.openGraph.title || ""}
          description={bookmark.metadata.openGraph.description || ""}
          image={bookmark.metadata.openGraph.image || ""}
          url={bookmark.metadata.openGraph.url || ""}
        />
      )}

      {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
        <div className="flex flex-row flex-wrap gap-2">
          {bookmark.cosmicTags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {bookmark.cosmicSummary && (
        <div className="relative">
          <CosmicMarkdown body={bookmark.cosmicSummary} />
        </div>
      )}

      {bookmark.cosmicImages && bookmark.cosmicImages.length > 0 && (
        <div className="w-full">
          <Carousel className="w-full max-w-full">
            <CarouselContent className="-ml-1">
              {bookmark.cosmicImages.map((image, index) => (
                <CarouselItem key={index} className="pl-1 basis-full">
                  <OpenGraphImage
                    imageUrl={image.url}
                    title={image.title}
                    description={image.description}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>
        </div>
      )}

      <div className="border-t pt-6 mt-4 text-center">
        <p className="text-sm text-gray-500 mb-3">
          Saved and summarized with Cosmic Dolphin
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <span className="text-lg">🐬</span>
          Learn more about Cosmic Dolphin
        </Link>
      </div>
    </div>
  );
}
