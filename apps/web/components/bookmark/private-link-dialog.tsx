"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Link as LinkIcon, Loader2 } from "lucide-react";
import { PreviewResponse } from "@cosmic-dolphin/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createBookmark, clearErrors } from "@/lib/store/slices/bookmarksSlice";
import { buildPrivateLinkCreateRequest } from "./private-link-payload";

interface PrivateLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  previewData: PreviewResponse;
}

export default function PrivateLinkDialog({
  open,
  onOpenChange,
  url,
  previewData,
}: PrivateLinkDialogProps) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const createLoading = useAppSelector(
    (state) => state.bookmarks.createLoading
  );

  const [description, setDescription] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription("");
      setSaveError(null);
    }
  }, [open]);

  const handleSave = async () => {
    dispatch(clearErrors());
    setSaveError(null);

    if (!description.trim()) {
      setSaveError("Add a brief description so this private link is findable later.");
      return;
    }

    const result = await dispatch(
      createBookmark(
        buildPrivateLinkCreateRequest({
          url,
          previewData,
          description,
        })
      )
    );

    if (createBookmark.fulfilled.match(result)) {
      onOpenChange(false);
      const bookmarkId = result.payload;
      router.push(`/bookmarks/${bookmarkId}`);
    } else if (createBookmark.rejected.match(result)) {
      setSaveError(result.payload as string);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Save private link</DialogTitle>
          <DialogDescription>
            We can&apos;t read or summarize this page, but we can keep it at
            hand. Add a short note and Cosmic Dolphin will organize it for
            quick access.
          </DialogDescription>
        </DialogHeader>

        <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              Link
            </label>
            <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
              <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm">{url}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="private-link-description"
              className="text-sm font-medium"
            >
              Brief description
            </label>
            <Textarea
              id="private-link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this link, and why will you need it?"
              rows={3}
            />
          </div>

          {saveError && (
            <div className="text-sm text-red-600">{saveError}</div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={createLoading || !description.trim()}>
            {createLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
