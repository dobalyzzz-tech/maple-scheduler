import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "도트 스케줄러 — 오늘의 모험을 시작하세요!",
  description: "메이플 감성 도트 스케줄러. 일정은 퀘스트, 당신은 모험가!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-full flex flex-col font-pixel bg-parchment text-border">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
