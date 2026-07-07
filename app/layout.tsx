import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StudySnap — Turn Lecture Notes Into Study Materials Instantly",
  description:
    "Paste your lecture notes and get a study guide, flashcards, exam prep questions, and more in seconds. Powered by AI. Free to use.",
  keywords: ["study guide", "flashcards", "lecture notes", "AI study tool", "exam prep", "student"],
  openGraph: {
    title: "StudySnap — AI Study Materials Generator",
    description: "Paste your lecture notes. Get a study guide, flashcards, and exam prep instantly.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
