import { Inter, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Body from "./body";
import ReduxProvider from "@/components/providers/redux-provider";
import { CommandDialogProvider } from "@/components/providers/command-dialog-provider";
import { GlobalCommandDialog } from "@/components/global-command-dialog";
import { GlobalKeyboardShortcuts } from "@/components/global-keyboard-shortcuts";
import { AppChrome } from "@/components/app-chrome";
import NewBookmarkButton from "@/components/bookmark/new-bookmark";
import { PendingCaptures } from "@/components/bookmark/pending-captures";
import { ToastProvider } from "@/components/ui/toast";
import { BottomNavigation } from "@/components/mobile/bottom-nav";
import { createClient } from "@/utils/supabase/server";
import { HandleClaimPrompt } from "@/components/social/handle-claim-prompt";

/**
 * The app frame — D18, where the pre-revamp chrome was deleted.
 *
 * What used to be here: a `MobileHeader`, a `DesktopSiteHeader` wrapping a
 * `CosmicMenu` and a `HeaderAuth` dropdown, and **two `<main>` elements that
 * each rendered `{children}`** — one `hidden md:flex`, one `md:hidden`. Every
 * element in the app existed twice in the DOM, ids included, and every page
 * was mounted twice, which meant every page's effects ran twice and every
 * `getElementById` was a coin toss.
 *
 * There is now one `<main>`, one header, and one copy of the page. The header
 * capsule is responsive by itself (docs/design-system/patterns.md § Header
 * capsule): below 900px it collapses to a single column and squares off, and
 * the bottom tab bar takes over navigation on touch. Nothing is duplicated to
 * achieve that.
 */

// The two voices. Signal's token file stays authoritative: next/font only fills
// in --cd-font-sans / --cd-font-serif with the locally hosted faces.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--cd-font-sans",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--cd-font-serif",
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;

  // Read on the server, from the session that is already in hand. Deriving it
  // in the client from `onAuthStateChange` — which is what the old mobile
  // header did — means the header renders nameless, then re-renders with a
  // name, on every single navigation.
  const headerUser = user
    ? {
        name:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          "You",
        avatarUrl:
          user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        href: "/my/profile",
      }
    : undefined;

  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} font-sans`}
      suppressHydrationWarning
    >
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        {/* cd-tokens-allow: a meta tag cannot read a CSS custom property */}
        <meta name="theme-color" content="#ffffff" />
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-Z7RBS9TF0F"
        ></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-Z7RBS9TF0F');
        `,
          }}
        />
      </head>
      <body className="bg-bg text-fg">
        <ReduxProvider>
          {/*
            One <ToastProvider> for the whole app, inside the store so anything
            that can dispatch can also confirm what it did. It sits at the root
            rather than on a route group because the thing that toasts most —
            Save a link — lives in the header, above every route.
          */}
          <ToastProvider>
            <CommandDialogProvider>
              <Body>
                <ThemeProvider
                  attribute="class"
                  defaultTheme="light"
                  enableSystem
                  disableTransitionOnChange
                >
                  <div className="flex min-h-screen flex-col">
                    <AppChrome
                      isLoggedIn={isLoggedIn}
                      user={headerUser}
                      saveAction={isLoggedIn ? <NewBookmarkButton /> : undefined}
                    />

                    {/*
                      `pb-28` on touch clears the bottom tab bar, which floats
                      over the page rather than displacing it.
                    */}
                    <main
                      className={`flex-1 px-4 pb-8 md:px-6 ${
                        isLoggedIn ? "max-md:pb-28" : ""
                      }`}
                    >
                      <div className="mx-auto w-full max-w-screen-xl">
                        {/*
                          The optimistic capture row. It sits above the page
                          because Save a link is in the header and works from
                          every route — the row has to appear wherever the paste
                          happened. It renders nothing when nothing is in flight.
                        */}
                        {isLoggedIn && <PendingCaptures />}
                        {children}
                      </div>
                    </main>
                  </div>

                  {/* Home, Library, Save, Search, You — touch only. */}
                  {isLoggedIn && <BottomNavigation />}

                  <HandleClaimPrompt isLoggedIn={isLoggedIn} />

                  <GlobalCommandDialog />
                  <GlobalKeyboardShortcuts />
                </ThemeProvider>
              </Body>
            </CommandDialogProvider>
          </ToastProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
