import { Navbar } from "@/components/layout/Navbar";
import { ResumePdfViewer } from "@/components/resume/ResumePdfViewer";

export default function ResumePdfPage() {
  return (
    <main>
      <Navbar />
      <ResumePdfViewer />
    </main>
  );
}
