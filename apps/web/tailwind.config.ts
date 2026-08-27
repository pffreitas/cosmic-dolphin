import type { Config } from "tailwindcss";
import defaultTheme from "tailwindcss/defaultTheme";

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "2rem",
        lg: "4rem",
        xl: "5rem",
        "2xl": "6rem",
      },
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--cd-font-sans)", ...defaultTheme.fontFamily.sans],
        serif: ["var(--cd-font-serif)", ...defaultTheme.fontFamily.serif],
        mono: ["var(--cd-font-mono)", ...defaultTheme.fontFamily.mono],
      },
      colors: {
        // ---- Signal tokens ----------------------------------------------
        // `accent` deliberately shadows shadcn's, which meant "muted hover
        // surface"; that meaning now lives on `bg-inset`.
        bg: {
          DEFAULT: "var(--cd-bg)",
          subtle: "var(--cd-bg-subtle)",
          panel: "var(--cd-bg-panel)",
          inset: "var(--cd-bg-inset)",
        },
        fg: {
          DEFAULT: "var(--cd-fg)",
          secondary: "var(--cd-fg-secondary)",
          tertiary: "var(--cd-fg-tertiary)",
        },
        line: {
          DEFAULT: "var(--cd-border)",
          strong: "var(--cd-border-strong)",
        },
        accent: {
          DEFAULT: "var(--cd-accent)",
          hover: "var(--cd-accent-hover)",
          fg: "var(--cd-accent-fg)",
          soft: "var(--cd-accent-soft)",
          border: "var(--cd-accent-border)",
        },
        ai: {
          DEFAULT: "var(--cd-ai)",
          bg: "var(--cd-ai-bg)",
          border: "var(--cd-ai-border)",
          chip: "var(--cd-ai-chip)",
        },
        like: "var(--cd-like)",

        // ---- shadcn bridge ----------------------------------------------
        // Stays until every primitive has been migrated off it; then delete
        // these keys and the compatibility layer at the foot of tokens.css.
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      // Signal motion. `duration-cd-fast` (150ms) for colour and background,
      // `duration-cd` (220ms) for size and position, `ease-cd` everywhere.
      // Named rather than arbitrary because `duration-[var(--x)]` and
      // `ease-[var(--x)]` are ambiguous to Tailwind and get dropped silently.
      transitionDuration: {
        cd: "var(--cd-duration)",
        "cd-fast": "var(--cd-duration-fast)",
      },
      transitionTimingFunction: {
        cd: "var(--cd-ease)",
      },
      borderRadius: {
        xs: "var(--cd-radius-xs)",
        sm: "var(--cd-radius-sm)",
        md: "var(--cd-radius-md)",
        lg: "var(--cd-radius-lg)",
        pill: "var(--cd-radius-pill)",
      },
      keyframes: {
        // Skeleton shimmer. Named for the component so it cannot collide with
        // the legacy `.shimmer` keyframes still in globals.css.
        "skeleton-sweep": {
          "0%": {
            transform: "translateX(-100%)",
          },
          "100%": {
            transform: "translateX(100%)",
          },
        },
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        spin_right: {
          "0%": {
            transform: "rotate(0deg)",
          },
          "50%": {
            transform: "rotate(180deg)",
          },
          "100%": {
            transform: "rotate(360deg)",
          },
        },
        spin_left: {
          "0%": {
            transform: "rotate(0deg)",
          },
          "50%": {
            transform: "rotate(-180deg)",
          },
          "100%": {
            transform: "rotate(-360deg)",
          },
        },
        tilt: {
          "0%, 100%": {
            transform: "scale(0.97, 0.6) rotate(0deg)",
            blur: "30px",
          },
          "50%": {
            transform: "scale(1, 1) rotate(0deg)",
            blur: "10px",
          },
        },
      },
      animation: {
        "skeleton-sweep": "skeleton-sweep 1.6s linear infinite",
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        spin_right: "spin_right 3s linear infinite",
        spin_right_fast: "spin_right 2s linear infinite",
        spin_left: "spin_left 3s linear infinite",
        tilt: "tilt 1.5s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

export default config;
