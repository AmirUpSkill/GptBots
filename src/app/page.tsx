import { SiteHeader } from "@/components/layout/site-header";
import { HeroSection } from "@/components/sections/hero-section";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <HeroSection />
        <div id="contact" aria-hidden="true" />
      </main>
    </>
  );
}
