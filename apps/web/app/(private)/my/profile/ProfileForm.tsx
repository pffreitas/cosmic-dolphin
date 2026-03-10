"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/utils/supabase/client";
import { Check, Loader2, Lock, User, Mail, AlertCircle } from "lucide-react";

interface Profile {
  id: string;
  name?: string;
  email?: string;
  pictureUrl?: string;
}

function getApiBasePath(): string {
  const basePath = process.env.NEXT_PUBLIC_API_URL;
  if (!basePath) {
    throw new Error("NEXT_PUBLIC_API_URL is not set.");
  }
  return basePath;
}

export function ProfileForm({ profile }: { profile: Profile }) {
  const [name, setName] = useState(profile.name ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasChanges = name !== (profile.name ?? "");

  const initials = (profile.name ?? profile.email ?? "?")
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0].toUpperCase())
    .join("");

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${getApiBasePath()}/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        throw new Error("Failed to update profile");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Avatar hero */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-gray-100 dark:border-stone-800 shadow-sm overflow-hidden">
        <div className="h-24 bg-gradient-to-br from-stone-100 to-stone-200 dark:from-stone-800 dark:to-stone-900" />
        <div className="px-6 pb-6 -mt-12 flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left gap-4">
          <Avatar className="h-24 w-24 ring-4 ring-white dark:ring-stone-900 shadow-sm">
            <AvatarImage src={profile.pictureUrl} alt={profile.name ?? ""} />
            <AvatarFallback className="text-2xl font-semibold bg-stone-200 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="pb-1">
            <h2 className="text-lg font-semibold text-foreground">
              {profile.name || "Your Profile"}
            </h2>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
      </div>

      {/* Personal information */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-gray-100 dark:border-stone-800 shadow-sm">
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-foreground">
            Personal Information
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Update your display name visible to others.
          </p>
        </div>
        <Separator />
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <User className="h-3.5 w-3.5" />
              Display name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (saved) setSaved(false);
                if (error) setError(null);
              }}
              placeholder="Your name"
              className="max-w-sm"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="cursor-pointer w-full sm:w-auto transition-colors duration-200"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save changes"
              )}
            </Button>

            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 animate-in fade-in duration-200">
                <Check className="h-4 w-4" />
                Saved successfully
              </span>
            )}
            {error && (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400 animate-in fade-in duration-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Account information */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-gray-100 dark:border-stone-800 shadow-sm">
        <div className="px-6 py-5">
          <h3 className="text-sm font-semibold text-foreground">Account</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Details managed by your authentication provider.
          </p>
        </div>
        <Separator />
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <Mail className="h-3.5 w-3.5" />
              Email address
            </Label>
            <div className="relative max-w-sm">
              <Input
                id="email"
                value={profile.email ?? ""}
                disabled
                className="pr-9"
              />
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            </div>
            <p className="text-xs text-muted-foreground">
              Contact your authentication provider to change this.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
