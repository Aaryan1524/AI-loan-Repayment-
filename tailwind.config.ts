import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#C17B4A",
        "background-light": "#F7F2EA",
        "background-dark": "#1a1614",
        "surface-light": "#FDFAF5",
        "surface-dark": "#2a2420",
        "border-light": "#E4D9C8",
        "border-dark": "#3d342d",
        "text-main-light": "#2c2622",
        "text-main-dark": "#e8e3df",
        "text-muted-light": "#7c7268",
        "text-muted-dark": "#9c948c",
        sage: "#6A8C70",
        "terra-light": "#EED8C1",
      },
      fontFamily: {
        display: ["var(--font-playfair)", "serif"],
        body: ["var(--font-dm-sans)", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "16px",
      },
    },
  },
  plugins: [],
};
export default config;
