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
  ExternalLinkIcon,
  LockIcon,
  Trash2Icon,
} from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Separator } from "@/components/ui/separator";
import { useSessionByBookmark } from "@/lib/store/realtimeSelectors";
import { Badge } from "@/components/ui/badge";
import { BookmarkImageGallery } from "@/components/bookmark/BookmarkImageGallery";
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
import { useRouter } from "next/navigation";
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
      <Card className="border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30">
        <CardContent className="px-5 py-3">
          <div className="flex flex-row gap-3 items-center">
            <AlertCircleIcon className="size-5 text-red-500 shrink-0" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-red-700 dark:text-red-400">
                Processing failed
              </span>
              {error && (
                <span className="text-xs text-red-600 dark:text-red-500">
                  {error}
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30">
      <CardContent className="px-5 py-3">
        <div className="flex flex-row gap-3 items-center">
          <Loader2Icon className="size-5 text-blue-500 animate-spin shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
              Processing bookmark...
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-500">
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const router = useRouter();

  const { isConnected, isProcessing } = useBookmarkRealtime(
    props.bookmark.id,
    {
      enabled: true,
    }
  );

  const activeSession = useSessionByBookmark(props.bookmark.id);

  useEffect(() => {
    if (
      props.bookmark &&
      (!currentBookmark || currentBookmark.id !== props.bookmark.id)
    ) {
      dispatch(setCurrentBookmarkFromApi(props.bookmark));
    }
  }, [props.bookmark, currentBookmark, dispatch]);

  const bookmark = currentBookmark || props.bookmark;

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

  const handleDelete = async () => {
    if (isDeleteLoading) return;

    setIsDeleteLoading(true);
    setDeleteError(null);
    try {
      await BookmarksClientAPI.remove(bookmark.id);
      router.push("/my/library");
    } catch (error) {
      console.error("Failed to delete bookmark:", error);
      setDeleteError(
        error instanceof Error ? error.message : "Failed to delete bookmark"
      );
      setIsDeleteLoading(false);
    }
  };

  const imageCount = bookmark.cosmicImages?.length ?? 0;

  return (
    <article className="flex flex-col gap-8 animate-in fade-in duration-300">
      {/* Breadcrumb Navigation */}
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

      <ProcessingStatusBanner
        status={processingStatus}
        error={(bookmark as any).processingError}
      />

      {/* Legacy loading indicator */}
      {activeSession?.isLoading && processingStatus === "idle" && (
        <Card>
          <CardContent className="px-5 py-2">
            <div className="flex flex-row gap-6 h-8 items-stretch">
              <div className="w-[180px] flex">
                <CosmicLoading />
              </div>
              <Separator orientation="vertical" className="w-px" />
              <div className="flex-1 flex align-center" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header: Title + Actions */}
      <header>
        <div className="flex items-start gap-4">
          {bookmark.title && (
            <h1 className="flex-1 min-w-0 text-2xl sm:text-3xl font-semibold tracking-tight leading-tight" style={{ fontFamily: 'Georgia, "Times New Roman", Times, serif' }}>
              {bookmark.isPrivateLink && (
                <LockIcon className="inline-block size-5 mr-2 align-baseline text-muted-foreground" />
              )}
              {bookmark.title}
            </h1>
          )}

          <Actions className="shrink-0 mt-1">
            <Action
              label={isLiked ? "Unlike" : "Like"}
              tooltip={isLiked ? "Unlike" : "Like"}
              onClick={handleLikeToggle}
              disabled={isLikeLoading}
              variant="outline"
              className={
                isLiked
                  ? "text-red-500 hover:text-red-600 border-red-200 bg-red-50/50 hover:bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 dark:hover:bg-red-950/50 w-auto px-3 gap-2 cursor-pointer"
                  : "text-muted-foreground hover:text-red-500 w-auto px-3 gap-2 cursor-pointer"
              }
            >
              <HeartIcon
                className="size-4"
                fill={isLiked ? "currentColor" : "none"}
              />
              {likeCount > 0 && (
                <span className="text-sm font-medium">{likeCount}</span>
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
                  ? "text-blue-500 hover:text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-50 dark:border-blue-900/50 dark:bg-blue-950/30 dark:hover:bg-blue-950/50 w-auto px-3 gap-2 cursor-pointer"
                  : "text-muted-foreground hover:text-blue-500 w-auto px-3 gap-2 cursor-pointer"
              }
            >
              <ShareIcon className="size-4" />
            </Action>
            <Action
              label="Delete"
              tooltip="Delete bookmark"
              onClick={() => setIsDeleteDialogOpen(true)}
              variant="outline"
              className="text-muted-foreground hover:text-red-500 w-auto px-3 gap-2 cursor-pointer"
            >
              <Trash2Icon className="size-4" />
            </Action>
          </Actions>
        </div>
      </header>

      {/* Source Link */}
      {bookmark.metadata?.openGraph ? (
        <OpenGraphWebpage
          title={bookmark.metadata.openGraph.title || ""}
          description={bookmark.metadata.openGraph.description || ""}
          image={bookmark.metadata.openGraph.image || ""}
          url={bookmark.metadata.openGraph.url || ""}
        />
      ) : (
        <a
          href={bookmark.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-3 rounded-lg border px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50 cursor-pointer"
        >
          <ExternalLinkIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
          <span className="truncate">{bookmark.sourceUrl}</span>
        </a>
      )}

      {/* Brief Summary (when full summary is not available) */}
      {!bookmark.cosmicSummary && bookmark.cosmicBriefSummary && (
        <p className="text-base leading-relaxed text-muted-foreground">
          {bookmark.cosmicBriefSummary}
        </p>
      )}

      {/* Tags */}
      {bookmark.cosmicTags && bookmark.cosmicTags.length > 0 && (
        <div className="flex flex-row flex-wrap gap-2">
          {bookmark.cosmicTags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="cursor-default transition-colors hover:bg-muted"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Full Summary */}
      {bookmark.cosmicSummary && (
        <section className="relative">
          <CosmicMarkdown body={bookmark.cosmicSummary} />
          {processingStatus === "processing" && (
            <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1 rounded-sm" />
          )}
        </section>
      )}

      {!bookmark.cosmicSummary && processingStatus === "processing" && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          <span className="text-sm">Generating summary...</span>
        </div>
      )}

      {/* Image Gallery */}
      {bookmark.cosmicImages && imageCount > 0 && (
        <BookmarkImageGallery images={bookmark.cosmicImages} />
      )}

      {/* Share Dialog */}
      <Dialog open={isShareDialogOpen} onOpenChange={setIsShareDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share bookmark</DialogTitle>
            <DialogDescription>
              Anyone with this link can view this bookmark.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={shareUrl} readOnly className="flex-1" />
            <Button
              variant="outline"
              size="icon"
              onClick={handleCopyLink}
              aria-label="Copy link"
              className="shrink-0 cursor-pointer"
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
              className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
            >
              Stop sharing
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteDialogOpen}
        onOpenChange={(open) => {
          if (!isDeleteLoading) {
            setIsDeleteDialogOpen(open);
            if (!open) setDeleteError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete bookmark</DialogTitle>
            <DialogDescription>
              This will permanently delete this bookmark and all associated data
              including summaries, tags, and images. This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-md px-3 py-2">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span>{deleteError}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleteLoading}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleteLoading}
              className="cursor-pointer"
            >
              {isDeleteLoading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin mr-1" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
};
