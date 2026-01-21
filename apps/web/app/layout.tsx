import HeaderAuth from "@/components/header-auth";
import { GeistSans } from "geist/font/sans";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import Body from "./body";
import ReduxProvider from "@/components/providers/redux-provider";
import { CommandDialogProvider } from "@/components/providers/command-dialog-provider";
import { GlobalCommandDialog } from "@/components/global-command-dialog";
import { GlobalKeyboardShortcuts } from "@/components/global-keyboard-shortcuts";
import { CommandDialogTrigger } from "@/components/command-dialog-trigger";
import Link from "next/link";
import { CosmicMenu } from "@/components/cosmic-menu";
import NewBookmarkButton from "@/components/bookmark/new-bookmark";
import { MobileHeader } from "@/components/mobile/mobile-header";
import { BottomNavigation } from "@/components/mobile/bottom-nav";
import { createClient } from "@/utils/supabase/server";

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
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Karla:ital,wght@0,200..800;1,200..800&family=Noto+Sans:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background bg-gray-50 text-foreground">
        <ReduxProvider>
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
                    <div className="flex gap-6">
                      <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-3">
                        <div className="flex items-center justify-between gap-4 h-10">
                          <div className="flex-1 flex">
                            <Link href="/" className="flex gap-2 items-center">
                              <div className="text-2xl">🐬</div>
                              <div
                                className={`transition-all duration-300 ease-in-out overflow-hidden ${"w-auto opacity-100"}`}
                              >
                                <h2 className="font-noto text-lg font-normal text-gray-800 whitespace-nowrap">
                                  Cosmic Dolphin
                                </h2>
                              </div>
                            </Link>
                            {isLoggedIn && <CosmicMenu />}
                          </div>
                          {isLoggedIn && (
                            <div className="flex-1 flex justify-end">
                              <div className="flex items-center gap-3">
                                <CommandDialogTrigger />
                                <NewBookmarkButton />
                              </div>
                            </div>
                          )}
                          <div className="flex items-center space-x-2">
                            <HeaderAuth />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 max-w-screen-lg mx-auto">
                      {children}
                    </div>
                    <div className="h-2"></div>
                  </div>
                </main>

                {/* Mobile Layout */}
                <main className="md:hidden flex flex-col min-h-screen">
                  {/* Content area with padding for fixed header and bottom nav */}
                  <div className={`flex-1 pt-20 ${isLoggedIn ? 'pb-28' : 'pb-8'} px-4`}>
                    <div className="max-w-screen-sm mx-auto">{children}</div>
                  </div>
                </main>

                {/* Mobile Bottom Navigation - Only show when logged in */}
                {isLoggedIn && <BottomNavigation />}

                {/* Global Command Dialog - Desktop Only */}
                <GlobalCommandDialog />
                <GlobalKeyboardShortcuts />
              </ThemeProvider>
            </Body>
          </CommandDialogProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
