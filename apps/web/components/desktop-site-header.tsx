import Link from "next/link";
import type { ReactNode } from "react";

export const publicHeaderLinks = [
  { label: "Product", href: "#product" },
  { label: "Community", href: "#community" },
  { label: "Pricing", href: "#pricing" },
  { label: "Download", href: "#download" },
] as const;

export type DesktopSiteHeaderProps = {
  isLoggedIn: boolean;
  authenticatedNavigation?: ReactNode;
  authenticatedActions?: ReactNode;
  authControls: ReactNode;
};

export function DesktopSiteHeader({
  isLoggedIn,
  authenticatedNavigation,
  authenticatedActions,
  authControls,
}: DesktopSiteHeaderProps) {
  return (
    <div className="w-full px-4 pt-4">
      <header className="mx-auto flex min-h-20 max-w-[1400px] items-center rounded-[2rem] border border-white/70 bg-white/80 px-8 py-3 shadow-[0_18px_55px_rgba(15,23,42,0.14)] backdrop-blur-xl">
        <div className="flex min-w-0 flex-1 items-center">
          <Link
            href="/"
            aria-label="Cosmic Dolphin home"
            className="flex min-w-0 items-center whitespace-nowrap text-2xl font-black leading-none tracking-normal text-black"
          >
            Cosmic Dolphin
          </Link>
          {isLoggedIn && authenticatedNavigation}
        </div>

        {!isLoggedIn && (
          <nav
            aria-label="Primary"
            className="hidden flex-1 items-center justify-center gap-10 text-2xl font-normal text-black lg:flex"
          >
            {publicHeaderLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap transition-opacity hover:opacity-65"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex flex-1 items-center justify-end gap-4">
          {isLoggedIn ? (
            <>
              {authenticatedActions}
              {authControls}
            </>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="whitespace-nowrap text-2xl font-normal text-black transition-opacity hover:opacity-65"
              >
                Log in
              </Link>
              <Link
                href="/sign-up"
                className="whitespace-nowrap rounded-full bg-black px-7 py-3 text-xl font-bold leading-none text-white shadow-[inset_0_-1px_0_rgba(255,255,255,0.18)] transition-transform hover:scale-[1.015]"
              >
                Try Cosmic Dolphin
              </Link>
            </>
          )}
        </div>
      </header>
    </div>
  );
}
