"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Link as LinkIcon, Loader2 } from "lucide-react";
import { PreviewResponse, Collection } from "@cosmic-dolphin/api-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { createBookmark, clearErrors } from "@/lib/store/slices/bookmarksSlice";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";

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

  const [title, setTitle] = useState(previewData.metadata.title || "");
  const [description, setDescription] = useState(
    previewData.suggestedDescription || previewData.metadata.description || ""
  );
  const [tags, setTags] = useState<string[]>(
    previewData.suggestedTags || []
  );
  const [tagInput, setTagInput] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(previewData.metadata.title || "");
      setDescription(
        previewData.suggestedDescription || previewData.metadata.description || ""
      );
      setTags(previewData.suggestedTags || []);
      setTagInput("");
      setCollectionId("");
      setSaveError(null);

      setCollectionsLoading(true);
      BookmarksClientAPI.listCollections()
        .then(setCollections)
        .finally(() => setCollectionsLoading(false));
    }
  }, [open, previewData]);

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase().replace(/\s+/g, "-");
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === "Backspace" && tagInput === "" && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const handleSave = async () => {
    dispatch(clearErrors());
    setSaveError(null);

    const result = await dispatch(
      createBookmark({
        sourceUrl: url,
        title: title || undefined,
        description: description || undefined,
        tags: tags.length > 0 ? tags : undefined,
        collectionId: collectionId || undefined,
        isPrivateLink: true,
      })
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
          <DialogTitle>Save Private Link</DialogTitle>
          <DialogDescription>
            This link is behind authentication and can&apos;t be fully
            processed. You can save it for quick access with the details below.
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
            <label htmlFor="private-link-title" className="text-sm font-medium">
              Title
            </label>
            <Input
              id="private-link-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="private-link-description"
              className="text-sm font-medium"
            >
              Description
            </label>
            <Textarea
              id="private-link-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter a description"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
                placeholder={tags.length === 0 ? "Add tags..." : ""}
                className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Collection</label>
            {collectionsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading collections...
              </div>
            ) : (
              <Select value={collectionId} onValueChange={setCollectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a collection (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {collections.map((collection) => (
                    <SelectItem key={collection.id} value={collection.id}>
                      {collection.name}
                    </SelectItem>
                  ))}
                  {collections.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No collections yet
                    </div>
                  )}
                </SelectContent>
              </Select>
            )}
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
          <Button onClick={handleSave} disabled={createLoading}>
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
