import type { Metadata } from "next";
import Link from "next/link";
import { HeartPulse, MessageCircle, UserRound } from "lucide-react";
import "./globals.css";
import { ToastProvider } from "@/app/_components/toast-provider";

export const metadata: Metadata = {
  title: "Patient AI Health Navigator",
  description: "A patient-centered clinical context and conversation workspace"
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <div className="app-frame">
          <header className="app-header">
            <Link className="brand" href="/" aria-label="Patient AI Health Navigator home">
              <span className="brand-mark" aria-hidden="true">
                <HeartPulse size={21} strokeWidth={2.4} />
              </span>
              <span>
                <strong>Care Navigator</strong>
                <small>Clinical workspace</small>
              </span>
            </Link>

            <nav className="app-nav" aria-label="Primary navigation">
              <Link href="/profile">
                <UserRound size={17} aria-hidden="true" />
                Profiles
              </Link>
              <Link href="/chat">
                <MessageCircle size={17} aria-hidden="true" />
                Conversations
              </Link>
            </nav>
          </header>
          {children}
        </div>
        <ToastProvider />
      </body>
    </html>
  );
}