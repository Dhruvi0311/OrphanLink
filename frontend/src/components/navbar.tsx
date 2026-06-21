"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, Sun } from "lucide-react";

export function Navbar() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setIsDark(true);
    }
  }, []);

  const toggleDarkMode = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
      <div className="flex h-16 items-center px-6 md:px-10 max-w-[1600px] mx-auto w-full justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" onClick={(e) => { e.preventDefault(); window.location.href = '/'; }} className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              OrphanLink
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
            <Link href="/about" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              About
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={toggleDarkMode}
            className="inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
            aria-label="Toggle Dark Mode"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </header>
  );
}
