import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { ResumeHero } from "@/components/resume/ResumeHero";
import { ResumeContent } from "@/components/resume/ResumeContent";

export default function ResumePage() {
  return (
    <main>
      <Navbar />
      <ResumeHero />
      <ResumeContent />
      <Footer />
    </main>
  );
}
