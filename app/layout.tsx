import type { Metadata } from "next";
import { IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// JetBrains Mono is the typeface inside the official Pulse lockup SVG. Loading
// it here makes it available document-wide so the SVG renders its wordmark in
// the intended face. We expose it as a CSS variable in case anything else
// wants to reference it.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-lockup",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pulse — Real-Time Markets",
  description: "Professional stock market dashboard",
  icons: {
    icon: [{ url: "/logos/pulse-favicon.svg", type: "image/svg+xml" }],
    apple: "/logos/pulse-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmPlexMono.variable} ${jetbrainsMono.variable} antialiased`}
      style={{ backgroundColor: "var(--bg-primary)" }}
    >
      <body>{children}</body>
    </html>
  );
}
