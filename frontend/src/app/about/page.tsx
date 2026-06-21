import React from 'react';
import { FileText, Activity, Sparkles } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="w-full py-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
            
        {/* ABOUT ORPHANLINK SECTION */}
        <div id="about" className="w-full max-w-[1400px] mx-auto px-6 lg:px-10 py-16 space-y-24">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              About OrphanLink
            </h2>
            <p className="text-slate-505 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
              A clinical trial matching platform designed to empower patients with precise biomarker analysis and verified trial mappings.
            </p>
          </div>
          
          <div className="space-y-24 lg:space-y-36">
            {/* BLOCK 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full animate-fade-up" style={{ animationDelay: '100ms' }}>
              <div className="lg:col-span-6 space-y-4 text-left order-1 lg:order-1">
                <span className="text-xs font-bold tracking-widest text-[#0F766E] dark:text-teal-400 uppercase">Biomarker Analysis</span>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight">AI-Powered Biomarker Intelligence</h3>
                <p className="text-base text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                  OrphanLink extracts biomarkers, mutations, and therapies from complex medical reports using OCR and AI, creating structured patient profiles instantly.
                </p>
              </div>
              <div className="lg:col-span-6 flex justify-center order-2 lg:order-2">
                <div className="relative w-full max-w-[460px] aspect-[1.3] rounded-3xl bg-teal-50/20 dark:bg-slate-900/30 border border-teal-150/40 dark:border-slate-800/40 flex items-center justify-center overflow-hidden shadow-sm">
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-teal-500/10 blur-2xl" />
                  
                  {/* AI Extraction Visualization */}
                  <div className="w-full space-y-4 relative z-10 p-6">
                    {/* Unstructured Text Box */}
                    <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm text-left">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-mono">
                        Patient is a 58yo female with advanced <span className="bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 px-1 rounded font-bold">NSCLC</span>. 
                        Testing confirmed <span className="bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1 rounded font-bold">EGFR L858R</span> mutation. 
                        Previously treated with <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-1 rounded font-bold">Osimertinib</span>.
                      </p>
                    </div>
                    
                    {/* Down Arrow / Processing */}
                    <div className="flex justify-center">
                      <div className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950 border border-teal-200 dark:border-teal-800 flex items-center justify-center animate-bounce shadow-sm">
                        <svg className="w-3 h-3 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                      </div>
                    </div>
                    
                    {/* Structured JSON Output */}
                    <div className="bg-slate-900 dark:bg-slate-950 rounded-xl p-4 shadow-xl text-left overflow-hidden relative group border border-slate-800">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-teal-400 to-blue-500" />
                      <pre className="text-[11px] text-teal-300 font-mono leading-relaxed pl-2">
{`{
  "diagnosis": "Non-Small Cell Lung Cancer",
  "biomarkers": [
    { "gene": "EGFR", "variant": "L858R" }
  ],
  "past_therapies": ["Osimertinib"]
}`}
                      </pre>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* BLOCK 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full animate-fade-up" style={{ animationDelay: '200ms' }}>
              <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
                <div className="relative w-full max-w-[460px] aspect-[1.3] rounded-3xl bg-blue-50/20 dark:bg-slate-900/30 border border-blue-150/40 dark:border-slate-800/40 flex items-center justify-center overflow-hidden shadow-sm">
                  <div className="absolute bottom-1/4 right-1/4 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
                  
                  {/* Dashboard Cards illustration */}
                  <div className="relative z-10 space-y-4">
                    <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 w-[280px] shadow-lg text-left space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">CLINICALTRIALS.GOV MATCH</span>
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">96%</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">EGFR-Mutated Advanced Non-Small Cell Lung Cancer Study</h4>
                      <div className="w-full bg-slate-100 dark:bg-slate-900 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full w-[96%]" />
                      </div>
                    </div>
                    <div className="bg-white/80 dark:bg-slate-950/80 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 w-[260px] shadow-md text-left space-y-2 translate-x-12 -translate-y-2 opacity-90">
                      <span className="text-[10px] font-mono font-bold text-slate-400">STAGE II RETRIEVAL</span>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-250">CAR-T Cell Eligibility Filter</h4>
                      <p className="text-[9px] text-slate-450">Standardized via RxNorm API</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 space-y-4 text-left order-1 lg:order-2">
                <span className="text-xs font-bold tracking-widest text-[#2563EB] dark:text-blue-400 uppercase">Intelligent Retrieval</span>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight">Real-Time Clinical Trial Matching</h3>
                <p className="text-base text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                  OrphanLink searches ClinicalTrials.gov V2, ranking results using a Hybrid RAG system (ChromaDB + BM25) and Reciprocal Rank Fusion (RRF) to identify the most relevant trials.
                </p>
              </div>
            </div>

            {/* BLOCK 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full animate-fade-up" style={{ animationDelay: '300ms' }}>
              <div className="lg:col-span-6 space-y-4 text-left order-1 lg:order-1">
                <span className="text-xs font-bold tracking-widest text-[#0F766E] dark:text-teal-400 uppercase">Safety First</span>
                <h3 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight">Built For Trust and Safety</h3>
                <p className="text-base text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                  Every recommendation undergoes LangGraph Multi-Agent verification. An Evaluator agent assesses rules, and a Reviewer agent double-checks for hallucinations and hidden exclusions.
                </p>
              </div>
              <div className="lg:col-span-6 flex justify-center order-2 lg:order-2">
                <div className="relative w-full max-w-[460px] aspect-[1.3] rounded-3xl bg-teal-50/20 dark:bg-slate-900/30 border border-teal-150/40 dark:border-slate-800/40 flex items-center justify-center overflow-hidden shadow-sm">
                  <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full bg-teal-500/10 blur-2xl" />
                  
                  {/* Multi-Agent Safety Visualization */}
                  <div className="w-full relative z-10 flex flex-col gap-4 p-6">
                     {/* Trial Rule */}
                     <div className="bg-white/90 dark:bg-slate-900/90 border border-red-200 dark:border-red-900/50 rounded-xl p-4 shadow-sm text-left relative">
                       <span className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-wider mb-1 block">TRIAL EXCLUSION CRITERIA</span>
                       <p className="text-[12px] text-slate-700 dark:text-slate-300 font-medium leading-tight">Prior treatment with an EGFR inhibitor is not permitted.</p>
                     </div>

                     {/* Agents container */}
                     <div className="flex gap-4 justify-center">
                       {/* Evaluator Agent */}
                       <div className="flex-1 bg-blue-50/90 dark:bg-slate-900/90 border border-blue-200/50 dark:border-blue-900/50 rounded-xl p-4 text-left shadow-sm">
                         <div className="flex items-center gap-2 mb-2">
                           <Activity className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                           <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Evaluator</span>
                         </div>
                         <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                           Patient took Osimertinib. Osimertinib is an EGFR inhibitor. <br/><span className="text-red-500 dark:text-red-400 font-bold mt-1 inline-block">Conflict detected.</span>
                         </p>
                       </div>
                       
                       {/* Reviewer Agent */}
                       <div className="flex-1 bg-teal-50/90 dark:bg-slate-900/90 border border-teal-200/50 dark:border-teal-900/50 rounded-xl p-4 text-left shadow-sm">
                         <div className="flex items-center gap-2 mb-2">
                           <svg className="w-4 h-4 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                           <span className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wide">Reviewer</span>
                         </div>
                         <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                           Confirmed via RxNorm classification. Exclusion is valid. <br/><span className="text-red-500 dark:text-red-400 font-bold mt-1 inline-block">Trial Rejected.</span>
                         </p>
                       </div>
                     </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* WHY ORPHANLINK SECTION */}
        <div id="why-orphanlink" className="w-full max-w-[1400px] mx-auto px-6 lg:px-10 py-16 space-y-24">
          <div className="text-center space-y-4">
            <span className="text-xs font-bold tracking-widest text-[#0F766E] dark:text-teal-400 uppercase">
              Why OrphanLink
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 max-w-3xl mx-auto leading-tight">
              From Biomarker Reports to Life-Saving Clinical Trials
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-3xl mx-auto text-base md:text-lg leading-relaxed font-normal">
              Most clinical trial platforms rely on keyword searches and manual screening. OrphanLink uses AI to understand biomarker reports, standardize genes and therapies, verify eligibility, and recommend the most relevant clinical trials with safety at its core.
            </p>
          </div>

          <div className="space-y-28 lg:space-y-40">
            {/* BLOCK 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full animate-fade-up" style={{ animationDelay: '100ms' }}>
              <div className="lg:col-span-6 space-y-5 text-left">
                <span className="text-xs font-bold tracking-widest text-[#0F766E] dark:text-teal-400 uppercase">Precision Extraction</span>
                <h3 className="text-2xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 leading-tight">AI That Understands Biomarkers, Not Just Keywords</h3>
                <p className="text-base md:text-lg text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                  Upload a biomarker or genetic report and OrphanLink automatically extracts mutations, therapies, and clinical indicators using our pytesseract OCR pipeline and LLM abstractor.
                </p>
              </div>
              <div className="lg:col-span-6 flex justify-center">
                <div className="relative w-full max-w-[480px] aspect-[1.35] rounded-3xl bg-gradient-to-tr from-teal-500/5 to-blue-500/5 border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-center overflow-hidden shadow-sm">
                  {/* Soft background glows */}
                  <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-teal-500/10 blur-2xl" />
                  <div className="absolute bottom-1/4 right-1/4 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl" />
                  
                  {/* Background DNA wave */}
                  <svg className="absolute inset-0 w-full h-full text-slate-200/40 dark:text-slate-800/30" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
                    <path d="M10,20 Q25,50 40,20 T70,20 T100,20" />
                    <path d="M10,45 Q25,15 40,45 T70,45 T100,45" />
                  </svg>

                  {/* Medical Report Box */}
                  <div className="relative bg-white dark:bg-slate-900 border border-slate-250/70 dark:border-slate-800 rounded-2xl p-5 shadow-lg w-[240px] z-10 -translate-x-12 translate-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3 mb-3">
                      <div className="w-6 h-6 bg-teal-50 dark:bg-teal-950/50 text-teal-600 rounded-md flex items-center justify-center">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase font-mono">BIOMARKER REPORT</span>
                    </div>
                    <div className="space-y-2">
                      <div className="h-2 w-3/4 bg-slate-100 dark:bg-slate-850 rounded" />
                      <div className="h-2 w-5/6 bg-slate-100 dark:bg-slate-850 rounded" />
                      <div className="h-2 w-1/2 bg-slate-100 dark:bg-slate-850 rounded" />
                    </div>
                    
                    {/* Glowing scanning effect */}
                    <div className="absolute left-0 right-0 top-16 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent animate-pulse" />
                  </div>

                  {/* Floating extracted chips */}
                  <div className="absolute top-10 right-8 bg-teal-50 dark:bg-teal-950/80 border border-teal-200/50 dark:border-teal-900/50 text-teal-850 dark:text-teal-300 text-xs font-bold font-mono px-3.5 py-2 rounded-xl shadow-md z-20 flex items-center gap-1.5 animate-bounce" style={{ animationDuration: '3.5s' }}>
                    <span className="w-1.5 h-1.5 bg-teal-500 rounded-full" />
                    BRCA2
                  </div>
                  <div className="absolute top-28 right-4 bg-blue-50 dark:bg-blue-950/80 border border-blue-200/50 dark:border-blue-900/50 text-blue-850 dark:text-blue-300 text-xs font-bold font-mono px-3.5 py-2 rounded-xl shadow-md z-20 flex items-center gap-1.5 animate-bounce" style={{ animationDuration: '4.2s', animationDelay: '0.5s' }}>
                    <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    HER2
                  </div>
                  <div className="absolute bottom-16 right-16 bg-slate-50 dark:bg-slate-900/90 border border-slate-200/50 dark:border-slate-800 text-slate-800 dark:text-slate-250 text-xs font-bold font-mono px-3.5 py-2 rounded-xl shadow-md z-20 flex items-center gap-1.5 animate-bounce" style={{ animationDuration: '3.8s', animationDelay: '1.2s' }}>
                    <span className="w-1.5 h-1.5 bg-[#0F766E] rounded-full" />
                    EGFR
                  </div>
                  <div className="absolute bottom-6 right-36 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-250/50 dark:border-emerald-900/50 text-emerald-850 dark:text-emerald-300 text-[10px] font-bold font-mono px-3 py-1.5 rounded-xl shadow-sm z-20 flex items-center gap-1">
                    Pembrolizumab
                  </div>
                  <div className="absolute top-20 left-20 bg-indigo-50 dark:bg-indigo-950/80 border border-indigo-200/50 dark:border-indigo-900/50 text-indigo-850 dark:text-indigo-300 text-[10px] font-bold font-mono px-3 py-1.5 rounded-xl shadow-sm z-20 flex items-center gap-1">
                    ERBB2
                  </div>

                  {/* Connective Nodes lines SVG */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 480 324">
                    {/* Lines from document to chips */}
                    <path d="M190,140 L380,50" stroke="url(#teal-grad)" strokeWidth="1.5" strokeDasharray="3,3" />
                    <path d="M190,140 L395,130" stroke="url(#teal-grad)" strokeWidth="1.5" strokeDasharray="3,3" />
                    <path d="M190,140 L345,210" stroke="url(#teal-grad)" strokeWidth="1.5" strokeDasharray="3,3" />
                    <defs>
                      <linearGradient id="teal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0F766E" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>
            </div>

            {/* BLOCK 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full animate-fade-up" style={{ animationDelay: '200ms' }}>
              <div className="lg:col-span-6 flex justify-center order-2 lg:order-1">
                <div className="relative w-full max-w-[480px] aspect-[1.35] rounded-3xl bg-gradient-to-tr from-blue-500/5 to-teal-500/5 border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center items-center overflow-hidden shadow-sm p-6">
                  {/* Soft background glow */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl" />
                  
                  {/* Horizontal Flow Pipeline */}
                  <div className="w-full space-y-6 relative z-10 flex flex-col items-center">
                    <div className="grid grid-cols-5 items-center w-full max-w-[380px] gap-2">
                      {/* Patient Report Node */}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-full bg-teal-50 dark:bg-slate-900 border border-teal-200/60 dark:border-slate-800 flex items-center justify-center shadow-sm">
                          <FileText className="w-4 h-4 text-teal-650 dark:text-teal-400" />
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 text-center leading-none font-normal">Patient<br/>Report</span>
                      </div>
                      
                      {/* Connector 1 */}
                      <div className="relative h-1 w-full bg-slate-100 dark:bg-slate-850 rounded overflow-hidden">
                        <div className="absolute inset-0 bg-teal-500/40 animate-pulse" />
                      </div>

                      {/* APIs Node */}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-slate-900 border border-blue-200/60 dark:border-slate-800 flex items-center justify-center shadow-md relative">
                          <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 font-mono">APIs</span>
                          {/* Floating labels for APIs */}
                          <span className="absolute -top-3 text-[7px] bg-slate-800 text-slate-100 px-1 rounded-sm tracking-wider font-mono">MYGENE</span>
                          <span className="absolute -bottom-3 text-[7px] bg-slate-800 text-slate-100 px-1 rounded-sm tracking-wider font-mono">RXNORM</span>
                        </div>
                      </div>

                      {/* Connector 2 */}
                      <div className="relative h-1 w-full bg-slate-100 dark:bg-slate-850 rounded overflow-hidden">
                        <div className="absolute inset-0 bg-blue-500/40 animate-pulse" />
                      </div>

                      {/* ClinicalTrials.gov Node */}
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-sm">
                          <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 text-center leading-none font-normal">ClinicalTrials<br/>.gov</span>
                      </div>
                    </div>

                    {/* Vertical Connector Down */}
                    <div className="w-[2px] h-8 bg-gradient-to-b from-indigo-500/40 to-teal-500/60 relative">
                      <div className="absolute left-1/2 -translate-x-1/2 top-0 w-2.5 h-2.5 rounded-full bg-indigo-500" />
                    </div>

                    {/* AI Matching Engine Node */}
                    <div className="bg-white/90 dark:bg-slate-900/90 border border-teal-200/50 dark:border-slate-800 rounded-2xl px-5 py-3 shadow-md flex items-center gap-3 w-full max-w-[240px]">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-teal-500 to-blue-500 flex items-center justify-center shadow-inner shrink-0 animate-pulse">
                        <Sparkles className="w-4 h-4 text-white" />
                      </div>
                      <div className="text-left leading-tight">
                        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">AI Matching Engine</h4>
                        <span className="text-[9px] text-[#0F766E] dark:text-teal-400 font-bold font-mono">RAG Ranking: Active</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="lg:col-span-6 space-y-5 text-left order-1 lg:order-2">
                <span className="text-xs font-bold tracking-widest text-[#2563EB] dark:text-blue-400 uppercase">Trusted Sources</span>
                <h3 className="text-2xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 leading-tight">Powered by Trusted Medical Intelligence</h3>
                <p className="text-base md:text-lg text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                  OrphanLink standardizes genes and therapies using MyGene.info and RxNorm, then searches ClinicalTrials.gov in real time to discover relevant clinical trials.
                </p>
              </div>
            </div>

            {/* BLOCK 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full animate-fade-up" style={{ animationDelay: '300ms' }}>
              <div className="lg:col-span-6 space-y-5 text-left">
                <span className="text-xs font-bold tracking-widest text-[#0F766E] dark:text-teal-400 uppercase">Multi-Agent Safety</span>
                <h3 className="text-2xl md:text-4xl font-bold text-slate-800 dark:text-slate-100 leading-tight">Every Match Is Double Checked</h3>
                <p className="text-base md:text-lg text-slate-600 dark:text-slate-355 leading-relaxed font-normal">
                  Unlike conventional AI systems, OrphanLink uses a LangGraph multi-agent verification workflow. An Evaluator Agent assesses rules while a Reviewer Agent independently checks hidden exclusions and contradictions before approving recommendations.
                </p>
              </div>
              <div className="lg:col-span-6 flex justify-center">
                <div className="relative w-full max-w-[480px] aspect-[1.35] rounded-3xl bg-gradient-to-tr from-teal-500/5 to-blue-500/5 border border-slate-200/50 dark:border-slate-800/50 flex items-center justify-center overflow-hidden shadow-sm p-4">
                  {/* Soft background glow */}
                  <div className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full bg-emerald-500/5 blur-2xl" />
                  
                  {/* Multi-Agent Diagram */}
                  <div className="relative z-10 w-full flex flex-col items-center gap-5">
                    
                    {/* Top Row: Patient & Evaluator */}
                    <div className="flex items-center justify-between w-full max-w-[360px] relative">
                      
                      {/* Patient Node */}
                      <div className="flex flex-col items-center gap-1 z-15">
                        <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 flex items-center justify-center shadow-sm">
                          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Patient</span>
                      </div>

                      {/* Evaluator Node */}
                      <div className="flex flex-col items-center gap-1 z-15">
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-slate-900 border border-blue-200/50 dark:border-slate-800 flex items-center justify-center shadow-md relative">
                          <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          {/* Tiny agent label */}
                          <span className="absolute -top-2 bg-blue-600 text-white text-[6px] font-extrabold px-1 rounded-sm tracking-wider font-mono uppercase">EVALUATOR</span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Evaluator Agent</span>
                      </div>

                      {/* Validator Node */}
                      <div className="flex flex-col items-center gap-1 z-15">
                        <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-slate-900 border border-teal-200/50 dark:border-slate-800 flex items-center justify-center shadow-md relative">
                          <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          {/* Tiny agent label */}
                          <span className="absolute -top-2 bg-teal-600 text-white text-[6px] font-extrabold px-1 rounded-sm tracking-wider font-mono uppercase">VALIDATOR</span>
                        </div>
                        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Validator Agent</span>
                      </div>

                      {/* Connecting Line Vector */}
                      <svg className="absolute top-1/2 left-0 right-0 h-0.5 w-full pointer-events-none -z-10" viewBox="0 0 360 2">
                        <line x1="40" y1="1" x2="320" y2="1" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4,4" className="dark:stroke-slate-800" />
                      </svg>
                    </div>

                    {/* Validator -> Safety Check -> Trusted Match flow */}
                    <div className="flex flex-col items-center gap-3">
                      {/* Down Connector */}
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-teal-500">
                        <path d="M12 5v14M19 12l-7 7-7-7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>

                      {/* Safety Check Node */}
                      <div className="flex items-center gap-2 bg-emerald-500/10 dark:bg-emerald-500/5 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-emerald-600 dark:text-emerald-400 text-xs font-bold font-mono">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        Exclusions Verified
                      </div>

                      {/* Trusted Trial Match box */}
                      <div className="bg-white/95 dark:bg-slate-900 border border-emerald-500/20 rounded-2xl px-5 py-3 shadow-lg flex items-center justify-between gap-4 w-[260px] animate-pulse">
                        <div className="text-left">
                          <span className="text-[8px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 px-2 py-0.5 rounded font-mono font-extrabold uppercase font-normal">TRUSTED MATCH</span>
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-1 leading-tight line-clamp-1">Targeted CAR-T Phase II Trial</h4>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center shadow shrink-0 text-white font-extrabold text-sm">✓</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
