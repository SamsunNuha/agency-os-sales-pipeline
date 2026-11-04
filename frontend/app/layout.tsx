import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import Logo from "./components/Logo";
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Agency OS — Sales Pipeline & Deal Management",
  description:
    "Production-grade CRM and Sales Pipeline management for digital agencies. Manage deals, pipelines, follow-ups, and project handoffs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">

        {children}
      </body>
    </html>
  );
}
