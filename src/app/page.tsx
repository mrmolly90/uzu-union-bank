'use client';

import { Navbar } from '@/components/layout/Navbar';
import { Hero } from '@/components/layout/Hero';
import { AccountGrid } from '@/components/layout/AccountGrid';
import { CardsSection } from '@/components/layout/CardsSection';
import { MobileBanking } from '@/components/layout/MobileBanking';
import { SecurityGrid } from '@/components/layout/SecurityGrid';
import { FAQAccordion } from '@/components/layout/FAQAccordion';
import { Footer } from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main>
        <Hero />
        <AccountGrid />
        <CardsSection />
        <MobileBanking />
        <SecurityGrid />
        <FAQAccordion />
      </main>
      <Footer />
    </div>
  );
}