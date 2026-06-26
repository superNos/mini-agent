import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mini-agent-builder",
  description: "可视化智能体内核创建器",
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
