export function HeroSection() {
  return (
    <section id="hero" aria-labelledby="hero-title" className="flex w-full justify-center bg-background px-6 pt-16 pb-16 lg:pt-24 lg:pb-24">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center">
        <h1 id="hero-title" className="max-w-[14ch] text-[40px] leading-[46px] font-semibold tracking-[-0.03em] text-foreground sm:text-5xl sm:leading-[1.08] lg:text-[64px] lg:leading-[70px]">
          Give your work.<br />a teammate.
        </h1>
        <p className="max-w-[58ch] text-lg leading-7 text-muted-foreground lg:text-xl lg:leading-[30px]">
          GptBots keeps track of ongoing tasks, prepares useful updates, and brings the next decision to you.
        </p>
      </div>
    </section>
  );
}
