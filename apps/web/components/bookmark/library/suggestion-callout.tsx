"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CollectionSuggestion } from "@cosmic-dolphin/api-client";

import { cn } from "@/lib/utils";
import { AiCallout } from "@/components/ai/ai-callout";
import { focusRing } from "@/components/ui/focus-ring";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { BookmarksClientAPI } from "@/lib/api/bookmarks-client";
import { BookmarkScope } from "@cosmic-dolphin/api-client";

import { libraryHref } from "./params";

/**
 * The collection proposal, in the rail — 04-library.md § Collection suggestions.
 *
 * It is a proposal and nothing more: the `file` phase never creates a
 * collection, it accumulates supporting saves against a name, and only
 * **Create** turns one into a real collection. **Not now** is remembered for
 * thirty days, not forever, which is why the button does not say "Never".
 *
 * The footer is not decoration. Rule 8: an AI output names what it drew from,
 * and each source is reachable — here that is the unfiled saves the proposal
 * was built out of.
 */
export function CollectionSuggestionCallout({
  suggestion,
}: {
  suggestion: CollectionSuggestion;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [answered, setAnswered] = React.useState(false);
  const [pending, setPending] = React.useState<"create" | "dismiss" | null>(
    null
  );

  if (answered) return null;

  const supporters = suggestion.bookmarkIds?.length ?? 0;

  async function accept() {
    setPending("create");
    try {
      await BookmarksClientAPI.acceptCollectionSuggestion(suggestion.id);
      setAnswered(true);
      toast({
        title: `Created ${suggestion.name}`,
        description: `${supporters} ${supporters === 1 ? "save" : "saves"} filed into it.`,
        variant: "success",
      });
      router.refresh();
    } catch (error) {
      toast({
        title: "Couldn't create that collection",
        description: error instanceof Error ? error.message : undefined,
        variant: "danger",
      });
    } finally {
      setPending(null);
    }
  }

  async function dismiss() {
    setPending("dismiss");
    try {
      await BookmarksClientAPI.dismissCollectionSuggestion(suggestion.id);
      setAnswered(true);
      toast({ title: "Set aside for 30 days" });
      router.refresh();
    } catch (error) {
      toast({
        title: "Couldn't set that aside",
        description: error instanceof Error ? error.message : undefined,
        variant: "danger",
      });
    } finally {
      setPending(null);
    }
  }

  return (
    <AiCallout
      compact
      label="Suggestion"
      footer={
        <p className="m-0 font-sans text-[12px] leading-[1.5] text-fg-secondary">
          Drawn from{" "}
          <Link
            href={libraryHref({ scope: BookmarkScope.Inbox })}
            className={cn(
              "rounded-xs text-accent underline-offset-4 hover:underline",
              focusRing,
            )}
          >
            {supporters} unfiled {supporters === 1 ? "save" : "saves"}
          </Link>
          .
        </p>
      }
    >
      <p className="m-0 font-sans text-[13px] leading-[1.55] text-fg-secondary">
        {supporters} {supporters === 1 ? "save looks" : "saves look"} like a new
        collection:{" "}
        <b className="font-medium text-fg">{suggestion.name}</b>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="primary"
          loading={pending === "create"}
          disabled={pending !== null}
          onClick={accept}
        >
          Create
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={pending === "dismiss"}
          disabled={pending !== null}
          onClick={dismiss}
        >
          Not now
        </Button>
      </div>
    </AiCallout>
  );
}
