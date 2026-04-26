import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPT-IMAGE-2",
  description:
    "A Microsoft Azure OpenAI Service image generation application built with Next.js 16 and TypeScript.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
