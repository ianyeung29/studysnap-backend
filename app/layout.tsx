import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "StudySnap — AI Lecture Voice & Whiteboard Photo Note Taker",
  description:
    "Record lecture voice and snap whiteboard photos. StudySnap's AI instantly merges audio and slides into structured study guides, flashcards, and practice tests. Download the free beta for Android and iOS.",
  keywords: [
    "StudySnap",
    "AI lecture note taker",
    "whiteboard photo to text",
    "lecture audio transcriber",
    "study guide generator",
    "Anki flashcards generator",
    "Whisper transcription",
    "GPT-4o OCR",
    "spaced repetition tool",
    "study helper",
    "student app"
  ],
  metadataBase: new URL("https://studysnap-backend-kittycatty.vercel.app"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "StudySnap — AI Lecture Voice & Whiteboard Photo Note Taker",
    description: "Record lecture audio and snap whiteboard photos. Our AI synthesizes them into perfect study binders, flashcards, and exam preps instantly.",
    url: "https://studysnap-backend-kittycatty.vercel.app",
    siteName: "StudySnap",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "StudySnap Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "StudySnap — AI Lecture Voice & Whiteboard Photo Note Taker",
    description: "Record lecture audio and snap whiteboard photos. Our AI synthesizes them into perfect study binders, flashcards, and exam preps instantly.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        {children}
        {/* Software Schema for Google Rich Snippets */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              "name": "StudySnap",
              "operatingSystem": "Android, iOS",
              "applicationCategory": "EducationalApplication",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "USD"
              },
              "description": "Stop scrambling to copy down slides. Record your professor's voice and snap photos of the whiteboard. StudySnap's AI instantly merges them into custom study guides, flashcards, and practice tests."
            })
          }}
        />
      </body>
    </html>
  );
}
