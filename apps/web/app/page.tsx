import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Lock, Quote, Target } from "lucide-react";

import { Brandmark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SkipLink } from "@/components/shell/app-shell";
import { PublicHeader } from "@/components/shell/public-header";
import {
  BriefVignette,
  CaptureVignette,
  FilingVignette,
  LibraryVignette,
} from "@/components/marketing/vignettes";
import { createClient } from "@/utils/supabase/server";

/**
 * `/` — the signed-out door, and a redirect for everybody else.
 *
 * A signed-in reader never sees it. Home is the product; a marketing page in
 * front of it for somebody who already has an account is a page they have to
 * click through every time they type the bare domain.
 *
 * The page makes one argument in four beats — save, brief, filing, and the
 * principles behind them — and illustrates each with the product's own
 * components (components/marketing/vignettes.tsx), so what it shows is what
 * you get. It draws its own frame: `AppChrome` treats `/` as bare.
 */
export default async function Index() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/my/dashboard");

  return (
    <>
      <SkipLink />
      <PublicHeader />

      <main id="main" tabIndex={-1} className="outline-none">
        <Hero />
        <Features />
        <Principles />
        <Closing />
      </main>

      <SiteFooter />
    </>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">

      <div className="mx-auto flex max-w-[1200px] flex-col items-center px-4 pt-16 text-center sm:px-6 md:pt-24">
        <span className="inline-flex items-center rounded-pill border border-line bg-bg-subtle px-3 py-1.5 font-sans text-[12.5px] font-medium leading-none text-fg-secondary">
          Summaries that name their sources
        </span>

        <h1 className="mt-6 font-serif text-[44px] font-semibold leading-[1.04] tracking-[-.03em] text-fg sm:text-[56px] lg:text-[68px]">
          Save a link.
          <br />
          <span className="text-fg-secondary">Get it back when it matters.</span>
        </h1>

        <p className="mt-6 max-w-[54ch] font-sans text-[17px] leading-[1.6] text-fg-secondary sm:text-[18px]">
          Cosmic Dolphin reads what you save, summarises it, files it, and puts
          it in front of you again when it&apos;s useful. A calm library for
          everything you meant to read.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Button variant="primary" size="lg" asChild>
            <Link href="/sign-up">
              Start your library
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="secondary" size="lg" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </div>

      <div className="mx-auto mt-16 max-w-[1160px] px-4 sm:px-6 md:mt-20">
        <div className="[mask-image:linear-gradient(to_bottom,black_62%,transparent)]">
          <LibraryVignette />
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    kicker: "Capture",
    title: "Paste once. It’s handled.",
    body: "Drop any link into the omnibox. It becomes a row in your library straight away, and you can watch it being read, summarised and filed — no spinner, no waiting room, no fake percentage.",
    Vignette: CaptureVignette,
  },
  {
    kicker: "Cosmic brief",
    title: "A summary you can check.",
    body: "Every brief is a few sentences and the points worth keeping, and every one names the page it was written from. When a summary can’t be trusted, it says so instead of guessing.",
    Vignette: BriefVignette,
  },
  {
    kicker: "Filing",
    title: "Filed for you. Overruled by you.",
    body: "As your library grows, Cosmic proposes collections for what belongs together. Rename them, drag a save somewhere else, and it stays where you put it — nothing you filed by hand gets moved again.",
    Vignette: FilingVignette,
  },
] as const;

function Features() {
  return (
    <section
      aria-labelledby="features-heading"
      className="border-t border-line bg-bg-subtle py-20 md:py-28"
    >
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6">
        <div className="max-w-[640px]">
          <p className="font-sans text-[13.5px] font-semibold text-accent">How it works</p>
          <h2
            id="features-heading"
            className="mt-3 font-serif text-[34px] font-semibold leading-[1.1] tracking-[-.025em] text-fg md:text-[44px]"
          >
            A quiet layer between you and everything you meant to read.
          </h2>
        </div>

        <div className="mt-16 flex flex-col gap-20 md:mt-20 md:gap-28">
          {FEATURES.map(({ kicker, title, body, Vignette }, index) => (
            <div
              key={kicker}
              className="grid items-center gap-10 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-16"
            >
              <div className={index % 2 === 1 ? "md:order-2" : undefined}>
                <p className="font-sans text-[13px] font-semibold text-fg-tertiary">
                  <span className="nums text-accent">0{index + 1}</span>
                  <span aria-hidden="true"> · </span>
                  {kicker}
                </p>
                <h3 className="mt-3 font-serif text-[28px] font-semibold leading-[1.15] tracking-[-.02em] text-fg">
                  {title}
                </h3>
                <p className="mt-4 max-w-[46ch] font-sans text-[15.5px] leading-[1.65] text-fg-secondary">
                  {body}
                </p>
              </div>
              <Vignette className="w-full" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const PRINCIPLES = [
  {
    Icon: Target,
    title: "Ranked for usefulness",
    body: "Home orders what you’re likely to finish and come back to — never what’s most liked.",
  },
  {
    Icon: Lock,
    title: "Your library is yours",
    body: "No likes, counts or audience on what you save. Share a single save when you choose to.",
  },
  {
    Icon: Quote,
    title: "Sources, always",
    body: "Nothing Cosmic writes ships without naming where it came from, one click from the original.",
  },
] as const;

function Principles() {
  return (
    <section aria-labelledby="principles-heading" className="py-20 md:py-28">
      <div className="mx-auto grid max-w-[1120px] gap-12 px-4 sm:px-6 md:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] md:gap-16">
        <h2
          id="principles-heading"
          className="font-serif text-[32px] font-semibold leading-[1.12] tracking-[-.022em] text-fg md:text-[38px]"
        >
          Built to be finished, not scrolled.
        </h2>
        <dl className="m-0 flex flex-col divide-y divide-line border-y border-line">
          {PRINCIPLES.map(({ Icon, title, body }) => (
            <div key={title} className="grid gap-2 py-6 sm:grid-cols-[220px_minmax(0,1fr)] sm:gap-8">
              <dt className="flex items-center gap-2.5 font-sans text-[15px] font-semibold text-fg">
                <Icon aria-hidden="true" className="size-[18px] text-accent [stroke-width:1.7]" />
                {title}
              </dt>
              <dd className="m-0 font-sans text-[15px] leading-[1.6] text-fg-secondary">{body}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section className="px-4 pb-20 sm:px-6 md:pb-28">
      <div className="relative isolate mx-auto max-w-[1120px] overflow-hidden rounded-lg border border-line bg-bg-subtle px-6 py-14 text-center md:py-20">
        <h2 className="mx-auto max-w-[18ch] font-serif text-[32px] font-semibold leading-[1.1] tracking-[-.022em] text-fg md:text-[44px]">
          Start the library you’ll actually read.
        </h2>
        <p className="mx-auto mt-4 max-w-[48ch] font-sans text-[16px] leading-[1.6] text-fg-secondary">
          Paste your first link. Everything after that, Cosmic handles.
        </p>
        <div className="mt-8 flex justify-center">
          <Button variant="primary" size="lg" asChild>
            <Link href="/sign-up">
              Create your account
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
        <Brandmark />
        <nav aria-label="Footer" className="flex items-center gap-1">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sign-up">Create an account</Link>
          </Button>
        </nav>
        <p className="nums w-full font-sans text-[12.5px] text-fg-tertiary sm:w-auto">
          © {new Date().getFullYear()} Cosmic Dolphin
        </p>
      </div>
    </footer>
  );
}
