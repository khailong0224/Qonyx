import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        background: "hsl(var(--background))",
        backgroundSecondary: "hsl(var(--background-secondary))",
        surface: "hsl(var(--surface))",
        surfaceCard: "hsl(var(--surface-card))",
        surfaceElevated: "hsl(var(--surface-elevated))",
        surfacePanel: "hsl(var(--surface-panel))",
        surfaceInput: "hsl(var(--surface-input))",
        border: "hsl(var(--border))",
        borderSoft: "hsl(var(--border-soft))",
        borderStrong: "hsl(var(--border-strong))",
        foreground: "hsl(var(--foreground))",
        foregroundSecondary: "hsl(var(--foreground-secondary))",
        mutedForeground: "hsl(var(--muted-foreground))",
        disabledForeground: "hsl(var(--disabled-foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          hover: "hsl(var(--primary-hover))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        profit: "hsl(var(--profit))",
        loss: "hsl(var(--loss))",
        warning: "hsl(var(--warning))",
        info: "hsl(var(--info))",
        danger: "hsl(var(--danger))",
        ring: "hsl(var(--ring))",
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
      },
      boxShadow: {
        "onyx-subtle": "var(--shadow-onyx-subtle)",
        "onyx-card": "var(--shadow-onyx-card)",
        "onyx-elevated": "var(--shadow-onyx-elevated)",
        "onyx-glow-teal": "var(--shadow-onyx-glow-teal)",
        "onyx-glow-violet": "var(--shadow-onyx-glow-violet)",
        "danger-glow": "var(--shadow-danger-glow)",
      },
      spacing: {
        "page-x": "2rem",
        "page-y": "1.5rem",
        "card-sm": "1rem",
        "card-md": "1.25rem",
        "card-lg": "1.5rem",
        "section-gap": "1.5rem",
      },
      backgroundImage: {
        "onyx-card":
          "linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.01)), linear-gradient(180deg, hsl(var(--surface-card)), hsl(var(--surface-panel)))",
        "onyx-panel":
          "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.005)), linear-gradient(180deg, hsl(var(--surface-elevated)), hsl(var(--surface)))",
        "onyx-reflection":
          "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03), rgba(255,255,255,0))",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
