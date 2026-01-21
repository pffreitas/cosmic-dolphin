"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Plus, Compass } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomNavItem {
  icon: React.ReactNode;
  label: string;
  href: string;
  isActive?: (pathname: string) => boolean;
}

const navItems: BottomNavItem[] = [
  {
    icon: <Home size={20} />,
    label: "Home",
    href: "/my/dashboard",
    isActive: (pathname) => pathname === "/my/dashboard" || pathname === "/",
  },
  {
    icon: <Library size={20} />,
    label: "Library",
    href: "/my/library",
    isActive: (pathname) => pathname === "/my/library",
  },
  {
    icon: <Plus size={20} />,
    label: "Add",
    href: "/add", // This will trigger the new bookmark modal
    isActive: () => false,
  },
  {
    icon: <Compass size={20} />,
    label: "Explore",
    href: "/explore",
    isActive: (pathname) => pathname === "/explore",
  },
];

export function BottomNavigation() {
  const pathname = usePathname();

  const handleAddClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // Trigger the new bookmark button functionality
    const newBookmarkButton = document.getElementById("new-bookmark-button");
    if (newBookmarkButton) {
      newBookmarkButton.click();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white m-4 shadow-lg rounded-full md:hidden safe-area-pb">
      <nav className="flex items-center justify-around px-4 py-2">
        {navItems.map((item) => {
          const isActive = item.isActive?.(pathname) || false;
          const isAddButton = item.label === "Add";

          if (isAddButton) {
            return (
              <button
                key={item.label}
                onClick={handleAddClick}
                className="flex flex-col items-center justify-center py-2 px-3 min-w-0 flex-1"
              >
                <div
                  className={cn(
                    "flex items-center justify-center w-6 h-6 mb-1",
                    "text-gray-600"
                  )}
                >
                  {item.icon}
                </div>
                <span className="text-xs text-gray-600 font-medium">
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.label}
              href={item.href}
              className="flex flex-col items-center justify-center py-2 px-3 min-w-0 flex-1"
            >
              <div
                className={cn(
                  "flex items-center justify-center w-4 h-4 mb-1",
                  isActive ? "text-blue-600" : "text-gray-600"
                )}
              >
                {item.icon}
              </div>
              <span
                className={cn(
                  "text-xs font-medium",
                  isActive ? "text-blue-600" : "text-gray-600"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
