import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { BusinessProblem } from "@/components/tea-demo/BusinessProblem";
import { PocNotice } from "@/components/tea-demo/PocNotice";
import { SolutionOverview } from "@/components/tea-demo/SolutionOverview";
import { TeaChat } from "@/components/tea-demo/TeaChat";
import { TeaHero } from "@/components/tea-demo/TeaHero";

export default function TeaAssistantPage() {
  return (
    <main>
      <Navbar />
      <TeaHero />
      <TeaChat />
      <section className="mx-auto max-w-7xl px-5 pb-4 pt-8 lg:px-8 lg:pt-12"><p className="section-kicker">项目设计</p><h2 className="mt-5 text-3xl font-medium tracking-[-0.045em] sm:text-4xl">这个 Demo 是怎么做的？</h2></section>
      <BusinessProblem />
      <SolutionOverview />
      <PocNotice />
      <Footer />
    </main>
  );
}
