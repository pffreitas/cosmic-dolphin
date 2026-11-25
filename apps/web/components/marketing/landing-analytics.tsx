"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type SignupPlacement = "header" | "hero" | "closing" | "footer";

type LandingEvent =
  | ["landing_signup_click", { cta_placement: SignupPlacement }]
  | ["landing_sample_open" | "landing_sample_read"]
  | ["landing_library_search", { result_count: number }]
  | ["landing_format_select", { sample_format: string }]
  | ["landing_media_play", { sample_format: "audio" | "short_video" }];

// The existing Google tag handles page views. Only explicit, bounded interaction
// data belongs here: no search strings, saved URLs or account identifiers.
export function trackLandingEvent(...args: LandingEvent) {
  const { gtag } = window as Window & {
    gtag?: (command: "event", ...args: LandingEvent) => void;
  };
  gtag?.("event", ...args);
}

export function LandingSignupButton({
  placement,
  className,
}: {
  placement: SignupPlacement;
  className: string;
}) {
  return (
    <Button variant={placement === "footer" ? "link" : "primary"} size={placement === "header" ? "default" : "lg"} asChild className={className}>
      <Link href="/sign-up" onClick={() => trackLandingEvent("landing_signup_click", { cta_placement: placement })}>
        {placement === "header" ? "Sign up" : placement === "footer" ? "Create an account" : <>Save your first link <ArrowRight aria-hidden /></>}
      </Link>
    </Button>
  );
}
