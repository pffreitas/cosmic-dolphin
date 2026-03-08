"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createBookmark,
  previewUrl,
  clearErrors,
} from "@/lib/store/slices/bookmarksSlice";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { Bookmark } from "lucide-react";
import { PreviewResponse } from "@cosmic-dolphin/api-client";
import PrivateLinkDialog from "./private-link-dialog";

interface NewBookmarkButtonProps {}

export default function NewBookmarkButton({}: NewBookmarkButtonProps) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [url, setUrl] = useState("");
  const [privateLinkDialogOpen, setPrivateLinkDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const createLoading = useAppSelector(
    (state) => state.bookmarks.createLoading
  );
  const previewLoading = useAppSelector(
    (state) => state.bookmarks.previewLoading
  );
  const createError = useAppSelector((state) => state.bookmarks.createError);
  const previewError = useAppSelector((state) => state.bookmarks.previewError);

  const isLoading = createLoading || previewLoading;

  const handleSubmit = async () => {
    dispatch(clearErrors());

    const result = await dispatch(previewUrl(url));

    if (previewUrl.fulfilled.match(result)) {
      const preview = result.payload as PreviewResponse;

      if (preview.scrapable) {
        const createResult = await dispatch(
          createBookmark({ sourceUrl: url })
        );
        if (createBookmark.fulfilled.match(createResult)) {
          setShowOverlay(false);
          setUrl("");
          const bookmarkId = createResult.payload;
          router.push(`/bookmarks/${bookmarkId}`);
        }
      } else {
        setPreviewData(preview);
        setShowOverlay(false);
        setPrivateLinkDialogOpen(true);
      }
    }
  };

  const handleNewBookmark = () => {
    setShowOverlay(true);
  };

  const handleOverlayClick = () => {
    setShowOverlay(false);
    dispatch(clearErrors());
  };

  const handlePrivateLinkDialogChange = (open: boolean) => {
    setPrivateLinkDialogOpen(open);
    if (!open) {
      setUrl("");
      setPreviewData(null);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === "k") {
        event.preventDefault();
        handleNewBookmark();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const displayError = createError || previewError;

  return (
    <>
      {showOverlay && (
        <div className="fixed inset-0 bg-slate-200 bg-opacity-50 backdrop-blur-sm z-50">
          <div className="fixed inset-0" onClick={handleOverlayClick}></div>
          <div>
            <div className="absolute w-1/2 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              {isLoading && (
                <div className="absolute w-full h-full blur rounded-lg bg-gradient-to-br from-pink-500 via-violet-500 to-cyan-500 animate-tilt"></div>
              )}
              <div className="relative bg-white rounded-lg p-4 shadow-2xl shadow-teal-300">
                <input
                  type="text"
                  className="w-full p-2 focus:outline-none "
                  value={url}
                  autoFocus={true}
                  disabled={isLoading}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isLoading) {
                      handleSubmit();
                    }
                  }}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="URL"
                />

                {displayError && (
                  <div className="text-red-600 p-2 text-sm">{displayError}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {previewData && (
        <PrivateLinkDialog
          open={privateLinkDialogOpen}
          onOpenChange={handlePrivateLinkDialogChange}
          url={url}
          previewData={previewData}
        />
      )}

      <button
        id="new-bookmark-button"
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-noto text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        onClick={() => {
          handleNewBookmark();
        }}
      >
        <Bookmark size={16} />
        Save Bookmark
      </button>
    </>
  );
}
