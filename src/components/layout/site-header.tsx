"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const navItems = [
  { href: "#contact", label: "Contact" },
];
const linkStyle = "rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SiteHeader() {
  const [active, setActive] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => {
      let current = "";
      for (const item of navItems) {
        const section = document.getElementById(item.href.slice(1));
        if (section && section.getBoundingClientRect().top <= 120) current = item.href;
      }
      setActive(current);
    };
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setOpen(false); };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    desktop.addEventListener("change", closeOnDesktop);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      desktop.removeEventListener("change", closeOnDesktop);
    };
  }, []);

  return (
    <>
      <a href="#main" className="sr-only fixed top-2 left-6 z-[60] rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus-visible:ring-2 focus-visible:ring-ring">Skip to content</a>
      <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="page-container grid h-16 grid-cols-[1fr_auto] items-center gap-2 lg:h-20 lg:grid-cols-[1fr_auto_1fr]">
          <Link href="/" aria-label="GptBots home" className="flex w-fit items-center gap-2.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Image src="/gptbots.svg" alt="" width={32} height={32} priority className="size-7 lg:size-8" />
            <span className="text-lg font-semibold tracking-tight lg:text-xl">GptBots</span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 lg:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} aria-current={active === item.href ? "location" : undefined} className={`${linkStyle} relative py-2 ${active === item.href ? "text-foreground after:absolute after:right-0 after:bottom-0 after:left-0 after:h-0.5 after:bg-accent" : ""}`}>
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center justify-end gap-1 sm:gap-2">
            <Button render={<Link href="#contact" />} className="h-10 px-4 lg:h-12 lg:px-6">
              <span className="sm:hidden">Demo</span><span className="hidden sm:inline">Request a demo</span>
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger render={<Button variant="ghost" size="icon" className="size-10 lg:hidden" aria-label="Open menu" />}><Menu aria-hidden="true" /></DialogTrigger>
              <DialogContent className="top-0 right-0 left-auto h-dvh max-h-dvh w-[320px] max-w-[calc(100%-1rem)] translate-x-0 translate-y-0 content-start gap-8 overflow-y-auto rounded-none bg-background sm:max-w-[320px]">
                <DialogTitle>GptBots</DialogTitle>
                <nav aria-label="Mobile navigation" className="flex flex-col gap-2">
                  {navItems.map((item) => (
                    <DialogClose key={item.href} render={<Link href={item.href} />} aria-current={active === item.href ? "location" : undefined} className={`${linkStyle} block py-3`}>{item.label}</DialogClose>
                  ))}
                </nav>
                <div className="border-t border-border pt-6">
                  <DialogClose render={<Button render={<Link href="#contact" />} className="w-full" />}>Request a demo</DialogClose>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>
    </>
  );
}

