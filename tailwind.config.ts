import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#09090B",
        surface: "#0F1117",
        card: "#141418",
        "card-hover": "#1A1A1F",
        border: "#1E1E24",
        "border-hover": "#2A2A32",
        primary: "#3B82F6",
        "primary-hover": "#2563EB",
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
        purple: "#8B5CF6",
        foreground: "#F4F4F5",
        secondary: "#A1A1AA",
        muted: "#52525B",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        xl: "12px",
        "2xl": "16px",
      },
    },
  },
  plugins: [],
};

export default config;
