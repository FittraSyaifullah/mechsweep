import type { Metadata } from "next";
import { Inter } from "next/font/google";
import CreatorCredits from "@/components/CreatorCredits";
import { ToastProvider } from "@/components/Toast";
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
          <CreatorCredits />
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
