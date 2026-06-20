import type { Config } from "tailwindcss";

// Tailwind v4 호환 — 빈 config (v4는 CSS @theme로 설정)
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
};
export default config;
