import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ReviewPulse — Turn User Reviews Into Product Decisions",
  description:
    "AI-powered review discovery engine. Analyze app store, Reddit, and social media reviews at scale to surface unmet needs and ship product decisions.",
  keywords: [
    "ReviewPulse",
    "review analysis",
    "product analytics",
    "AI",
    "music discovery",
    "Blinkit",
    "RAG",
  ],
  authors: [{ name: "ReviewPulse" }],
  openGraph: {
    title: "ReviewPulse — AI-Powered Review Discovery",
    description:
      "Turn millions of user reviews into product decisions. AI analysis, segmentation, and RAG chat.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} ${jetbrains.variable} antialiased bg-background text-foreground font-sans`}
      >
        {children}
        <Toaster />
        <Analytics />
      </body>
    </html>
  );
}
