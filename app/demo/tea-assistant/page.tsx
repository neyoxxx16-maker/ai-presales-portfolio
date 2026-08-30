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
      <BusinessProblem />
      <SolutionOverview />
      <TeaChat />
      <PocNotice />
      <Footer />
    </main>
  );
}
