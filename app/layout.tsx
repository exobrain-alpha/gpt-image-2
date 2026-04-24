import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GPT-Image-2 Local Studio",
  description: "A local text-to-image workspace for GPT-Image-2 prompts.",
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
