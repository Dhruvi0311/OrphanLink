"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Terminal, Moon, Sun } from "lucide-react";
import { useJudgeMode } from "@/contexts/JudgeModeContext";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { isJudgeMode, setIsJudgeMode } = useJudgeMode();
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
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Technology
            </Link>
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Security & Privacy
            </Link>
            <Link href="#" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              For Clinicians
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
          
          <button
            className="hidden md:inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/20"
          >
            Launch Portal
          </button>
          <button
            onClick={() => setIsJudgeMode(!isJudgeMode)}
            className={cn(
              "relative inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all duration-300 ease-in-out border",
              isJudgeMode
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-[0_0_15px_rgba(99,102,241,0.3)] dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            )}
          >
            <Terminal className={cn("h-4 w-4", isJudgeMode ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500 dark:text-slate-400")} />
            {isJudgeMode ? "Judge Mode Active" : "Judge Mode"}
            
            {/* Glowing dot indicator */}
            {isJudgeMode && (
              <span className="absolute -right-1 -top-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
