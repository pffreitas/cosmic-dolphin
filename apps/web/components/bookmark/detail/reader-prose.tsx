import * as React from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * The reading column's typography — foundations.md, and the one place in the
 * product where the serif runs at full size.
 *
 * 16px at 1.75, capped at `--cd-measure`. Everything else here follows from
 * those two numbers: the paragraph rhythm is a multiple of the line, headings
 * step down from the page's `title-1` rather than starting a new scale, and
 * the measure is on the prose element rather than the page so the hero, the
 * brief and the comment thread can be wider than the sentences.
 *
 * `react-markdown` rather than the `Streamdown` renderer the old detail page
 * used: this content is not streaming, and the reader needs a DOM it can
 * predict — highlights are painted by walking text nodes, and a renderer that
 * re-mounts spans while it parses would paint them and then throw them away.
 */
export interface ReaderProseProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  body: string;
}

/**
 * Exported because the shared route and the dev gallery both need prose that
 * looks identical to the reader's without the reader's machinery around it.
 */
export const readerProseClass = cn(
  "max-w-[var(--cd-measure)] font-serif text-[16px] leading-[1.75] text-fg",
  // Blocks
  "[&_p]:my-[1.15em]",
  "[&_h2]:mb-[0.5em] [&_h2]:mt-[1.9em] [&_h2]:font-serif [&_h2]:text-[22px] [&_h2]:font-semibold [&_h2]:leading-[1.3]",
  "[&_h3]:mb-[0.45em] [&_h3]:mt-[1.7em] [&_h3]:font-serif [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:leading-[1.35]",
  "[&_h4]:mb-[0.4em] [&_h4]:mt-[1.5em] [&_h4]:font-sans [&_h4]:text-[14px] [&_h4]:font-semibold",
  "[&_ul]:my-[1.15em] [&_ul]:list-disc [&_ul]:pl-[1.4em]",
  "[&_ol]:my-[1.15em] [&_ol]:list-decimal [&_ol]:pl-[1.4em]",
  "[&_li]:my-[0.4em]",
  "[&_li::marker]:text-fg-tertiary",
  // A pull quote, which is the only place the reader raises its voice.
  "[&_blockquote]:my-[1.6em] [&_blockquote]:border-l-2 [&_blockquote]:border-accent-border",
  "[&_blockquote]:pl-[1.1em] [&_blockquote]:text-[18px] [&_blockquote]:italic [&_blockquote]:text-fg-secondary",
  "[&_blockquote_p]:my-[0.6em]",
  "[&_hr]:my-[2.2em] [&_hr]:border-line",
  // Inline
  "[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-accent-border",
  "[&_strong]:font-semibold [&_strong]:text-fg",
  "[&_em]:italic",
  "[&_code]:rounded-xs [&_code]:bg-bg-inset [&_code]:px-1 [&_code]:py-0.5",
  "[&_code]:font-mono [&_code]:text-[0.86em]",
  "[&_pre]:my-[1.5em] [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-bg-inset [&_pre]:p-4",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-[13px]",
  "[&_img]:my-[1.6em] [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md",
  // Tables scroll inside themselves rather than widening the column.
  "[&_table]:my-[1.5em] [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto",
  "[&_table]:font-sans [&_table]:text-[14px]",
  "[&_th]:border-b [&_th]:border-line [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold",
  "[&_td]:border-b [&_td]:border-line [&_td]:px-2 [&_td]:py-1.5",
  // The highlight. `--cd-hl-bg` and nothing else — no underline, no border,
  // no weight change: a highlight marks text the reader kept, and any second
  // signal on top of the ground starts competing with the words.
  "[&_mark]:bg-[color:var(--cd-hl-bg)] [&_mark]:text-fg",
  "[&_mark]:rounded-xs [&_mark]:px-[0.5px] [&_mark]:py-[1px]",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
);

export function ReaderProse({ body, className, ...props }: ReaderProseProps) {
  return (
    <div className={cn(readerProseClass, className)} {...props}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Every link out of a save opens away from the reader, and carries
          // the usual `noopener` because we do not control where it goes.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          a: ({ node: _node, ...anchorProps }) => (
            <a {...anchorProps} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {body}
      </Markdown>
    </div>
  );
}
