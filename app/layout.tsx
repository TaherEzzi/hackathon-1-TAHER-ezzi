import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "A Una Milla",
  description: "Aeronautical arbitrage for the discerning traveler. The House, Trip Dossier, Capital & Spend, Sovereign Roadmap.",
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/favicon.png", type: "image/png" }] },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
