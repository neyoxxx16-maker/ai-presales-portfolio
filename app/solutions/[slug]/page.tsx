import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { siteConfig } from "@/lib/site-config";
import { TeaManualViewer } from "@/components/solutions/TeaManualViewer";

const materials = {
  "yiyeshanchun-product-manual": siteConfig.materials.teaManual,
  "huawentong-product-manual": siteConfig.materials.huawentongManual,
} as const;

export function generateStaticParams() { return Object.keys(materials).map((slug) => ({ slug })); }

export default async function MaterialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const material = materials[slug as keyof typeof materials];
  if (!material) notFound();
  if (slug === "yiyeshanchun-product-manual") {
    return <main><Navbar /><section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><Link href="/solutions" className="inline-flex items-center gap-2 text-sm font-medium text-neutral-700"><ArrowLeft size={16}/> 返回方案展示</Link><div className="mt-10"><p className="section-kicker">产品手册</p><h1 className="mt-5 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">一叶春山｜产品手册</h1><p className="mt-4 text-base text-neutral-500">茶品牌产品资料与业务方案展示</p></div><TeaManualViewer pages={siteConfig.materials.teaManual.pages} /></section><Footer /></main>;
  }
  return <main><Navbar /><section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><p className="text-xs text-neutral-500">方案展示 / 商业方案材料 / 产品手册</p><Link href="/solutions" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-neutral-700"><ArrowLeft size={16}/> 返回方案展示</Link><div className="mt-10"><p className="section-kicker">产品手册</p><h1 className="mt-5 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">{material.title}</h1><p className="mt-4 text-base text-neutral-500">{material.description}</p></div><TeaManualViewer pages={siteConfig.materials.huawentongManual.pages} title={siteConfig.materials.huawentongManual.title} pageSize={{ width: 1920, height: 1080 }} /></section><Footer /></main>;
}
