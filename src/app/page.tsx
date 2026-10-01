import { SiteHeader } from "@/components/layout/site-header";

// Temporary targets while the landing page is built one layer at a time.
export default function Home() {
  return (
    <>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <section className="page-container section-spacing">
          <h1 className="hero-title">Give your work an AI teammate.</h1>
        </section>
        {[
          { id: "how-it-works", title: "How it works" },
          { id: "use-cases", title: "Use cases" },
          { id: "contact", title: "Contact" },
        ].map((section) => (
          <section key={section.id} id={section.id} className="page-container section-spacing scroll-mt-24 border-t border-border">
            <h2 className="section-title">{section.title}</h2>
            <p className="mt-4 text-muted-foreground">Coming in the next landing page layer.</p>
          </section>
        ))}
      </main>
    </>
  );
}
