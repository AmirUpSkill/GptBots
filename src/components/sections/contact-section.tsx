import { ContactForm } from "@/components/sections/contact-form";

export function ContactSection() {
  return (
    <section id="contact" aria-labelledby="contact-title" className="section-spacing scroll-mt-20 lg:scroll-mt-24">
      <div className="page-container grid items-start gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="max-w-lg lg:pt-8">
          <p className="mb-3 text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Let’s talk</p>
          <h2 id="contact-title" className="section-title max-w-[16ch]">Put your AI teammate to work.</h2>
          <p className="mt-4 max-w-[46ch] leading-7 text-muted-foreground">Have a workflow in mind? Tell us what you’re working on, ask a question, or request a demo of GptBots.</p>
        </div>
        <ContactForm />
      </div>
    </section>
  );
}
