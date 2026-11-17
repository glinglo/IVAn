import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "IVAn", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f6f5f2" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
