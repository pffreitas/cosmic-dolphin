"use client";

import { LogOut, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { User as SupabaseUser } from "@supabase/auth-js";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions";

interface MobileHeaderProps {
  isLoggedIn?: boolean;
}

export function MobileHeader({
  isLoggedIn: initialLoggedIn,
}: MobileHeaderProps) {
  const isMobile = useIsMobile();
  const [user, setUser] = useState<SupabaseUser | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const { name, email, pictureUrl, initials } = useMemo(() => {
    if (!user) return { name: "", email: "", pictureUrl: undefined, initials: "" };
    const n =
      user.user_metadata?.full_name ??
      user.user_metadata?.name ??
      user.email?.split("@")[0] ??
      "";
    const e = user.email ?? "";
    const p = user.user_metadata?.avatar_url ?? user.user_metadata?.picture;
    const i = (n || e)
      .split(/[\s@]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s: string) => s[0].toUpperCase())
      .join("");
    return { name: n, email: e, pictureUrl: p, initials: i };
  }, [user]);

  if (!isMobile) return null;

  const isAuthenticated = user !== null || initialLoggedIn;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-gray-100 md:hidden">
      <div className="flex items-center justify-between px-4 h-16">
        <Link href="/" className="flex items-center gap-2">
          <div className="text-xl">🐬</div>
          <h1 className="font-noto text-base font-medium text-gray-800 dark:text-gray-200">
            Cosmic Dolphin
          </h1>
        </Link>

        <div className="flex items-center gap-2">
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Search bookmarks"
              className="w-10 h-10 rounded-full bg-white/50 dark:bg-stone-800/50 backdrop-blur-sm shadow-sm cursor-pointer"
            >
              <Search size={18} className="text-gray-700 dark:text-gray-300" />
            </Button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Profile menu"
                  className="cursor-pointer rounded-full ring-offset-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Avatar className="h-9 w-9 shadow-sm">
                    <AvatarImage src={pictureUrl} alt={name} />
                    <AvatarFallback className="text-xs font-medium bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm font-medium leading-none">{name}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <Link href="/my/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild className="cursor-pointer">
                  <form action={signOutAction} className="w-full">
                    <button
                      type="submit"
                      className="flex w-full items-center"
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign out
                    </button>
                  </form>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/sign-in">
              <Button
                variant="ghost"
                size="sm"
                aria-label="Sign in"
                className="w-10 h-10 rounded-full bg-white/50 dark:bg-stone-800/50 backdrop-blur-sm border border-gray-200 dark:border-stone-700 shadow-sm cursor-pointer"
              >
                <User size={18} className="text-gray-700 dark:text-gray-300" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
