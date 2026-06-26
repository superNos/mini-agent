import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "生成的迷你智能体",
  description: "由 mini-agent-builder 生成的迷你智能体项目",
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
