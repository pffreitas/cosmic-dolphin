"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  Smile,
  User,
  Home,
  Bookmark,
  Search,
  Library,
  ExternalLink,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommandDialog } from "@/components/providers/command-dialog-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  searchBookmarks,
  clearSearchResults,
  setSearchQuery,
} from "@/lib/store/slices/bookmarksSlice";

export function GlobalCommandDialog() {
  const { open, setOpen } = useCommandDialog();
  const isMobile = useIsMobile();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const { searchResults, searchLoading, searchQuery } = useAppSelector(
    (state) => state.bookmarks
  );

  const [inputValue, setInputValue] = React.useState("");
  const [isModifierPressed, setIsModifierPressed] = React.useState(false);
  const debouncedSearchTerm = useDebounce(inputValue, 300);

  // Perform search when debounced term changes
  React.useEffect(() => {
    if (debouncedSearchTerm.trim() && open) {
      dispatch(setSearchQuery(debouncedSearchTerm));
      dispatch(
        searchBookmarks({
          query: debouncedSearchTerm,
          limit: 10,
        })
      );
    } else if (!debouncedSearchTerm.trim()) {
      dispatch(clearSearchResults());
    }
  }, [debouncedSearchTerm, dispatch, open]);

  // Clear search when dialog closes
  React.useEffect(() => {
    if (!open) {
      setInputValue("");
      dispatch(clearSearchResults());
      setIsModifierPressed(false);
    }
  }, [open, dispatch]);

  // Track modifier key state when dialog is open
  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey) {
        setIsModifierPressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) {
        setIsModifierPressed(false);
      }
    };

    // Also handle when focus leaves the window
    const handleBlur = () => {
      setIsModifierPressed(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [open]);

  const handleBookmarkSelect = (bookmarkId: string, sourceUrl?: string) => {
    return () => {
      setOpen(false);

      // Check if Command/Ctrl key is pressed
      if (isModifierPressed && sourceUrl) {
        // Open source URL in new tab and focus it
        const newWindow = window.open(sourceUrl, "_blank");
        if (newWindow) {
          newWindow.focus();

          // Additional focus attempts
          setTimeout(() => newWindow.focus(), 100);
          setTimeout(() => newWindow.focus(), 250);
          setTimeout(() => newWindow.focus(), 500);
        }
      } else {
        // Navigate to bookmark page
        router.push(`/bookmarks/${bookmarkId}`);
      }
    };
  };

  const handleNavigationSelect = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  // Don't render on mobile
  if (isMobile) {
    return null;
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
      <CommandInput
        placeholder="Search bookmarks or navigate..."
        value={inputValue}
        onValueChange={setInputValue}
      />
      <CommandList>
        {/* Search Results - Show at top when available */}
        {searchResults.length > 0 && (
          <CommandGroup heading="Search Results">
            {searchResults.map((bookmark) => (
              <CommandItem
                key={bookmark.id}
                onSelect={handleBookmarkSelect(bookmark.id, bookmark.sourceUrl)}
              >
                <Bookmark className="mr-2 h-4 w-4" />
                <div className="flex-1">
                  <div className="font-medium">
                    {bookmark.title || "Untitled"}
                  </div>
                  {bookmark.sourceUrl && (
                    <div className="text-xs text-muted-foreground truncate">
                      {bookmark.sourceUrl}
                    </div>
                  )}
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    ⌘↵ to open
                  </span>
                  <ExternalLink className="h-3 w-3" />
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Show loading state */}
        {searchLoading && inputValue.trim() && (
          <CommandGroup heading="Searching...">
            <CommandItem disabled>
              <Search className="mr-2 h-4 w-4 animate-spin" />
              <span>Searching bookmarks...</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Show empty state when search has no results */}
        {!searchLoading && inputValue.trim() && searchResults.length === 0 && (
          <CommandGroup heading="No Results">
            <CommandItem disabled>
              <Search className="mr-2 h-4 w-4" />
              <span>No bookmarks found for "{inputValue}"</span>
            </CommandItem>
          </CommandGroup>
        )}

        {/* Separator between search results and navigation */}
        {(searchResults.length > 0 ||
          (searchLoading && inputValue.trim()) ||
          (!searchLoading &&
            inputValue.trim() &&
            searchResults.length === 0)) && <CommandSeparator />}

        {/* Static Navigation Commands */}
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => handleNavigationSelect("/")}>
            <Home className="mr-2 h-4 w-4" />
            <span>Home</span>
            <CommandShortcut>⌘H</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigationSelect("/my/dashboard")}>
            <User className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
            <CommandShortcut>⌘D</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigationSelect("/my/library")}>
            <Library className="mr-2 h-4 w-4" />
            <span>Library</span>
            <CommandShortcut>⌘L</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigationSelect("/explore")}>
            <Search className="mr-2 h-4 w-4" />
            <span>Explore</span>
            <CommandShortcut>⌘E</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => handleNavigationSelect("/my/profile")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Profile</span>
            <CommandShortcut>⌘P</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
