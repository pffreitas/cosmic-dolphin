"use client";

import { Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { createClient } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
import { User as SupabaseUser } from "@supabase/auth-js";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/actions";

interface MobileHeaderProps {
  isLoggedIn?: boolean;
}

export function MobileHeader({ isLoggedIn: initialLoggedIn }: MobileHeaderProps) {
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

  if (!isMobile) return null;

  // Use client-side user state if available, fallback to server prop
  const isAuthenticated = user !== null || initialLoggedIn;

  return (
    <div className="fixed top-0 left-0 right-0 z-40 backdrop-blur-md border-gray-100 md:hidden">
      <div className="flex items-center justify-between px-4 h-16">
        {/* Left - Cosmic Dolphin branding */}
        <Link href="/" className="flex items-center gap-2">
          <div className="text-xl">🐬</div>
          <h1 className="font-noto text-base font-medium text-gray-800">
            Cosmic Dolphin
          </h1>
        </Link>

        {/* Right - Search and Profile icons */}
        <div className="flex items-center gap-2">
          {/* Only show search when logged in */}
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-sm  shadow-lg"
            >
              <Search size={18} className="text-gray-700" />
            </Button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-sm shadow-lg"
                >
                  <User size={18} className="text-gray-700" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="rounded-lg bg-white shadow-lg p-4 border border-gray-200 flex flex-col gap-2">
                  <Link
                    href="/my/profile"
                    className="text-sm text-gray-700 hover:text-gray-900"
                  >
                    {user.email}
                  </Link>
                  <form action={signOutAction}>
                    <Button
                      type="submit"
                      size="sm"
                      variant="outline"
                      className="w-full"
                    >
                      Sign out
                    </Button>
                  </form>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/sign-in">
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 rounded-full bg-white/50 backdrop-blur-sm border border-gray-200 shadow-sm"
              >
                <User size={18} className="text-gray-700" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
