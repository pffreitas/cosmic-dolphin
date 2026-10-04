import { Brandmark } from "@/components/brand/logo";
import { SkipLink } from "@/components/shell/app-shell";
import { BriefVignette } from "@/components/marketing/vignettes";

/**
 * Auth — docs/design-system/pages.md § Auth.
 *
 * A split screen. The form column on the left: brandmark top-left, the form
 * centred at 380px, a quiet footer. On the right, from 1024px, a showcase panel
 * on `--cd-bg-subtle` holding a real Cosmic brief — the product's most
 * characteristic output, rendered by its own component — and one sentence on
 * what the account is for.
 *
 * `AppChrome` treats these routes as bare, so this layout draws the whole
 * frame. It is in the flow, not a `fixed inset-0` takeover, and every colour
 * comes from the token set, so dark mode is a dark page and not a white one.
 */
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <SkipLink />
      <div className="flex flex-col px-5 py-5 sm:px-10 sm:py-8">
        <Brandmark />
        <main
          id="main"
          tabIndex={-1}
          className="flex flex-1 items-center justify-center py-12 outline-none"
        >
          <div className="w-full max-w-[380px]">{children}</div>
        </main>
        <p className="nums font-sans text-[12.5px] text-fg-tertiary">
          © {new Date().getFullYear()} Cosmic Dolphin
        </p>
      </div>

      <aside
        aria-label="What Cosmic Dolphin does"
        className="relative isolate hidden overflow-hidden border-l border-line bg-bg-subtle lg:flex lg:flex-col lg:justify-center lg:px-14 xl:px-20"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(70%_55%_at_70%_20%,var(--cd-ai-glow),transparent_70%)]"
        />
        <div className="mx-auto flex w-full max-w-[520px] flex-col gap-10">
          <BriefVignette />
          <div className="flex flex-col gap-3">
            <p className="font-serif text-[26px] font-semibold leading-[1.2] tracking-[-.02em] text-fg">
              Everything you meant to read, summarised, filed, and back in
              front of you when it matters.
            </p>
            <p className="font-sans text-[14px] leading-[1.6] text-fg-secondary">
              Every summary names its source. Every collection is yours to
              override.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
