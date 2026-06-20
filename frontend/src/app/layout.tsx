import type { Metadata } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import { JudgeModeProvider } from "@/contexts/JudgeModeContext";
import { Navbar } from "@/components/navbar";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const firaCode = Fira_Code({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OrphanLink | Autonomous Clinical Trial Matching",
  description: "B2B web portal that automates clinical trial matching using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${firaCode.variable} antialiased font-sans bg-slate-50/50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen flex flex-col transition-colors duration-300`}>
        <JudgeModeProvider>
          <Navbar />
          <main className="flex-1 w-full max-w-[1600px] mx-auto p-4 md:p-8">
            {children}
          </main>
        </JudgeModeProvider>
      </body>
    </html>
  );
}
