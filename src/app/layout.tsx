import type { Metadata } from "next";
import { Inter } from "next/font/google";
import CreatorCredits from "@/components/CreatorCredits";
import { ToastProvider } from "@/components/Toast";
import { SupabaseProvider } from "@/contexts/SupabaseProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MechSweep",
  description: "Scrape, analyze, and export mechanical engineering documents for RAG pipelines",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ToastProvider>
          <SupabaseProvider>
            <CreatorCredits />
            {children}
          </SupabaseProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
