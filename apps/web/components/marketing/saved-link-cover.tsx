import { FileText, MessageCircle, Play, Youtube } from "lucide-react";
import type { ReadingSample } from "./reading-samples";

/** Editorial source excerpts, not fabricated screenshots or platform engagement. */
export function SavedLinkCover({ sample }: { sample: ReadingSample }) {
  if (sample.id === "video") {
    return (
      <div className="saved-link-cover saved-link-video">
        <div className="saved-link-source">
          <Youtube size={16} aria-hidden="true" /> YouTube
          <span>{sample.length}</span>
        </div>
        <div className="saved-link-thumbnail">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/landing/llm-video.webp"
            width={960}
            height={540}
            alt="Andrej Karpathy’s Intro to Large Language Models video thumbnail"
          />
          <span className="saved-link-play" aria-hidden="true">
            <Play size={22} fill="currentColor" />
          </span>
        </div>
        <p className="saved-link-caption">
          <b>{sample.title}</b>
          {sample.author}
        </p>
      </div>
    );
  }
  if (sample.id === "post") {
    return (
      <div className="saved-link-cover saved-link-post">
        <div className="saved-link-source">
          <MessageCircle size={16} aria-hidden="true" /> X / Twitter
          <span>{sample.length}</span>
        </div>
        <div className="saved-link-author">
          <span aria-hidden="true">JC</span>
          <div>
            <strong>James Clear</strong>
            <small>@JamesClear</small>
          </div>
        </div>
        <blockquote>
          “You do not rise to the level of your goals. You fall to the level of
          your systems.”
        </blockquote>
      </div>
    );
  }
  return (
    <div className="saved-link-cover saved-link-article">
      <div className="saved-link-source">
        <FileText size={16} aria-hidden="true" /> paulgraham.com
        <span>{sample.length}</span>
      </div>
      <span className="saved-link-byline">Paul Graham / Essays</span>
      <p className="saved-link-editorial-title">
        How to Do
        <br />
        Great Work
      </p>
      <blockquote>“Curiosity is the best guide.”</blockquote>
    </div>
  );
}
