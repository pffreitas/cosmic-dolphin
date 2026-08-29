"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { Loader2 } from "lucide-react";

/**
 * The handle claim prompt.
 *
 * Existing accounts were given a working handle by D11's migration, reserved
 * from their email local part, so `/u/{handle}` and `/my/profile` never broke.
 * What they were not given is a *choice*. This asks for it once.
 *
 * "Once" means once per sign-in, recorded in `sessionStorage`: a person who
 * skips is not asked again until they come back, and a person who claims is
 * never asked again because the API stops saying `handleClaimed: false`. There
 * is no version of this that blocks the app — the reserved handle already
 * works, so the only thing at stake is whether the user likes it.
 *
 * D18 owns the profile pages. This component owns the prompt and nothing else;
 * changing a handle later belongs on `/my/profile`.
 */

const SKIP_KEY = "cd:handle-claim-skipped";

interface ProfileResponse {
  handle?: string;
  handleClaimed?: boolean;
}

function getApiBasePath(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "";
}

export function HandleClaimPrompt({ isLoggedIn }: { isLoggedIn: boolean }) {
  /**
   * Nothing renders until the client has mounted.
   *
   * The decision to show this depends on `sessionStorage` and on a fetch, and
   * neither exists on the server. Branching on them during the first render is
   * how a page hydrates into a corpse — React abandons hydration on a text
   * mismatch and every handler on the page silently stops working.
   */
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");
  const [reserved, setReserved] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !isLoggedIn) return;

    let cancelled = false;

    (async () => {
      try {
        if (sessionStorage.getItem(SKIP_KEY) === "1") return;
      } catch {
        // A browser that refuses storage still gets the prompt. Being asked
        // twice is a far smaller problem than never being asked.
      }

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) return;

        const res = await fetch(`${getApiBasePath()}/profile`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;

        const profile: ProfileResponse = await res.json();
        if (cancelled) return;

        // A claimed handle, or an account with no handle at all — the
        // degraded case, which `/my/profile` handles and this does not.
        if (profile.handleClaimed !== false || !profile.handle) return;

        setReserved(profile.handle);
        setHandle(profile.handle);
        setOpen(true);
      } catch {
        // The prompt is an invitation, not a gate. A failed fetch means it
        // does not appear this time.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mounted, isLoggedIn]);

  function skip() {
    try {
      sessionStorage.setItem(SKIP_KEY, "1");
    } catch {
      // Nothing to do; they may be asked again next navigation.
    }
    setOpen(false);
  }

  async function claim() {
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`${getApiBasePath()}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ handle: handle.trim().toLowerCase() }),
      });

      if (!res.ok) {
        // 400 and 409 both carry a message the user can act on — the handle is
        // the wrong shape, or someone else has it. Show the server's words
        // rather than inventing our own, so there is one wording to maintain.
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Could not save that handle. Try again.");
        return;
      }

      try {
        sessionStorage.setItem(SKIP_KEY, "1");
      } catch {
        // Claimed handles are not re-prompted anyway: the API stops reporting
        // `handleClaimed: false`.
      }
      setOpen(false);
    } catch {
      setError("Could not save that handle. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || !isLoggedIn) return null;

  const unchanged = handle.trim().toLowerCase() === reserved;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : skip())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Pick your handle</DialogTitle>
          <DialogDescription>
            Your profile lives at{" "}
            <span className="font-mono text-fg">/u/{handle || reserved}</span>.
            We reserved one from your email — keep it, or choose something else.
            You can change it again in 30 days.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          <Label htmlFor="cd-handle-claim">Handle</Label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-fg-tertiary">/u/</span>
            <Input
              id="cd-handle-claim"
              value={handle}
              autoComplete="off"
              spellCheck={false}
              maxLength={30}
              onChange={(event) => {
                setHandle(event.target.value.toLowerCase());
                setError(null);
              }}
            />
          </div>
          <p className="text-xs text-fg-tertiary">
            Lowercase letters, numbers and underscores. 3–30 characters.
          </p>
          {error ? (
            <p role="alert" className="text-xs text-[color:var(--cd-danger)]">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={skip} disabled={saving}>
            Not now
          </Button>
          <Button
            variant="primary"
            onClick={claim}
            disabled={saving || handle.trim().length < 3}
          >
            {saving ? (
              <Loader2
                className="h-4 w-4 animate-spin motion-reduce:animate-none motion-reduce:opacity-60"
                aria-hidden
              />
            ) : null}
            {unchanged ? "Keep this handle" : "Claim handle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
