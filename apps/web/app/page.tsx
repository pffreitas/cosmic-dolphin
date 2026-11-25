import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowDownRight } from "lucide-react";

import { homepage, searchDescription, searchTitle, siteName } from "@/lib/landing-seo";
import { LandingSignupButton } from "@/components/marketing/landing-analytics";
import { Brandmark } from "@/components/brand/logo";
import { FormatStudio, SampleLibrary, SampleSave } from "@/components/marketing/sample-save";
import styles from "@/components/marketing/landing.module.css";
import { SkipLink } from "@/components/shell/app-shell";
import { PublicHeader } from "@/components/shell/public-header";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";

const shareImage = new URL("reading/bookmark-manager.jpg", homepage).href;
const imageAlt = "Cosmic Dolphin — Close the tabs. Keep the ideas.";

export const metadata: Metadata = {
  title: searchTitle,
  description: searchDescription,
  alternates: { canonical: homepage },
  openGraph: {
    type: "website", url: homepage, siteName, title: searchTitle, description: searchDescription,
    images: [{ url: shareImage, width: 1200, height: 630, alt: imageAlt }],
  },
  twitter: {
    card: "summary_large_image", title: searchTitle, description: searchDescription,
    images: [{ url: shareImage, alt: imageAlt }],
  },
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: siteName,
  url: homepage,
};

export default async function Index() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/my/dashboard");

  return (
    <div className={styles.page}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }} />
      <SkipLink />
      <PublicHeader action={
        <>
          <Button variant="ghost" asChild className="hidden min-h-11 md:inline-flex"><a href="#knowledge">How it works</a></Button>
          <Button variant="ghost" asChild className="hidden min-h-11 sm:inline-flex"><a href="#formats">Formats</a></Button>
          <Button variant="ghost" asChild className="min-h-11"><Link href="/sign-in">Sign in</Link></Button>
          <LandingSignupButton placement="header" className="min-h-11" />
        </>
      } />
      <main id="main" tabIndex={-1} className="outline-none">
        <section aria-labelledby="landing-title" className={styles.hero}>
          <Image src="/reading/earthrise.webp" width={1280} height={1280} priority sizes="100vw" className={styles.heroPhoto} alt="Earth seen over the lunar horizon from Apollo 8." />
          <div className={styles.heroInner}>
            <h1 id="landing-title">Close the tabs.<br />Keep the ideas.</h1>
            <p>Bookmark any link with Cosmic Dolphin. Get the key ideas, find them again in your own words, and explore them in the format that suits you.</p>
            <div className={styles.actions}>
              <LandingSignupButton placement="hero" className={styles.whiteButton} />
              <Button variant="ghost" size="lg" asChild className={styles.heroLink}><a href="#knowledge">Try a sample <ArrowDownRight aria-hidden /></a></Button>
            </div>
          </div>
          <span className={styles.heroCredit}>Earthrise, 1968 · Bill Anders / NASA</span>
        </section>

        <section id="knowledge" className={styles.chapter}>
          <div className={styles.copy}>
            <h2>Take the idea<br />with you.</h2>
            <p>Somewhere in that long article is the thing you wanted to remember. Save the link and Cosmic pulls the key points into a short brief, with the original a click away.</p>
          </div>
          <SampleSave />
        </section>

        <section id="library" className={styles.libraryBand}>
          <div className={styles.chapter}>
            <div className={styles.copy}>
              <h2>Remember a detail.<br />Find the whole thing.</h2>
              <p>Close the tab. Your save has a place in your private library. Search for the bit that stuck with you, or browse the collections Cosmic suggests. You can change the filing at any time.</p>
            </div>
            <SampleLibrary />
          </div>
        </section>

        <section id="formats" className={styles.studio}>
          <div className={styles.studioIntro}>
            <h2>One idea.<br />Four ways in.</h2>
            <p>Look closely at a photograph. Listen on a walk. Watch the moment unfold, or trace it in a diagram. Try each format with the same saved article.</p>
          </div>
          <FormatStudio />
        </section>

        <section className={styles.closing}>
          <h2>Which tab are you<br />keeping open?</h2>
          <p>Give the idea a place in your library.</p>
          <LandingSignupButton placement="closing" className="min-h-12" />
        </section>
      </main>
      <footer className={styles.footer}><Brandmark /><span>© {new Date().getFullYear()} Cosmic Dolphin</span></footer>
    </div>
  );
}
