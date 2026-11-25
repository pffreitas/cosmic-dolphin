import Link from "next/link";
import { ArrowUp, Menu } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { focusRing } from "@/components/ui/focus-ring";
import { LandingSignupButton } from "./landing-analytics";
import styles from "./landing-frame.module.css";

const chapters = [
  { href: "#knowledge", label: "The brief" },
  { href: "#library", label: "Your library" },
  { href: "#formats", label: "Formats" },
];

function ChapterLinks() {
  return chapters.map(({ href, label }) => <a key={href} className={focusRing} href={href}>{label}</a>);
}

function Signature() {
  return <Link href="#top" aria-label="Cosmic Dolphin home" className={`${styles.signature} ${focusRing}`}><LogoMark className={styles.mark} />Cosmic Dolphin</Link>;
}

export function LandingHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.bar}>
        <Signature />
        <nav aria-label="Page sections" className={styles.desktop}><ChapterLinks /></nav>
        <div className={styles.account}>
          <Link href="/sign-in" className={`${styles.signin} ${focusRing}`}>Sign in</Link>
          <LandingSignupButton placement="header" className={styles.signup} />
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Page navigation" className={styles.menu}><Menu aria-hidden /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" aria-label="Page navigation">
              {chapters.map(({ href, label }) => <DropdownMenuItem key={href} asChild><a className="min-h-11" href={href}>{label}</a></DropdownMenuItem>)}
              <DropdownMenuItem asChild><Link className="min-h-11" href="/sign-in">Sign in</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function LandingFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.columns}>
          <div className={styles.identity}><Signature /><p>A private library for the links you save.</p></div>
          <nav aria-labelledby="footer-explore"><h2 id="footer-explore">Explore</h2><ChapterLinks /></nav>
          <nav aria-labelledby="footer-account">
            <h2 id="footer-account">Account</h2>
            <Link href="/sign-in" className={focusRing}>Sign in</Link>
            <LandingSignupButton placement="footer" className={styles.create} />
          </nav>
        </div>
        <div className={styles.base}><small>© {new Date().getFullYear()} Cosmic Dolphin</small><a href="#top" className={focusRing}>Back to top <ArrowUp size={14} aria-hidden /></a></div>
      </div>
    </footer>
  );
}
