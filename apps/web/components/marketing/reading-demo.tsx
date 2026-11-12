import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  Folder,
  MessageCircle,
  Youtube,
} from "lucide-react";
import { AiCallout, AiKeyPoint, AiKeyPoints } from "@/components/ai/ai-callout";
import { Tag } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/focus-ring";
import { readingSamples } from "./reading-samples";
import { SavedLinkCover } from "./saved-link-cover";

/* The talk opens the demo: an hour against three lines is the clearest case. */
const [article, video, post] = readingSamples;
const samples = [video, article, post];

const FORMAT_ICON = {
  article: FileText,
  video: Youtube,
  post: MessageCircle,
} as const;

/**
 * The page's one argument, shown three times: what you saved beside what you
 * get back. Explicitly illustrative; no saves, AI requests or account state.
 *
 * A radio group and `:has()` in landing-page.css do the switching, so this
 * stays a server component and the standalone preview needs no script. Each
 * radio is a transparent layer the size of its tab, so the tab is the target
 * and the one focus ring is drawn on the control that actually has focus.
 */
export function ReadingDemo() {
  return (
    <div className="reading-demo" data-reading-demo>
      <fieldset className="reading-demo-tabs">
        <legend>Choose an example save</legend>
        {samples.map((sample, index) => {
          const Icon = FORMAT_ICON[sample.id];
          return (
            <label key={sample.id}>
              <input
                className={focusRing}
                type="radio"
                name="reading-demo"
                value={sample.id}
                defaultChecked={index === 0}
              />
              <Icon aria-hidden="true" size={18} />
              <span>
                <b>{sample.format}</b>
                <small>{sample.title}</small>
              </span>
            </label>
          );
        })}
      </fieldset>
      {samples.map((sample) => (
        <div
          key={sample.id}
          data-demo-panel={sample.id}
          className="reading-demo-panel"
        >
          <div className="reading-demo-side">
            <p className="reading-demo-label">What you saved</p>
            <SavedLinkCover sample={sample} />
          </div>
          <ArrowRight
            className="reading-demo-arrow"
            aria-hidden="true"
            size={22}
          />
          <div className="reading-demo-side">
            <p className="reading-demo-label">What you get back</p>
            <AiCallout
              label="Cosmic brief"
              meta={`From a ${sample.length.toLowerCase()}`}
              footer={
                <a
                  className={`reading-demo-source ${focusRing}`}
                  href={sample.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open original on {sample.domain}
                  <ArrowUpRight size={14} aria-hidden="true" />
                </a>
              }
            >
              <p className="reading-demo-summary">{sample.summary}</p>
              {sample.points.length > 0 ? (
                <AiKeyPoints className="mt-4">
                  {sample.points.map((point) => (
                    <AiKeyPoint key={point.term} term={point.term}>
                      {point.text}
                    </AiKeyPoint>
                  ))}
                </AiKeyPoints>
              ) : null}
            </AiCallout>
            <div className="reading-demo-filing">
              <span>
                <Folder aria-hidden="true" size={15} />
                Filed in <b>{sample.collection}</b>
              </span>
              {sample.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </div>
          </div>
        </div>
      ))}
      <p className="reading-demo-note">
        Real public links. The briefs here are written by hand as examples.
      </p>
    </div>
  );
}
