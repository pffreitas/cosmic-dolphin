"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ImageIcon, ZoomInIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface GalleryImage {
  url: string;
  title: string;
  description: string;
}

interface BookmarkImageGalleryProps {
  images: GalleryImage[];
}

function DotIndicators({
  count,
  current,
  onDotClick,
  className,
}: {
  count: number;
  current: number;
  onDotClick?: (index: number) => void;
  className?: string;
}) {
  if (count <= 1) return null;

  const maxVisible = 7;
  const showCompact = count > maxVisible;

  return (
    <div
      className={cn("flex items-center justify-center gap-1.5", className)}
      role="tablist"
      aria-label="Image navigation"
    >
      {Array.from({ length: count }).map((_, i) => {
        if (showCompact) {
          const distance = Math.abs(i - current);
          if (distance > 2 && i !== 0 && i !== count - 1) return null;
          if (distance === 2 && i !== 0 && i !== count - 1) {
            return (
              <span
                key={i}
                className="size-1 rounded-full bg-muted-foreground/30"
                aria-hidden="true"
              />
            );
          }
        }

        return (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            aria-label={`Go to image ${i + 1}`}
            onClick={() => onDotClick?.(i)}
            className={cn(
              "rounded-full transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              i === current
                ? "size-2.5 bg-foreground"
                : "size-2 bg-muted-foreground/40 hover:bg-muted-foreground/60"
            )}
          />
        );
      })}
    </div>
  );
}

function SlideCounter({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}) {
  if (total <= 1) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm",
        className
      )}
      aria-live="polite"
      aria-atomic="true"
    >
      {current + 1} / {total}
    </span>
  );
}

