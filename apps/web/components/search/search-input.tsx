"use client";

import * as React from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps {
  defaultValue?: string;
  isSearching?: boolean;
  onSearch: (query: string) => void;
}

export function SearchInput({
  defaultValue = "",
  isSearching = false,
  onSearch,
}: SearchInputProps) {
  const [value, setValue] = React.useState(defaultValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSearch(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (value.trim()) {
        onSearch(value.trim());
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <div className="relative">
        {isSearching ? (
          <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        ) : (
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        )}
        <Input
          type="text"
          placeholder="Ask a question about your bookmarks..."
          aria-label="Search bookmarks"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="pl-12 pr-4 h-14 text-lg rounded-xl border-gray-200 dark:border-gray-800 focus-visible:ring-2 focus-visible:ring-primary"
          autoFocus
        />
      </div>
    </form>
  );
}
