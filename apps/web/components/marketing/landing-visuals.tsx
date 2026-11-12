import { Check, Folder, Link2, Search } from "lucide-react";

import { AiCallout, AiKeyPoint, AiKeyPoints } from "@/components/ai/ai-callout";
import { ProcessingSteps } from "@/components/ai/processing-steps";
import { LibraryList, LibraryRow } from "@/components/bookmark/library-row";
import { FeedItem } from "@/components/feed/feed-item";
import { ProvenanceRow } from "@/components/provenance-row";
import { Tag } from "@/components/ui/badge";
import { readingSamples } from "./reading-samples";
import { AppWindow, INERT } from "./vignettes";

/**
 * The landing page's three product views. Like vignettes.tsx, each is built
 * from the product's own components with illustrative content, so the page
 * cannot promise an interface the app does not have.
 */

const [article, video, post] = readingSamples;

/**
 * The hero: one pasted link, and what comes back. The staged reveal in
 * landing-page.css replays the order things really happen in: saved at once,
 * then read, summarised and filed.
 */
export function CaptureVisual() {
  return (
    <figure
      className="landing-capture"
      aria-label={`Example: a pasted link to ${article.author}’s essay “${article.title}” is saved, then returned with a short brief, three key points and a suggested collection.`}
    >
      <div {...INERT} className="pointer-events-none select-none">
        <div className="landing-capture-url">
          <Link2 aria-hidden="true" size={17} />
          <span>{article.displayUrl}</span>
          <span className="landing-capture-saved">
            <Check aria-hidden="true" size={14} /> Saved
          </span>
        </div>
        <ProcessingSteps
          className="landing-capture-steps"
          layout="inline"
          steps={[
            { phase: "fetch", state: "done" },
            { phase: "extract", state: "done" },
            { phase: "summarise", state: "done", label: "Summarised" },
            { phase: "file", state: "done", label: "Filed" },
          ]}
        />
        <div className="landing-capture-card">
          <ProvenanceRow
            sources={[{ domain: article.domain }]}
            attribution={article.author}
            timestamp="just now"
          />
          <p className="landing-capture-title">{article.title}</p>
          <AiCallout
            label="Cosmic brief"
            meta={`From a ${article.length.toLowerCase()}`}
            footer={
              <ProvenanceRow
                sources={[{ domain: article.domain }]}
                action="summarised from the full article"
              />
            }
          >
            <p className="landing-capture-summary">{article.summary}</p>
            <AiKeyPoints className="mt-3.5">
              {article.points.map((point) => (
                <AiKeyPoint key={point.term} term={point.term}>
                  {point.text}
                </AiKeyPoint>
              ))}
            </AiKeyPoints>
          </AiCallout>
          <div className="landing-capture-filing">
            <span>
              <Folder aria-hidden="true" size={15} />
              Filed in <b>{article.collection}</b>
            </span>
            {article.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Home's morning edition: one lead, the rest as rows, and a stated end. */
export function EditionVisual() {
  return (
    <AppWindow
      label="Example of Home: a morning greeting, one saved video placed first with its summary, two more saves below it, and a closing line that says the edition is finished."
      className="landing-edition"
    >
      <div className="flex flex-col gap-6 px-7 pb-6 pt-7 max-sm:px-5">
        <div className="flex flex-col gap-1.5">
          <p className="m-0 font-serif text-[28px] font-semibold leading-[1.12] tracking-[-.022em] text-fg">
            Good morning
          </p>
          <p className="m-0 font-sans text-[13.5px] leading-[1.5] text-fg-secondary">
            Ranked for what you’re likely to finish
          </p>
        </div>
        <FeedItem
          variant="lead"
          className="landing-edition-lead"
          href="#"
          title={video.title}
          summary={video.summary}
          thumbnailUrl="/images/landing/llm-video.webp"
          provenance={{
            sources: [{ domain: video.domain }],
            attribution: video.author,
            action: "you saved this",
          }}
          tags={video.tags}
        />
        <div className="border-t border-line">
          <FeedItem
            variant="row"
            href="#"
            title={article.title}
            summary={article.summary}
            provenance={{
              sources: [{ domain: article.domain }],
              attribution: article.author,
              action: "you saved this",
            }}
            tags={article.tags}
          />
          <FeedItem
            variant="row"
            href="#"
            title={post.title}
            summary={post.summary}
            provenance={{
              sources: [{ domain: post.domain }],
              attribution: post.author,
              action: "you saved this",
            }}
            tags={post.tags}
          />
        </div>
        <p className="m-0 font-sans text-[12.5px] leading-[1.5] text-fg-tertiary">
          That’s everything for now.
        </p>
      </div>
    </AppWindow>
  );
}

/** The Library, searched by meaning: one literal hit and one related save. */
export function LibraryVisual() {
  return (
    <AppWindow
      label="Example of Library search: the query “doing better work” finds a saved essay by its title and a related saved post, each already filed in a collection."
      className="landing-library"
    >
      <div className="flex flex-col gap-3 p-5">
        <div className="flex h-10 items-center gap-2.5 rounded-md border border-[color:var(--cd-accent)] bg-bg-panel px-3 font-sans text-[14px] text-fg">
          <Search
            aria-hidden="true"
            className="size-4 text-fg-tertiary [stroke-width:1.8]"
          />
          doing better work
        </div>
        <LibraryList>
          <LibraryRow
            href="#"
            title={
              <>
                How to Do Great{" "}
                <mark className="rounded-xs bg-[var(--cd-hl-bg)] text-fg">
                  Work
                </mark>
              </>
            }
            summary={article.summary}
            collectionPath={[{ id: "creative", name: article.collection }]}
            domain={article.domain}
            tags={article.tags}
          />
          <LibraryRow
            href="#"
            title={post.title}
            summary={post.summary}
            collectionPath={[{ id: "habits", name: post.collection }]}
            domain={post.domain}
            badge={<Tag variant="neutral">Related</Tag>}
          />
        </LibraryList>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-3 pt-4 font-sans text-[12.5px] text-fg-secondary">
          <span className="font-semibold text-fg-tertiary">Collections</span>
          {readingSamples.map((sample) => (
            <span key={sample.id} className="flex items-center gap-1.5">
              <Folder
                aria-hidden="true"
                className="size-3.5 text-fg-tertiary [stroke-width:1.7]"
              />
              {sample.collection}
            </span>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}
