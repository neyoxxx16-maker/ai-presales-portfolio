import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ResumeHero } from "@/components/resume/ResumeHero";

export default function ResumePage() {
  return (
    <main>
      <Navbar />
      <ResumeHero />
      <div className="h-10 sm:h-14" />
      <Footer />
    </main>
  );
}
