"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "首页" },
  { href: "/wordbooks", label: "单词书" },
  { href: "/graph", label: "图谱" },
  { href: "/settings", label: "设置" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b border-[#2a2a2a] bg-[#1a1a1a]">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">
          Word Graph
        </Link>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-[#2a2a2a] text-white"
                  : "text-gray-400 hover:text-white hover:bg-[#2a2a2a]"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
