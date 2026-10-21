import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        cafe: {
          ink: "#17201b",
          paper: "#f7f5ef",
          leaf: "#355b46",
          copper: "#bd744d",
        },
      },
    },
  },
  plugins: [],
};

export default config;
