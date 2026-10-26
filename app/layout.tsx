import type { ReactNode } from "react";

export const metadata = {
  title: "A Una Milla — backend",
  description: "Chat de puntos y millas para España. Backend v1 (docs/BACKEND_BUILD_BRIEF.md).",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
