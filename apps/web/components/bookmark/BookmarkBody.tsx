"use client";
import { useEffect, useState } from "react";
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { setCurrentBookmarkFromApi } from "@/lib/store/slices/realtimeSlice";
import { Bookmark } from "@cosmic-dolphin/api-client";
import CosmicMarkdown from "@/components/markdown/CosmicMarkdown";
import OpenGraphWebpage from "@/components/opengraph/OpenGraphWebpage";
import CosmicLoading from "@/components/loading/CosmicLoading";
import { ConnectionStatus } from "@/components/realtime/ConnectionStatus";
import { Card, CardContent } from "@/components/ui/card";
import {
  RefreshCcwIcon,
  ShareIcon,
  ThumbsUpIcon,
  AlertCircleIcon,
  Loader2Icon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Separator } from "@/components/ui/separator";
import { useSessionByBookmark } from "@/lib/store/realtimeSelectors";
import { Badge } from "@/components/ui/badge";
import {
  Carousel,
  CarouselItem,
  CarouselNext,
  CarouselContent,
  CarouselPrevious,
} from "@/components/ui/carousel";
import OpenGraphImage from "@/components/opengraph/OpenGraphImage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBookmarkRealtime } from "@/lib/hooks/useBookmarkRealtime";

interface ProcessingStatusProps {
  status: string;
  error?: string;
}

const ProcessingStatusBanner = ({ status, error }: ProcessingStatusProps) => {
  if (status === "idle" || status === "completed") {
    return null;
  }

  if (status === "failed") {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="px-5 py-3">
          <div className="flex flex-row gap-3 items-center">
            <AlertCircleIcon className="size-5 text-red-500" />
            <div className="flex flex-col">
              <span className="text-sm font-medium text-red-700">
                Processing failed
              </span>
              {error && (
                <span className="text-xs text-red-600">{error}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Processing status
  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="px-5 py-3">
        <div className="flex flex-row gap-3 items-center">
          <Loader2Icon className="size-5 text-blue-500 animate-spin" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-blue-700">
              Processing bookmark...
            </span>
            <span className="text-xs text-blue-600">
              AI is analyzing and summarizing the content
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const BookmarkBody = (props: { bookmark: Bookmark }) => {
  const dispatch = useAppDispatch();
  const { currentBookmark } = useAppSelector((state) => state.realtime);
  const [isImageGaleryDialogOpen, setIsImageGaleryDialogOpen] = useState(false);

  // Subscribe to realtime updates for this specific bookmark
  const { isConnected, isProcessing } = useBookmarkRealtime(props.bookmark.id, {
    enabled: true,
  });

  const activeSession = useSessionByBookmark(props.bookmark.id);
  console.log("session for bookmark", activeSession);
  console.log("realtime connection:", { isConnected, isProcessing });

  useEffect(() => {
    if (
      props.bookmark &&
      (!currentBookmark || currentBookmark.id !== props.bookmark.id)
    ) {
      dispatch(setCurrentBookmarkFromApi(props.bookmark));
    }
  }, [props.bookmark, currentBookmark, dispatch]);

  const bookmark = currentBookmark || props.bookmark;

  // Determine processing status - check both the bookmark field and active session
  const processingStatus =
    (bookmark as any).processingStatus ||
    (activeSession?.isLoading ? "processing" : "idle");

  return (
    <div className="flex flex-col gap-8">
      <ConnectionStatus />

      {/* Processing Status Banner */}
      <ProcessingStatusBanner
        status={processingStatus}
        error={(bookmark as any).processingError}
      />

      {/* Legacy loading indicator - show if session is loading but no processing status */}
      {activeSession?.isLoading && processingStatus === "idle" && (
        <Card>
          <CardContent className="px-5 py-2">
            <div className="flex flex-row gap-6 h-8 items-stretch">
              <div className="w-[180px] flex">
                <CosmicLoading />
              </div>
              <Separator orientation="vertical" className="w-px" />
              <div className="flex-1 flex align-center"></div>
            </div>
          </CardContent>
        </Card>
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

      {/* Show streaming summary content */}
      {bookmark.cosmicSummary && (
        <div className="relative">
          <CosmicMarkdown body={bookmark.cosmicSummary} />
          {processingStatus === "processing" && (
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1" />
          )}
        </div>
      )}

      {/* Placeholder while waiting for summary */}
      {!bookmark.cosmicSummary && processingStatus === "processing" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="text-sm">Generating summary...</span>
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
                    onClick={() => setIsImageGaleryDialogOpen(true)}
                  />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex" />
            <CarouselNext className="hidden sm:flex" />
          </Carousel>

          <Dialog
            open={isImageGaleryDialogOpen}
            onOpenChange={setIsImageGaleryDialogOpen}
          >
            <DialogContent className="w-[95vw] max-w-4xl max-h-[90vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Image Gallery</DialogTitle>
              </DialogHeader>
              <div className="relative flex justify-center overflow-hidden">
                <Carousel className="w-full max-w-3xl">
                  <CarouselContent>
                    {bookmark.cosmicImages.map((image, index) => (
                      <CarouselItem key={index}>
                        <div className="h-full flex flex-col items-center p-1 gap-2 sm:gap-4">
                          <img
                            src={image.url}
                            alt={image.title}
                            className="flex-1 w-full max-h-[60vh] sm:max-h-[70vh] object-contain"
                          />

                          <div className="mt-auto flex flex-col gap-1 px-2">
                            {image.title && (
                              <h4 className="text-sm font-medium text-gray-900 mb-1 text-center">
                                {image.title}
                              </h4>
                            )}
                            {image.description && (
                              <p className="text-xs text-gray-600 line-clamp-2 text-center">
                                {image.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="hidden sm:flex" />
                  <CarouselNext className="hidden sm:flex" />
                </Carousel>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      )}
      <div className="flex">
        <Actions>
          <Action label="Like">
            <RefreshCcwIcon className="size-4" />
          </Action>
          <Action label="Like">
            <ThumbsUpIcon className="size-4" />
          </Action>
          <Action label="Share">
            <ShareIcon className="size-4" />
          </Action>
        </Actions>
      </div>
    </div>
  );
};
