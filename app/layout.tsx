import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Patient AI Health Navigator",
  description: "Scaffolded workspace for the Patient AI Health Navigator MVP"
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}