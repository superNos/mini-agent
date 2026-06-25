import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mini-agent-builder",
  description: "A visual Agent kernel builder",
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
