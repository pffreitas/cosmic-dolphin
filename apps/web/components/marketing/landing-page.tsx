import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { LandingBrand, LandingBrandSignature } from "./landing-brand";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus-ring";
import { PublicHeader } from "@/components/shell/public-header";
import {
  CaptureVisual,
  EditionVisual,
  LibraryVisual,
} from "./landing-visuals";
import { ReadingDemo } from "./reading-demo";
import { readingSamples } from "./reading-samples";

function StartLink() {
  return (
    <Button variant="primary" size="lg" asChild>
      <Link href="/sign-up">
        Get started <ArrowRight aria-hidden="true" />
      </Link>
    </Button>
  );
}

/**
 * The order is the pitch: what it is and what you get (hero), why it exists,
 * then one benefit per section, each shown in the product's own components:
 * the brief, the morning edition, the Library.
 */
export function LandingPage() {
  return (
    <div className="landing">
      <a href="#main" className={`landing-skip ${focusRing}`}>
        Skip to content
      </a>
      {/* Header and footer sit on the logo's own ground, so they take the dark
          token set (`dark`) while the page between them stays light. */}
      <PublicHeader
        className="landing-header dark"
        brand={<LandingBrand />}
        action={
          <>
            <a className={`landing-nav-link ${focusRing}`} href="#how-it-works">
              How it works
            </a>
            <Link className={`landing-nav-link ${focusRing}`} href="/sign-in">
              Sign in
            </Link>
            <StartLink />
          </>
        }
      />
      <main id="main" tabIndex={-1}>
        <section
          className="landing-hero landing-wrap"
          aria-labelledby="hero-title"
        >
          <div className="landing-hero-copy">
            <h1 id="hero-title">
              Actually read
              <br />
              <span>what you save.</span>
            </h1>
            <p className="landing-lede">
              Save any article, video or post. Get the key ideas in a short,
              sourced brief, and the best of your saves back every morning.
            </p>
            <div className="landing-actions">
              <StartLink />
              <a
                className={`landing-text-link ${focusRing}`}
                href="#how-it-works"
              >
                See how it works
              </a>
            </div>
          </div>
          <CaptureVisual />
        </section>

        <section
          className="landing-problem landing-wrap"
          aria-labelledby="problem-title"
        >
          <h2 id="problem-title">Saving was never the problem.</h2>
          <p>
            The essay you meant to finish. The talk you bookmarked twice. The
            thread still open in a tab. Cosmic Dolphin is built for what
            happens after you save.
          </p>
        </section>

        <section
          id="how-it-works"
          className="landing-brief"
          aria-labelledby="brief-title"
        >
          <div className="landing-wrap">
            <div className="landing-section-heading">
              <h2 id="brief-title">
                Know what’s inside before you spend the hour.
              </h2>
              <p>
                Paste a link and it is saved at once. Moments later it has a
                brief: the main idea, the key points, and a way back to the
                source.
              </p>
            </div>
            <ReadingDemo />
          </div>
        </section>

        <section
          className="landing-feature landing-wrap"
          aria-labelledby="edition-title"
        >
          <div className="landing-feature-copy">
            <h2 id="edition-title">
              Every morning, the best of what you saved.
            </h2>
            <p>
              Home ranks your unread saves by what you are likely to finish and
              puts one first. Read it, skip it, or stop there.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" />
                Ordered for reading, not for scrolling
              </li>
              <li>
                <Check aria-hidden="true" />
                It tells you when you have reached the end
              </li>
            </ul>
          </div>
          <EditionVisual />
        </section>

        <section
          className="landing-feature landing-feature-flip landing-wrap"
          aria-labelledby="library-title"
        >
          <div className="landing-feature-copy">
            <h2 id="library-title">Find it again without filing a thing.</h2>
            <p>
              Every save is sorted into a collection for you and searchable by
              what it is about, not only by its title.
            </p>
            <ul>
              <li>
                <Check aria-hidden="true" />
                Search by meaning across everything you saved
              </li>
              <li>
                <Check aria-hidden="true" />
                Rename, move or overrule any suggestion
              </li>
            </ul>
          </div>
          <LibraryVisual />
        </section>

        <section className="landing-wrap" aria-label="What you can count on">
          <ul className="landing-principles">
            <li>
              <b>Private by default.</b>
              Your library is yours until you choose to share a save.
            </li>
            <li>
              <b>Sources always in view.</b>
              Every brief names what it was written from.
            </li>
            <li>
              <b>Built to be finished.</b>
              A place to stop, not another endless feed.
            </li>
          </ul>
        </section>

        <section
          className="landing-closing landing-wrap"
          aria-labelledby="closing-title"
        >
          <LandingBrandSignature />
          <h2 id="closing-title">
            Less later.
            <br />
            <span>More wonder.</span>
          </h2>
          <StartLink />
          <p>Cosmic Dolphin is in private launch.</p>
        </section>
      </main>
      <footer className="landing-footer dark">
        <div className="landing-wrap">
          <LandingBrand />
          <span>Made for the joy of finding out.</span>
          <details className="landing-photo-credits">
            <summary className={focusRing}>Example sources</summary>
            <p>
              {readingSamples.map((sample, index) => (
                <span key={sample.id}>
                  {index > 0 && " · "}
                  <a
                    className={focusRing}
                    href={sample.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {sample.author}
                  </a>
                </span>
              ))}
              . Video thumbnail from Andrej Karpathy’s YouTube video. Briefs are
              hand-written examples based on the linked sources.
            </p>
          </details>
        </div>
      </footer>
    </div>
  );
}
