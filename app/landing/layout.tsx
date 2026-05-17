import type { Metadata } from "next";
import { Inter } from "next/font/google";
import SmoothScroll from "./components/SmoothScroll";
import "./landing.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Pulse — Real-Time Stock Market Terminal",
  description:
    "Real-time prices, professional charts, and portfolio tracking. Built for serious traders.",
};

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`${inter.variable} landing-root`}>
      <SmoothScroll>{children}</SmoothScroll>
    </div>
  );
}
