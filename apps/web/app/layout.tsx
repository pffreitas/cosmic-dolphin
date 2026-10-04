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
import { ToastProvider } from "@/components/ui/toast";
import { BottomNavigation } from "@/components/mobile/bottom-nav";
import { createClient } from "@/utils/supabase/server";
import { BookmarksAPI, CollectionsAPI } from "@/lib/api/bookmarks";
import { HandleClaimPrompt } from "@/components/social/handle-claim-prompt";

/**
 * The root frame.
 *
 * This reads the session and the sidebar's data on the server, then hands
 * both to `AppChrome`, which picks the frame by route: the signed-in app shell
 * (sidebar + top bar), the public header, or nothing for routes that draw
 * their own (landing, auth, the dev galleries). See
 * docs/design-system/patterns.md § App shell.
 *
 * There is exactly one <main> in the document and one copy of the page. The
 * pre-revamp layout mounted every page twice (one tree per breakpoint); that is
 * why responsiveness lives inside the frame and never in a second render.
 */

// The two voices. Signal's token file stays authoritative: next/font only fills
// in --cd-font-sans / --cd-font-serif with the locally hosted faces.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--cd-font-sans",
});

// Variable, with the optical-size axis: the same family draws a tighter,
// higher-contrast cut at display sizes and a sturdier one at 17px, which is
// what lets one serif carry both a 44px detail title and a library row.
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  axes: ["opsz"],
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
  const shellUser = user
    ? {
        name:
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          "You",
        email: user.email ?? null,
        avatarUrl:
          user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
        href: "/my/profile",
      }
    : undefined;

  // The sidebar's Library and collections. Both reads fail soft — an empty
  // tree and dashed counts — so a slow API dims the sidebar, never the page.
  // A layout is not re-rendered on client navigation, so these run on a hard
  // load and on `router.refresh()` (which every Library write already calls,
  // and which is what keeps the counts honest after a refile).
  const [collections, counts] = isLoggedIn
    ? await Promise.all([CollectionsAPI.list(), BookmarksAPI.counts()])
    : [[], null];

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
            the omnibox's save — lives in the header, above every route.
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
                  <AppChrome
                    isLoggedIn={isLoggedIn}
                    user={shellUser}
                    collections={collections}
                    counts={counts}
                  >
                    {children}
                  </AppChrome>

                  {/* Home, Library, Save, Search, You — touch only. */}
                  {isLoggedIn && <BottomNavigation />}

                  <HandleClaimPrompt isLoggedIn={isLoggedIn} />

                  {/*
                    The Save a link dialog, without a trigger of its own: the
                    omnibox saves directly, and the tab bar's Save and the
                    omnibox's *Behind a login* open it (lib/chrome-actions.ts).
                  */}
                  {isLoggedIn && <NewBookmarkButton showTrigger={false} />}

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
