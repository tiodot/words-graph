import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Word Graph - 英语单词图谱",
  description: "通过多维度关联探索英语单词",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="min-h-screen bg-[#0f0f0f] text-white">
          <Header />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
