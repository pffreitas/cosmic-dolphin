import Link from "next/link";
import { focusRing } from "@/components/ui/focus-ring";

/**
 * Approved original-artwork refinement with light lettering. It needs the
 * icon's night-sky ground behind it: the landing header and footer provide it
 * edge to edge; anywhere else, use `LandingBrandSignature`.
 */
export function LandingBrand() {
  return (
    <Link href="/" aria-label="Cosmic Dolphin home" className={`landing-brand ${focusRing}`}>
      {/* Fixed-size assets are also embedded in the standalone design preview. */}
      {/* eslint-disable @next/next/no-img-element */}
      <img className="landing-brand-icon" src="/images/landing/brand/compact.webp" width={128} height={128} alt="" />
      {/* Light lettering: the lockup carries the icon's dark ground behind it. */}
      <img src="/images/landing/brand/wordmark-dark.webp" width={874} height={143} alt="" />
      {/* eslint-enable @next/next/no-img-element */}
    </Link>
  );
}

/** The same lockup as a badge that carries its own ground, for light surfaces. */
export function LandingBrandSignature() {
  return (
    <div className="landing-brand-signature">
      <LandingBrand />
    </div>
  );
}
