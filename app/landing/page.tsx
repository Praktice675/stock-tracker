"use client";

import Nav from "./components/Nav";
import Hero from "./components/Hero";
import MarketClocks from "./components/MarketClocks";
import Showcase from "./components/Showcase";
import Features from "./components/Features";
import BigStat from "./components/BigStat";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export default function LandingPage() {
  return (
    <>
      <Nav />
      <Hero />
      <MarketClocks />
      <Showcase />
      <Features />
      <BigStat />
      <CTA />
      <Footer />
    </>
  );
}
