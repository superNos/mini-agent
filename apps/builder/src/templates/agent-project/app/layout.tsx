import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Generated Mini Agent",
  description: "A generated mini-agent project",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
