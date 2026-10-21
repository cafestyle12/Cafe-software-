import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CafeOS", template: "%s · CafeOS" },
  description: "A dependable operating system for modern cafés.",
  applicationName: "CafeOS",
};

export const viewport: Viewport = {
  themeColor: "#f7f5ef",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