function GalleryImage({
  image,
  loading = "lazy",
  className,
  imgClassName,
  onClick,
}: {
  image: GalleryImage;
  loading?: "lazy" | "eager";
  className?: string;
  imgClassName?: string;
  onClick?: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  if (hasError) return null;

  return (
    <div className={cn("relative group", className)}>
      {!isLoaded && <Skeleton className="absolute inset-0 rounded-lg" />}
      <img
        src={image.url}
        alt={image.title || image.description || "Image"}
        loading={loading}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={cn(
          "transition-opacity duration-200",
          isLoaded ? "opacity-100" : "opacity-0",
          imgClassName
        )}
      />
      {onClick && isLoaded && (
        <button
          onClick={onClick}
          aria-label={`View ${image.title || "image"} full size`}
          className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset rounded-lg"
        >
          <span className="rounded-full bg-black/50 p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-sm">
            <ZoomInIcon className="size-4 text-white" aria-hidden="true" />
          </span>
        </button>
      )}
    </div>
  );
}

function ThumbnailStrip({
  images,
  current,
  onSelect,
}: {
  images: GalleryImage[];
  current: number;
  onSelect: (index: number) => void;
}) {
  if (images.length <= 1) return null;

  return (
    <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none" role="tablist" aria-label="Image thumbnails">
      {images.map((image, index) => (
        <button
          key={index}
          role="tab"
          aria-selected={index === current}
          aria-label={`View image ${index + 1}: ${image.title || ""}`}
          onClick={() => onSelect(index)}
          className={cn(
            "relative shrink-0 size-14 sm:size-16 rounded-md overflow-hidden transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            index === current
              ? "ring-2 ring-foreground opacity-100"
              : "opacity-50 hover:opacity-80"
          )}
        >
          <img
            src={image.url}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  );
}

export function BookmarkImageGallery({ images }: BookmarkImageGalleryProps) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [inlineApi, setInlineApi] = useState<CarouselApi>();
  const [lightboxApi, setLightboxApi] = useState<CarouselApi>();
  const [currentInlineSlide, setCurrentInlineSlide] = useState(0);
  const [currentLightboxSlide, setCurrentLightboxSlide] = useState(0);

  const imageCount = images.length;

  const onInlineSelect = useCallback(() => {
    if (!inlineApi) return;
    setCurrentInlineSlide(inlineApi.selectedScrollSnap());
  }, [inlineApi]);

  const onLightboxSelect = useCallback(() => {
    if (!lightboxApi) return;
    setCurrentLightboxSlide(lightboxApi.selectedScrollSnap());
  }, [lightboxApi]);

  useEffect(() => {
    if (!inlineApi) return;
    onInlineSelect();
    inlineApi.on("select", onInlineSelect);
    return () => {
      inlineApi.off("select", onInlineSelect);
    };
  }, [inlineApi, onInlineSelect]);

  useEffect(() => {
    if (!lightboxApi) return;
    onLightboxSelect();
    lightboxApi.on("select", onLightboxSelect);
    return () => {
      lightboxApi.off("select", onLightboxSelect);
    };
  }, [lightboxApi, onLightboxSelect]);

  const openLightbox = useCallback(
    (index?: number) => {
      setIsLightboxOpen(true);
      if (index !== undefined) {
        setTimeout(() => lightboxApi?.scrollTo(index, true), 50);
      }
    },
    [lightboxApi]
  );

  const goToInlineSlide = useCallback(
    (index: number) => {
      inlineApi?.scrollTo(index);
    },
    [inlineApi]
  );

  const goToLightboxSlide = useCallback(
    (index: number) => {
      lightboxApi?.scrollTo(index);
    },
    [lightboxApi]
  );

  if (imageCount === 0) return null;

  return (
    <section className="space-y-3" aria-label="Image gallery">
      {/* Gallery header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => openLightbox(currentInlineSlide)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 cursor-pointer"
        >
          <ImageIcon className="size-4" aria-hidden="true" />
          <span>
            {imageCount} {imageCount === 1 ? "image" : "images"}
          </span>
        </button>

        {imageCount > 1 && (
          <SlideCounter current={currentInlineSlide} total={imageCount} />
        )}
      </div>

      {/* Inline carousel */}
      <div className="relative group/carousel">
        <Carousel
          className="w-full"
          setApi={setInlineApi}
          opts={{ loop: imageCount > 1 }}
        >
          <CarouselContent className="-ml-3">
            {images.map((image, index) => (
              <CarouselItem key={index} className="pl-3 basis-full">
                <GalleryImage
                  image={image}
                  loading={index === 0 ? "eager" : "lazy"}
                  imgClassName="w-full h-48 sm:h-64 md:h-72 object-contain rounded-lg"
                  onClick={() => openLightbox(index)}
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {imageCount > 1 && (
            <>
              <CarouselPrevious className="hidden sm:flex -left-4 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md cursor-pointer" />
              <CarouselNext className="hidden sm:flex -right-4 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-200 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md cursor-pointer" />
            </>
          )}
        </Carousel>

        {/* Caption for current slide */}
        {images[currentInlineSlide] &&
          (images[currentInlineSlide].title ||
            images[currentInlineSlide].description) && (
            <div className="mt-2 px-1">
              {images[currentInlineSlide].title && (
                <p className="text-sm font-medium text-foreground leading-tight">
                  {images[currentInlineSlide].title}
                </p>
              )}
              {images[currentInlineSlide].description && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">
                  {images[currentInlineSlide].description}
                </p>
              )}
            </div>
          )}

        {/* Dot indicators */}
        <DotIndicators
          count={imageCount}
          current={currentInlineSlide}
          onDotClick={goToInlineSlide}
          className="mt-3"
        />
      </div>

      {/* Thumbnail strip */}
      <ThumbnailStrip
        images={images}
        current={currentInlineSlide}
        onSelect={goToInlineSlide}
      />

      {/* Lightbox dialog */}
      <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
        <DialogContent className="w-[95vw] max-w-5xl max-h-[95vh] overflow-hidden p-0 gap-0 border-none bg-background/95 backdrop-blur-md [&>button]:z-50">
          <DialogHeader className="px-6 pt-5 pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-medium">
                {images[currentLightboxSlide]?.title || "Image Gallery"}
              </DialogTitle>
              <SlideCounter
                current={currentLightboxSlide}
                total={imageCount}
              />
            </div>
          </DialogHeader>

          <div className="relative flex flex-col flex-1 overflow-hidden px-4 pb-4">
            <Carousel
              className="w-full flex-1"
              setApi={setLightboxApi}
              opts={{ loop: imageCount > 1, startIndex: currentInlineSlide }}
            >
              <CarouselContent>
                {images.map((image, index) => (
                  <CarouselItem key={index}>
                    <div className="flex flex-col items-center gap-3 px-2">
                      <GalleryImage
                        image={image}
                        loading={
                          Math.abs(index - currentLightboxSlide) <= 1
                            ? "eager"
                            : "lazy"
                        }
                        className="w-full flex justify-center"
                        imgClassName="max-h-[65vh] sm:max-h-[70vh] w-auto max-w-full object-contain rounded-md"
                      />

                      {(image.title || image.description) && (
                        <div className="text-center max-w-2xl mx-auto space-y-1 px-2">
                          {image.title && (
                            <h4 className="text-sm font-medium text-foreground">
                              {image.title}
                            </h4>
                          )}
                          {image.description && (
                            <p className="text-xs text-muted-foreground line-clamp-3">
                              {image.description}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>

              {imageCount > 1 && (
                <>
                  <CarouselPrevious className="hidden sm:flex -left-2 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md cursor-pointer" />
                  <CarouselNext className="hidden sm:flex -right-2 bg-background/80 backdrop-blur-sm hover:bg-background shadow-md cursor-pointer" />
                </>
              )}
            </Carousel>

            {/* Lightbox dot indicators */}
            <DotIndicators
              count={imageCount}
              current={currentLightboxSlide}
              onDotClick={goToLightboxSlide}
              className="mt-4"
            />

            {/* Lightbox thumbnail strip */}
            <div className="mt-3 flex justify-center">
              <ThumbnailStrip
                images={images}
                current={currentLightboxSlide}
                onSelect={goToLightboxSlide}
              />
            </div>

            {/* Keyboard hint */}
            {imageCount > 1 && (
              <p className="hidden sm:block text-center text-[11px] text-muted-foreground/60 mt-2">
                Use arrow keys to navigate
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
