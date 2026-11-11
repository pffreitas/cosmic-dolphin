import React, { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import type { FeedItem, Collection } from "@cosmic-dolphin/api-client";
import { Button, Sheet, SkeletonRows, Notice } from "./ui/Signal";
import { readWhen, laterTimeDetail, type LaterOption } from "@/lib/read-when";
import type { BookmarkActions } from "@/lib/bookmark-actions";
import { MobileAPI } from "@/lib/mobile-api";

export type ActionSheet = { item: FeedItem; mode: "menu" | "later" | "move" };
export function BookmarkActionSheets({ selection, controller, onChange, onClose }: {
  selection?: ActionSheet; controller: BookmarkActions; onChange: (selection: ActionSheet) => void; onClose: () => void;
}) {
  const router = useRouter();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const mode = selection?.mode;
  const load = () => {
    setLoading(true); setError(false);
    void MobileAPI.collections().then(setCollections).catch(() => setError(true)).finally(() => setLoading(false));
  };
  useEffect(() => { if (mode === "move") load(); }, [mode]);
  const bookmark = selection?.item.bookmark;
  const own = selection?.item.type === "own_save" || selection?.item.type === "pending";

  return <Sheet title={mode === "later" ? "Bring this back" : mode === "move" ? "Move to topic" : bookmark?.title || selection?.item.digest?.title || "Save actions"} visible={!!selection} onClose={onClose}>
    {mode === "later" ? <>
      {([ ["Tonight", "Tonight"], ["Tomorrow", "Tomorrow morning"], ["This weekend", "This weekend"], ["Next week", "Next week"] ] as [LaterOption, string][]).map(([option, title]) => {
        const when = readWhen(option)!;
        return <Button key={option} title={title} detail={laterTimeDetail(when)} onPress={() => { if (bookmark) controller.later(bookmark, readWhen(option)!); onClose(); }} />;
      })}
      <Button title="Not for me" onPress={() => { if (selection) controller.reject(selection.item); onClose(); }} />
    </> : mode === "move" ? <>
      {loading ? <SkeletonRows /> : <>
        {error ? <Notice message="Topics could not be loaded." error action="Retry" onAction={load} /> : null}
        <Button title="Inbox" onPress={() => { if (bookmark) controller.move(bookmark); onClose(); }} />
        {collections.map(collection => <Button key={collection.id} title={collection.name} onPress={() => { if (bookmark) controller.move(bookmark, collection.id, collection.name); onClose(); }} />)}
      </>}
    </> : <>
      <Button title="Open" onPress={() => { onClose(); if (bookmark) router.push(`/bookmark/${bookmark.id}`); else if (selection?.item.digest) router.push({ pathname: "/topic", params: { id: `digest:${selection.item.digest.id}` } }); }} />
      {own && bookmark ? <>
        <Button title={controller.view(bookmark).readAt ? "Mark not done" : "Mark done"} onPress={() => { controller.done(bookmark); onClose(); }} />
        <Button title="Later…" onPress={() => { if (selection) onChange({ ...selection, mode: "later" }); }} />
        <Button title="Move to topic…" onPress={() => { if (selection) onChange({ ...selection, mode: "move" }); }} />
        <Button title="Not for me" onPress={() => { if (selection) controller.reject(selection.item); onClose(); }} />
      </> : bookmark ? <>
        <Button title="Save to Library" onPress={() => { if (selection) controller.save(selection.item); onClose(); }} />
        <Button title="Not for me" onPress={() => { if (selection) controller.reject(selection.item); onClose(); }} />
      </> : null}
    </>}
  </Sheet>;
}
