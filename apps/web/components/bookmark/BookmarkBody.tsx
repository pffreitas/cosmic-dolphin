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
  HeartIcon,
  ShareIcon,
  AlertCircleIcon,
  Loader2Icon,
  CopyIcon,
  CheckIcon,
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBookmarkRealtime } from "@/lib/hooks/useBookmarkRealtime";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";

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
  const [isLiked, setIsLiked] = useState(
    () => (props.bookmark as any).isLikedByCurrentUser ?? false
  );
  const [likeCount, setLikeCount] = useState(
    () => (props.bookmark as any).likeCount ?? 0
  );
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [isShared, setIsShared] = useState(
    () => (props.bookmark as any).isPublic ?? false
  );
  const [shareUrl, setShareUrl] = useState("");
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

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

  const handleLikeToggle = async () => {
    if (isLikeLoading) return;

    const previousIsLiked = isLiked;
    const previousLikeCount = likeCount;

    setIsLiked(!isLiked);
    setLikeCount(isLiked ? Math.max(likeCount - 1, 0) : likeCount + 1);
    setIsLikeLoading(true);

    try {
      const result = isLiked
        ? await BookmarksClientAPI.unlike(bookmark.id)
        : await BookmarksClientAPI.like(bookmark.id);

      setLikeCount(result.likeCount);
      setIsLiked(result.isLikedByCurrentUser);
    } catch (error) {
      console.error("Failed to toggle like:", error);
      setIsLiked(previousIsLiked);
      setLikeCount(previousLikeCount);
    } finally {
      setIsLikeLoading(false);
    }
  };

  const handleShareToggle = async () => {
    if (isShareLoading) return;

    if (isShared) {
      setIsShareDialogOpen(true);
      return;
    }

    setIsShareLoading(true);
    try {
      const result = await BookmarksClientAPI.share(bookmark.id);
      setIsShared(result.isPublic);
      setShareUrl(result.shareUrl);
      setIsShareDialogOpen(true);
    } catch (error) {
      console.error("Failed to share bookmark:", error);
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleUnshare = async () => {
    if (isShareLoading) return;

    setIsShareLoading(true);
    try {
      const result = await BookmarksClientAPI.unshare(bookmark.id);
      setIsShared(result.isPublic);
      setShareUrl("");
      setIsShareDialogOpen(false);
    } catch (error) {
      console.error("Failed to unshare bookmark:", error);
    } finally {
      setIsShareLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy link:", error);
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {bookmark.collectionPath && bookmark.collectionPath.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/my/library">My Bookmarks</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {bookmark.collectionPath.map((item, index) => {
              const isLast = index === bookmark.collectionPath!.length - 1;
              return (
                <div key={item.id} className="flex items-center gap-1.5">
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{item.name}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link href={`/my/library?collection_id=${item.id}`}>
                          {item.name}
                        </Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </div>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

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
      <Actions>
        <Action
          label={isLiked ? "Unlike" : "Like"}
          tooltip={isLiked ? "Unlike" : "Like"}
          onClick={handleLikeToggle}
          disabled={isLikeLoading}
          variant="outline"
          className={
            isLiked
              ? "text-red-500 hover:text-red-600 border-red-200 bg-red-50/50 hover:bg-red-50 w-auto px-3 gap-2"
              : "text-muted-foreground hover:text-red-500 w-auto px-3 gap-2"
          }
        >
          <HeartIcon
            className="size-4"
            fill={isLiked ? "currentColor" : "none"}
          />
          {likeCount > 0 && (
            <span className="text-sm font-medium">
              {likeCount}
            </span>
          )}
        </Action>
        <Action
          label={isShared ? "Shared" : "Share"}
          tooltip={isShared ? "Manage share link" : "Share bookmark"}
          onClick={handleShareToggle}
          disabled={isShareLoading}
          variant="outline"
          className={
            isShared
              ? "text-blue-500 hover:text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-50 w-auto px-3 gap-2"
              : "text-muted-foreground hover:text-blue-500 w-auto px-3 gap-2"
          }
        >
          <ShareIcon className="size-4" />
        </Action>
      </Actions>

      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share bookmark</DialogTitle>
            <DialogDescription>
              Anyone with this link can view this bookmark.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input
              value={shareUrl}
              readOnly
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              className="shrink-0"
            >
              {isCopied ? (
                <CheckIcon className="size-4 text-green-500" />
              ) : (
                <CopyIcon className="size-4" />
              )}
            </Button>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleUnshare}
              disabled={isShareLoading}
              className="text-red-500 hover:text-red-600 hover:bg-red-50"
            >
              Stop sharing
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
