"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface OpenGraphImageProps {
  imageUrl: string;
  title: string;
  description: string;
  onClick?: () => void;
}

export default function OpenGraphImage({
  imageUrl,
  title,
  description,
  onClick,
}: OpenGraphImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (!imageUrl || hasError) {
    return null;
  }

  const isClickable = !!onClick;

  return (
    <figure
      className="group relative max-w-full overflow-hidden rounded-lg border bg-muted/30"
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `View ${title || "image"} in gallery` : undefined}
      onClick={onClick}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="relative">
        {!isLoaded && (
          <Skeleton className="w-full h-48 md:h-60 rounded-none" />
        )}
        <img
          src={imageUrl}
          alt={title || description || "Image"}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
          className={`w-full h-48 md:h-60 object-contain transition-opacity duration-200 ${
            isLoaded ? "opacity-100" : "opacity-0 absolute inset-0"
          } ${isClickable ? "cursor-pointer group-hover:opacity-90" : ""}`}
        />
      </div>

      {(title || description) && (
        <figcaption className="px-3 py-2.5 space-y-0.5">
          {title && (
            <h4 className="text-sm font-medium text-foreground leading-tight line-clamp-2">
              {title}
            </h4>
          )}
          {description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {description}
            </p>
          )}
        </figcaption>
      )}
    </figure>
  );
}
