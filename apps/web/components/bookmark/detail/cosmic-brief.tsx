"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AiCallout, AiKeyPoint, AiKeyPoints } from "@/components/ai/ai-callout";
import { ProvenanceRow } from "@/components/provenance-row";

/**
 * The Cosmic brief — pages.md, position 2, and it does not move.
 *
 * Summary paragraph, a `KEY POINTS` label, the dotted points, then the
 * `.ai-foot` naming where it came from. The foot is not decoration and not
 * optional: rule 8 is that no AI output ships without its sources, and this
 * is the largest AI output in the product.
 *
 * The key points arrive as an array from `bookmarks.cosmic_key_points`. They
 * are never parsed out of the summary markdown here — the pipeline already
 * answered that question, and re-deriving it in the browser turns any
 * bulleted list in the prose into a finding the model never claimed.
 */
export interface CosmicBriefProps {
  summary?: string;
  keyPoints: string[];
  /** Bare domain the summary was built from. */
  domain?: string;
  faviconUrl?: string;
  sourceUrl?: string;
  /** "9 min article", shown right of the label. */
  meta?: React.ReactNode;
  /** Starts a fresh run. Absent on the shared route — not a stranger's call. */
  onRegenerate?: () => void;
  regenerating?: boolean;
  className?: string;
}

export function CosmicBrief({
  summary,
  keyPoints,
  domain,
  faviconUrl,
  sourceUrl,
  meta,
  onRegenerate,
  regenerating = false,
  className,
}: CosmicBriefProps) {
  // Nothing to attribute and nothing to say. A callout with an empty body is
  // worse than no callout: it claims the AI produced something.
  if (!summary && keyPoints.length === 0) return null;

  return (
    <AiCallout
      label="Cosmic brief"
      meta={meta}
      className={className}
      footer={
        <ProvenanceRow
          sources={
            domain ? [{ domain, faviconUrl, href: sourceUrl }] : undefined
          }
          action="summarised from the full article"
          trailing={
            onRegenerate ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRegenerate}
                loading={regenerating}
                icon={<RotateCw aria-hidden="true" />}
                className="gap-1.5 px-2 font-medium [&_svg]:size-[14px]"
              >
                Regenerate
              </Button>
            ) : null
          }
        />
      }
    >
      {summary ? (
        <p
          className={cn(
            "m-0 font-sans text-[14.5px] leading-[1.6] text-fg-secondary",
            keyPoints.length > 0 && "mb-4",
          )}
        >
          {summary}
        </p>
      ) : null}

      {keyPoints.length > 0 ? (
        <>
          <p className="mb-2.5 font-sans text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-tertiary">
            Key points
          </p>
          <AiKeyPoints>
            {keyPoints.map((point, index) => (
              <AiKeyPoint key={`${index}-${point.slice(0, 24)}`}>
                {point}
              </AiKeyPoint>
            ))}
          </AiKeyPoints>
        </>
      ) : null}
    </AiCallout>
  );
}
