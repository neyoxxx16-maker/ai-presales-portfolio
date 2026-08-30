import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "黄念红｜AI售前解决方案作品集",
  description: "AI售前 / 解决方案工程师个人能力展示网站，包含RAG、Agent、Function Calling与POC项目Demo。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
