import DashboardClient from "@/components/dashboard-client";

export default function Home() {
  return (
    <div className="space-y-8 w-full">
      <header>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">OrphanLink Control Center</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Autonomous Clinical Trial Matching Portal</p>
      </header>
      
      <DashboardClient />
    </div>
  );
}
