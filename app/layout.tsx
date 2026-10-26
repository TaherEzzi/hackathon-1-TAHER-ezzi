import type { ReactNode } from "react";

export const metadata = {
  title: "A Una Milla — The House",
  description: "Aeronautical arbitrage for the discerning traveler. The House, Trip Dossier, Capital & Spend, Sovereign Roadmap.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
