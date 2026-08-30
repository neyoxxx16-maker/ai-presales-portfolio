import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Hero } from "@/components/home/Hero";
import { WorkMethod } from "@/components/home/WorkMethod";
import { ProjectShowcase } from "@/components/home/ProjectShowcase";
import { AboutStrip } from "@/components/home/AboutStrip";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <WorkMethod />
      <ProjectShowcase />
      <AboutStrip />
      <Footer />
    </main>
  );
}
