import HeaderAuth from "@/components/header-auth";
import { Inter, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Body from "./body";
import ReduxProvider from "@/components/providers/redux-provider";
import { CommandDialogProvider } from "@/components/providers/command-dialog-provider";
import { GlobalCommandDialog } from "@/components/global-command-dialog";
import { GlobalKeyboardShortcuts } from "@/components/global-keyboard-shortcuts";
import { CommandDialogTrigger } from "@/components/command-dialog-trigger";
import { CosmicMenu } from "@/components/cosmic-menu";
import NewBookmarkButton from "@/components/bookmark/new-bookmark";
import { PendingCaptures } from "@/components/bookmark/pending-captures";
import { ToastProvider } from "@/components/ui/toast";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { BottomNavigation } from "@/components/mobile/bottom-nav";
import { createClient } from "@/utils/supabase/server";
import { DesktopSiteHeader } from "@/components/desktop-site-header";
import { HandleClaimPrompt } from "@/components/social/handle-claim-prompt";

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
                  {/* Mobile Header */}
                  <MobileHeader isLoggedIn={isLoggedIn} />

                  {/* Desktop Layout */}
                  <main className="hidden md:flex w-full h-full p-2">
                    <div className="w-full mx-auto flex flex-col gap-6">
                      <DesktopSiteHeader
                        isLoggedIn={isLoggedIn}
                        authenticatedNavigation={
                          isLoggedIn ? <CosmicMenu /> : undefined
                        }
                        authenticatedActions={
                          isLoggedIn ? (
                            <div className="flex items-center gap-3">
                              <CommandDialogTrigger />
                              <NewBookmarkButton />
                            </div>
                          ) : undefined
                        }
                        authControls={<HeaderAuth />}
                      />
                      <div className="flex-1 max-w-screen-lg mx-auto">
                        {/*
                          The optimistic capture row. It sits above the page
                          because Save a link is in the header and works from
                          every route — the row has to appear wherever the paste
                          happened. It renders nothing when nothing is in flight.
                        */}
                        {isLoggedIn && <PendingCaptures />}
                        {children}
                      </div>
                      <div className="h-2"></div>
                    </div>
                  </main>

                  {/* Mobile Layout!! */}
                  <main className="md:hidden flex flex-col min-h-screen">
                    {/* Content area with padding for fixed header and bottom nav */}
                    <div className={`flex-1 pt-20 ${isLoggedIn ? 'pb-28' : 'pb-8'} px-4`}>
                      <div className="max-w-screen-sm mx-auto">
                        {isLoggedIn && <PendingCaptures />}
                        {children}
                      </div>
                    </div>
                  </main>

                  {/* Mobile Bottom Navigation - Only show when logged in */}
                  {isLoggedIn && <BottomNavigation />}

                  {/*
                    Outside both <main>s, which each render {children}. This
                    one has to appear exactly once — a dialog rendered twice is
                    two overlays, two focus traps and one very confused user.
                  */}
                  <HandleClaimPrompt isLoggedIn={isLoggedIn} />

                  {/* Global Command Dialog - Desktop Only */}
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
