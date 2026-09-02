import Link from "next/link";
import { ArrowLeft, Download, ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { siteConfig } from "@/lib/site-config";

const materials = {
  "yiyeshanchun-product-manual": siteConfig.materials.teaManual,
  "huawentong-product-manual": siteConfig.materials.huawentongManual,
} as const;

export function generateStaticParams() { return Object.keys(materials).map((slug) => ({ slug })); }

export default async function MaterialPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const material = materials[slug as keyof typeof materials];
  if (!material) notFound();
  return <main><Navbar /><section className="mx-auto max-w-7xl px-5 py-12 lg:px-8 lg:py-16"><p className="text-xs text-neutral-500">方案展示 / 商业方案材料 / 产品手册</p><Link href="/solutions" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-neutral-700"><ArrowLeft size={16}/> 返回方案展示</Link><div className="mt-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between"><div><p className="section-kicker">产品手册</p><h1 className="mt-5 text-4xl font-medium tracking-[-0.05em] sm:text-6xl">{material.title}</h1><p className="mt-4 text-base text-neutral-500">{material.description}</p></div><div className="flex gap-3"><a href={material.file} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-black/10 px-5 py-3 text-sm font-medium">预览 <ExternalLink size={15}/></a><a href={material.file} download className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white">下载 <Download size={15}/></a></div></div><div className="mt-10 overflow-hidden rounded-[28px] border border-black/5 bg-[#f7f8f9]"><iframe title={material.title} src={material.file} className="h-[75vh] min-h-[520px] w-full" /></div></section><Footer /></main>;
}
