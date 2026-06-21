"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, FileText, Activity, MessageSquare, X, Send, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const mockPhaseData = [
  { name: "Phase I", value: 15 },
  { name: "Phase II", value: 50 },
  { name: "Phase III", value: 35 },
];
const COLORS = ["#818cf8", "#34d399", "#fbbf24"];

const mockConfidenceData = [
  { metric: "Genomic Alignment", score: 92, info: "Evaluates how closely the patient's genetic markers align with the trial's inclusion criteria." },
  { metric: "Demographic Eligibility", score: 100, info: "Checks if the patient meets age, gender, and other basic demographic requirements." },
  { metric: "Treatment History", score: 78, info: "Compares the patient's past treatments against lines of therapy required or excluded by the trial." }
];

const HighlightText = ({ text, highlights, highlightClass, tooltips }: { text: string, highlights?: string[], highlightClass: string, tooltips?: Record<string, string> }) => {
  if (!text) return null;

  const escapedHighlights = (highlights || []).map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(h => h.length > 0);
  const tooltipKeys = Object.keys(tooltips || {}).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).filter(k => k.length > 0);
  
  const allPatterns = [...new Set([...escapedHighlights, ...tooltipKeys])];
  if (allPatterns.length === 0) return <span>{text}</span>;

  allPatterns.sort((a, b) => b.length - a.length);
  // Use word boundaries \b to prevent matching substrings like "ast" inside "Past"
  const regex = new RegExp(`\\b(${allPatterns.join('|')})\\b`, 'gi');
  const parts = text.split(regex);

  return (
    <span>
      {parts.map((part, i) => {
        const isHighlight = highlights?.some(h => h.toLowerCase() === part.toLowerCase());
        const tooltipKey = Object.keys(tooltips || {}).find(k => k.toLowerCase() === part.toLowerCase());
        const tooltipText = tooltipKey && tooltips ? tooltips[tooltipKey] : null;

        if (!isHighlight && !tooltipText) return <span key={i}>{part}</span>;

        return (
          <span key={i} className="relative group/tooltip inline-block">
            {isHighlight ? (
              <mark className={`rounded px-1 ${highlightClass} ${tooltipText ? 'border-b-2 border-dotted border-current cursor-help' : ''}`}>
                {part}
              </mark>
            ) : tooltipText ? (
              <span className="border-b-2 border-dotted border-indigo-400 cursor-help text-indigo-700 font-medium">
                {part}
              </span>
            ) : null}

            {/* Tooltip Popup */}
            {tooltipText && (
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-slate-800 text-white text-xs leading-relaxed rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50">
                {tooltipText}
                <svg className="absolute text-slate-800 h-2 w-full left-0 top-full" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};

export default function DashboardClient() {
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<string[]>([]);
  const [patientBiomarkers, setPatientBiomarkers] = useState<any>(null);
  
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<string[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  
  const [activeStep, setActiveStep] = useState<string>("abstractor");
  const [isDragOver, setIsDragOver] = useState(false);
  
  const [appState, setAppState] = useState<"landing" | "upload-pipeline" | "chat-pipeline">("landing");
  const [activeGatewayTab, setActiveGatewayTab] = useState<"upload" | "chat">("upload");
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{role: "user" | "assistant", content: string}[]>([]);
  
  const [completedTasks, setCompletedTasks] = useState<Set<number>>(new Set());

  const toggleTask = (index: number) => {
    setCompletedTasks(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const [isPostMatchChatOpen, setIsPostMatchChatOpen] = useState(false);
  const [postMatchChatLogs, setPostMatchChatLogs] = useState<{role: "user" | "assistant", content: string}[]>([
    { role: "assistant", content: "Hello! I am your OrphanLink Clinical Trial Assistant. How can I help you understand your matched trials, medical terms, or next steps?" }
  ]);
  const [postMatchChatInput, setPostMatchChatInput] = useState("");
  const [isPostMatchThinking, setIsPostMatchThinking] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [postMatchChatLogs, isPostMatchChatOpen]);

  const handlePostMatchChatSubmit = async (e?: React.FormEvent, messageOverride?: string) => {
    if (e) e.preventDefault();
    const msgToSend = messageOverride || postMatchChatInput;
    if (!msgToSend.trim()) return;

    setPostMatchChatInput("");
    setPostMatchChatLogs((prev) => [...prev, { role: "user", content: msgToSend }]);
    setIsPostMatchThinking(true);

    try {
      const response = await fetch("http://localhost:8000/chat-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biomarkers: patientBiomarkers,
          results: results,
          task_list: taskList,
          message: msgToSend,
          history: postMatchChatLogs,
        }),
      });

      const data = await response.json();
      if (data && data.response) {
        setPostMatchChatLogs((prev) => [...prev, { role: "assistant", content: data.response }]);
      } else {
        setPostMatchChatLogs((prev) => [
          ...prev,
          { role: "assistant", content: "I apologize, but I received an invalid response from the server." },
        ]);
      }
    } catch (error) {
      setPostMatchChatLogs((prev) => [
        ...prev,
        { role: "assistant", content: `Failed to connect to the assistant server: ${error}` },
      ]);
    } finally {
      setIsPostMatchThinking(false);
    }
  };

  const getRecommendedQuestions = () => {
    const list: string[] = [];
    const matches = results.filter(r => r.evaluation?.status === "MATCH");
    const exclusions = results.filter(r => r.evaluation?.status === "EXCLUDED");
    
    // 1. Mutation / Biomarker specific
    if (patientBiomarkers?.active_mutations && patientBiomarkers.active_mutations.length > 0) {
      list.push(`Explain my ${patientBiomarkers.active_mutations[0]} mutation`);
    } else {
      list.push("Explain the biomarkers found in my report");
    }

    // 2. Exclusions specific
    if (exclusions.length > 0) {
      list.push(`Why was trial ${exclusions[0].trial?.nct_id || "this trial"} excluded?`);
    } else {
      list.push("Why would a trial be excluded?");
    }

    // 3. Eligibility / Match specific
    if (matches.length > 0) {
      list.push(`Explain my eligibility for ${matches[0].trial?.nct_id || "these trials"}`);
    } else {
      list.push("Explain my overall eligibility criteria");
    }

    // 4. Next Steps
    list.push("What are my next steps?");

    return list.slice(0, 4); // strictly return 4 for 2x2 grid
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  
  const getStageDetails = (step: string) => {
    switch (step) {
      case "abstractor":
        return {
          title: "Extracting & Parsing Biomarkers",
          doing: "Parsing raw unstructured PDF/TXT medical reports and extracting core biological markers using Large Language Models.",
          why: "Medical reports are unstructured and complex. We must extract structured data (Age, Mutations, Prior Therapies) before we can reliably search for trials.",
          tech: "PyMuPDF, Llama 3 (Abstractor Agent)",
          info: "Patient age, active genetic mutations, and historical therapy regimens."
        };
      case "intake":
        return {
          title: "Standardizing Clinical Entities",
          doing: "Cross-referencing extracted genes and drugs against global medical databases to normalize the terminology.",
          why: "Clinical nomenclature varies (e.g., 'Herceptin' vs 'Trastuzumab'). Standardization prevents false negatives during the matching process.",
          tech: "RxNorm API, MyGene.info API",
          info: "Drug names, gene symbols, and disease ontologies."
        };
      case "evaluate":
        return {
          title: "Retrieving & Evaluating Trials",
          doing: "Retrieving trials from ClinicalTrials.gov and using Hybrid RAG to rank them, followed by an AI agent evaluating exact inclusion criteria.",
          why: "Simple keyword searches fail on complex medical logic. We use dense vectors to find semantically similar trials, and an AI agent to read the inclusion criteria like a clinician.",
          tech: "ClinicalTrials.gov V2 API, ChromaDB, BM25, Reciprocal Rank Fusion (RRF), LangGraph Evaluator Agent",
          info: "Trial protocols, detailed inclusion criteria, and patient biomarker profiles."
        };
      case "validate":
        return {
          title: "Executing Validator Safety Loop",
          doing: "A secondary Validator Agent is independently reviewing the Evaluator's work to ensure no hidden exclusions are missed.",
          why: "Patient safety is paramount. If a trial requires 'No prior chemotherapy' but the patient had it, the Validator will catch this contradiction and overrule the match.",
          tech: "LangGraph Validator Agent, Multi-Agent Reflection",
          info: "Exclusion criteria contradictions and critical safety checks."
        };
      default:
        return {
          title: "Initializing Pipeline",
          doing: "Preparing the autonomous agents for processing.",
          why: "Establishing secure connections to vector databases and reasoning models.",
          tech: "LangGraph, FastAPI",
          info: "System state initialization."
        };
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      const syntheticEvent = {
        target: { files: [file] }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      handleFileUpload(syntheticEvent);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setLogs([`> SYSTEM: Uploading ${file.name}...`]);
    setResults([]);
    setTaskList([]);
    setQuizQuestions([]);
    setQuizAnswers({});
    setPatientBiomarkers(null);
    setActiveGatewayTab("upload");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("http://localhost:8000/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      const jobId = data.job_id;
      
      if (jobId) {
        setCurrentJobId(jobId);
        startSseStream(jobId);
      } else {
        throw new Error("No job ID returned");
      }
    } catch (error) {
      setLogs((prev) => [...prev, `> ERROR: Failed to upload document: ${error}`]);
      setIsUploading(false);
    }
  };

  const startSseStream = (jobId: string) => {
    const eventSource = new EventSource(`http://localhost:8000/stream/${jobId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.event === "log") {
        const msg = data.message;
        setLogs((prev) => [...prev, msg]);
        
        if (msg.includes("EXTRACTOR_AGENT:")) setActiveStep("abstractor");
        else if (msg.includes("QUIZ_GENERATOR:") || msg.includes("RETRIEVER_AGENT:")) setActiveStep("intake");
        else if (msg.includes("EVALUATOR_AGENT:")) setActiveStep("evaluate");
        else if (msg.includes("VALIDATOR_AGENT:") || msg.includes("TASK_GENERATOR:")) setActiveStep("validate");
        
      } else if (data.event === "quiz_required") {
        setLogs((prev) => [...prev, "> SYSTEM: Missing information. Awaiting user input."]);
        if (activeGatewayTab === "chat") {
            const question = data.questions && data.questions.length > 0 ? data.questions[0] : "Please provide more details.";
            setChatMessages((prev) => [...prev, {role: "assistant", content: question}]);
            setIsUploading(false);
            eventSource.close();
        } else {
            setQuizQuestions(data.questions || []);
            setIsUploading(false);
            eventSource.close();
        }
      } else if (data.event === "completed") {
        setLogs((prev) => [...prev, "> SYSTEM: Processing complete."]);
        setResults(data.state.evaluation_results || []);
        setTaskList(data.state.task_list || []);
        setPatientBiomarkers(data.state.extracted_biomarkers || null);
        setIsUploading(false);
        setActiveStep("done");
        eventSource.close();
      } else if (data.event === "error") {
        setLogs((prev) => [...prev, `> ERROR: ${data.message}`]);
        setIsUploading(false);
        eventSource.close();
      }
    };

    eventSource.onerror = (error) => {
      setLogs((prev) => [...prev, "> ERROR: SSE Connection lost."]);
      setIsUploading(false);
      eventSource.close();
    };
  };

  const handleQuizSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentJobId) return;

    setIsUploading(true);
    setQuizQuestions([]);
    setLogs((prev) => [...prev, "> SYSTEM: Submitting missing patient information..."]);

    try {
      const response = await fetch("http://localhost:8000/submit-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: currentJobId,
          answers: quizAnswers
        })
      });

      if (response.ok) {
        startSseStream(currentJobId);
      } else {
        throw new Error("Failed to submit quiz");
      }
    } catch (error) {
      setLogs((prev) => [...prev, `> ERROR: ${error}`]);
      setIsUploading(false);
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMessage = chatInput;
    setChatInput("");
    setChatMessages((prev) => [...prev, {role: "user", content: userMessage}]);
    
    setIsUploading(true);
    try {
      if (!currentJobId) {
        setLogs([`> SYSTEM: Initializing AI Intake Chat...`]);
        setResults([]);
        setTaskList([]);
        setPatientBiomarkers(null);

        const response = await fetch("http://localhost:8000/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userMessage })
        });
        const data = await response.json();
        if (data.job_id) {
            setCurrentJobId(data.job_id);
            startSseStream(data.job_id);
        }
      } else {
        const response = await fetch("http://localhost:8000/chat-reply", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ job_id: currentJobId, message: userMessage })
        });
        if (response.ok) {
            startSseStream(currentJobId);
        }
      }
    } catch (error) {
      setLogs((prev) => [...prev, `> ERROR: ${error}`]);
      setIsUploading(false);
    }
  };

  const handleDownloadReport = async () => {
    try {
      setLogs((prev) => [...prev, "> SYSTEM: Generating PDF clinical summary report..."]);
      const response = await fetch("http://localhost:8000/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          biomarkers: patientBiomarkers,
          trials: results
        })
      });

      if (!response.ok) throw new Error("Failed to generate report");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "OrphanLink_Clinical_Report.pdf";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setLogs((prev) => [...prev, "> SYSTEM: PDF Report downloaded successfully."]);
    } catch (error) {
      setLogs((prev) => [...prev, `> ERROR: ${error}`]);
    }
  };

  if (appState === "landing") {
    return (
      <div className="w-full space-y-24 pb-24">
        {/* HERO SECTION */}
        <div className="relative w-full min-h-[85vh] lg:min-h-[90vh] flex items-center justify-center py-8 overflow-hidden rounded-3xl">
          {/* Futuristic Clinical Background System */}
          <div className="absolute inset-0 -z-10 bg-[#F8FAFC] dark:bg-slate-950 bg-gradient-to-tr from-teal-50/20 via-[#F8FAFC] to-white dark:from-slate-950 dark:via-slate-950 dark:to-slate-905/40">
            {/* Dotted pattern overlay */}
            <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1.2px,transparent_1.2px)] [background-size:24px_24px] opacity-60" />
            
            {/* Soft glowing blobs */}
            <div className="absolute top-12 left-1/4 w-[350px] h-[350px] rounded-full bg-teal-500/5 dark:bg-teal-500/5 blur-3xl animate-pulse" />
            <div className="absolute bottom-12 right-1/4 w-[400px] h-[400px] rounded-full bg-blue-500/5 dark:bg-blue-500/5 blur-3xl animate-pulse" />
            
            {/* Subtle DNA pattern watermark in background */}
            <svg className="absolute right-10 top-1/4 w-[300px] h-[300px] text-teal-600/5 dark:text-teal-400/5" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="0.5">
              <path d="M10,20 Q25,50 40,20 T70,20" />
              <path d="M10,40 Q25,10 40,40 T70,40" />
              <line x1="20" y1="26" x2="20" y2="34" />
              <line x1="30" y1="21" x2="30" y2="39" />
              <line x1="40" y1="20" x2="40" y2="40" />
              <line x1="50" y1="39" x2="50" y2="21" />
              <line x1="60" y1="34" x2="60" y2="26" />
            </svg>
          </div>
          
          {/* Style block for animations */}
          <style>{`
            @keyframes float-animation {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-8px); }
            }
            @keyframes glow-pulse {
              0%, 100% { transform: scale(1); opacity: 0.25; }
              50% { transform: scale(1.08); opacity: 0.4; }
            }
            @keyframes pulse-ring {
              0% { transform: scale(0.95); opacity: 1; }
              50% { transform: scale(1.2); opacity: 0.5; }
              100% { transform: scale(1.4); opacity: 0; }
            }
            @keyframes fade-up {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .floating-card-1 {
              animation: float-animation 6s ease-in-out infinite;
            }
            .floating-card-2 {
              animation: float-animation 6s ease-in-out infinite 3s;
            }
            .pulse-ring-element {
              animation: pulse-ring 3s cubic-bezier(0.215, 0.610, 0.355, 1) infinite;
            }
            .animate-fade-up {
              opacity: 0;
              animation: fade-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
          `}</style>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center w-full max-w-[1400px] mx-auto px-6 lg:px-10">
            {/* LEFT: Text & CTAs */}
            <div className="lg:col-span-6 space-y-8 text-left max-w-2xl">
              <div className="space-y-4">
                <h1 className="text-4xl md:text-5xl lg:text-[3.2rem] font-bold tracking-tight text-slate-800 dark:text-slate-100 leading-tight">
                  Helping Rare Disease Patients Find <span className="text-[#0F766E] dark:text-teal-400">Life-Saving</span> Clinical Trials
                </h1>
                <p className="text-lg md:text-xl text-slate-600 dark:text-slate-350 leading-relaxed font-normal">
                  Upload unstructured biomarker reports (PDF/TXT) via our OCR pipeline. OrphanLink standardizes entities via RxNorm and MyGene.info, using a Hybrid RAG approach to find precise matches from ClinicalTrials.gov V2.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-2">
                {/* Primary CTA */}
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#0F766E] hover:bg-[#0D625C] dark:bg-teal-650 dark:hover:bg-teal-700 text-white font-semibold px-8 py-4 rounded-xl shadow-lg shadow-teal-700/10 hover:shadow-teal-700/20 transition-all text-base border-0 flex items-center justify-center gap-3 cursor-pointer group"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-hover:-translate-y-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload Biomarker Report
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".txt,.pdf,.json" 
                  onChange={(e) => {
                    handleFileUpload(e);
                    setAppState('upload-pipeline');
                  }}
                />

                {/* Secondary CTA */}
                <button
                  onClick={() => {
                    setActiveGatewayTab('chat');
                    setAppState('chat-pipeline');
                    if (chatMessages.length === 0) {
                      setChatMessages([{role: "assistant", content: "Welcome to OrphanLink. I am your clinical intake assistant. To help find matches, could you start by telling me your age?"}]);
                    }
                  }}
                  className="border-2 border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/40 font-semibold px-8 py-4 rounded-xl transition-all text-base flex items-center justify-center gap-3 cursor-pointer"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Talk to AI Intake Coordinator
                </button>
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold tracking-wider uppercase pt-4 border-t border-slate-200/50 dark:border-slate-800/40">
                FED CONTINUOUSLY VIA OFFICIAL RXNORM, MYGENE.INFO, AND CLINICALTRIALS.GOV APIS.
              </p>
            </div>

            {/* RIGHT: Medical / AI Illustration */}
            <div className="lg:col-span-6 w-full flex justify-center items-center">
              <div className="relative w-full max-w-[500px] aspect-square flex items-center justify-center bg-white/60 dark:bg-slate-900/40 rounded-3xl border border-slate-200/80 dark:border-slate-800/80 backdrop-blur-md overflow-hidden shadow-xl shadow-slate-100/50 dark:shadow-none">
                
                {/* Soft glowing blobs inside illustration */}
                <div className="absolute top-1/4 left-1/4 w-40 h-40 rounded-full bg-teal-500/10 dark:bg-teal-500/10 blur-2xl" />
                <div className="absolute bottom-1/4 right-1/4 w-40 h-40 rounded-full bg-blue-500/10 dark:bg-blue-500/10 blur-2xl" />
                
                {/* Subtle grid pattern inside */}
                <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:20px_20px] opacity-40" />

                {/* Central Pulsing matching node (OrphanLink matching engine) */}
                <div className="relative z-10 w-24 h-24 rounded-full bg-gradient-to-tr from-[#0F766E] to-[#2563EB] flex items-center justify-center shadow-lg shadow-teal-700/20">
                  <div className="absolute inset-0 rounded-full border border-white/20" />
                  <div className="absolute -inset-4 rounded-full border-2 border-teal-500/20 pulse-ring-element" />
                  <div className="absolute -inset-8 rounded-full border border-blue-500/10 pulse-ring-element" style={{ animationDelay: '1.5s' }} />
                  
                  {/* Custom medical shield icon inside node */}
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="M12 8v8"/>
                    <path d="M8 12h8"/>
                  </svg>
                </div>

                {/* Connected Lines SVG */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 500" fill="none" stroke="currentColor">
                  {/* Line to Patient profile (top-left) */}
                  <path d="M250,250 L120,120" stroke="url(#teal-blue-grad)" strokeWidth="2" strokeDasharray="5,5" />
                  
                  {/* Line to Trials recommendation (bottom-right) */}
                  <path d="M250,250 L380,380" stroke="url(#teal-blue-grad)" strokeWidth="2" strokeDasharray="5,5" />
                  
                  {/* Line to standardizing APIs (top-right) */}
                  <path d="M250,250 L380,120" stroke="url(#teal-blue-grad)" strokeWidth="1.5" />
                  
                  {/* Line to Validator agent (bottom-left) */}
                  <path d="M250,250 L120,380" stroke="url(#teal-blue-grad)" strokeWidth="1.5" />
                  
                  {/* Definitions for gradient */}
                  <defs>
                    <linearGradient id="teal-blue-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0F766E" />
                      <stop offset="100%" stopColor="#2563EB" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Floating Card 1: Biomarker Report (Top-Left) */}
                <div className="floating-card-1 absolute top-8 left-8 z-20 bg-white/95 dark:bg-slate-950/95 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-lg w-[190px] text-left hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Patient Intake</h4>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500">Report Ingested</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400">
                      <span>Variant:</span>
                      <span className="text-teal-600 dark:text-teal-400 font-bold">BRCA2+</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 px-2.5 py-1 rounded text-[10px] font-mono text-slate-600 dark:text-slate-400">
                      <span>Therapy:</span>
                      <span className="text-indigo-600 dark:text-indigo-400 font-bold">Olaparib</span>
                    </div>
                  </div>
                </div>

                {/* Floating Card 2: Clinical Trial recommendation (Bottom-Right) */}
                <div className="floating-card-2 absolute bottom-8 right-8 z-20 bg-white/95 dark:bg-slate-950/95 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl p-4 shadow-lg w-[220px] text-left hover:-translate-y-1 transition-transform duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Trial Recommendation</h4>
                      <p className="text-[9px] text-emerald-500 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        98% Eligibility Match
                      </p>
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 leading-snug line-clamp-1 border-t border-slate-100 dark:border-slate-800/60 pt-2 mt-1">
                    NCT054238 (Breast Cancer)
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Stage IV metastatic carcinoma</div>
                </div>

                {/* Floating Node 3: RxNorm Standardized (Top-Right) */}
                <div className="absolute top-12 right-12 z-20 bg-teal-500/10 dark:bg-teal-400/10 border border-teal-500/20 dark:bg-teal-950/30 dark:border-teal-900/50 rounded-full px-3 py-1.5 text-[9px] font-mono text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-teal-500 rounded-full animate-ping" />
                  <span>MyGene.info Standardized</span>
                </div>

                {/* Floating Node 4: Validator agent active (Bottom-Left) */}
                <div className="absolute bottom-12 left-12 z-20 bg-blue-500/10 dark:bg-blue-400/10 border border-blue-500/20 dark:bg-blue-950/30 dark:border-blue-900/50 rounded-full px-3 py-1.5 text-[9px] font-mono text-blue-800 dark:text-blue-300 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-ping" />
                  <span>Validator Loop: Active</span>
                </div>

                {/* Background DNA Helix (Left vertical helix illustration in bottom left / background) */}
                <svg className="absolute left-6 bottom-24 w-12 h-28 text-slate-350/40 dark:text-slate-700/20" viewBox="0 0 40 100">
                  <path d="M10,10 C30,30 30,50 10,70" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M30,10 C10,30 10,50 30,70" fill="none" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="16" y1="23" x2="24" y2="23" stroke="currentColor" strokeWidth="1" />
                  <line x1="20" y1="40" x2="20" y2="40" stroke="currentColor" strokeWidth="1" />
                  <line x1="16" y1="57" x2="24" y2="57" stroke="currentColor" strokeWidth="1" />
                </svg>

              </div>
            </div>
          </div>
        </div>

        {/* TRUST & CREDIBILITY SECTION */}
        <div className="w-full max-w-[1400px] mx-auto px-6 lg:px-10 space-y-16 animate-fade-up" style={{ animationDelay: '150ms' }}>
          
          {/* Row 1: Trusted By Medical Intelligence */}
          <div className="space-y-6 text-center">
            <h2 className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 uppercase">
              Trusted By Medical Intelligence
            </h2>
            <div className="flex flex-wrap justify-center gap-4">
              {[
                "ClinicalTrials.gov V2",
                "LangGraph",
                "ChromaDB",
                "BM25 & RRF",
                "RxNorm",
                "MyGene.info"
              ].map((integration) => (
                <span 
                  key={integration} 
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-white/70 dark:bg-slate-900/50 text-slate-700 dark:text-slate-355 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-md shadow-sm hover:shadow-md hover:border-[#0F766E]/40 hover:text-[#0F766E] transition-all duration-300"
                >
                  <span className="text-[#0F766E] dark:text-teal-400 font-bold">✓</span>
                  {integration}
                </span>
              ))}
            </div>
          </div>

          {/* Row 2: Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
            {[
              { value: "450K+", label: "Clinical Trials Indexed", desc: "Real-time updates directly from ClinicalTrials.gov V2 database." },
              { value: "95%", label: "Matching Precision", desc: "Normalized biomarker alignments map patients to optimal cohorts." },
              { value: "24/7", label: "AI Intake Assistance", desc: "Guided chatbot intakes symptoms and biomarker status autonomously." },
              { value: "Multi-Agent", label: "Safety Validation", desc: "Self-correcting validator logic screens and filters eligibility conflicts." }
            ].map((stat, i) => (
              <div 
                key={i} 
                className="group p-6 rounded-2xl bg-white/40 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/50 backdrop-blur-md shadow-sm hover:shadow-xl hover:shadow-[#0F766E]/5 hover:-translate-y-1 hover:border-[#0F766E]/30 dark:hover:border-teal-500/20 transition-all duration-500 text-left flex flex-col justify-between min-h-[160px] animate-fade-up"
                style={{ animationDelay: `${250 + i * 80}ms` }}
              >
                <div className="space-y-2">
                  <span className="block text-4xl font-extrabold text-slate-800 dark:text-slate-100 bg-gradient-to-r from-[#0F766E] to-[#2563EB] bg-clip-text text-transparent group-hover:from-teal-650 group-hover:to-blue-500 transition-all">
                    {stat.value}
                  </span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-200">
                    {stat.label}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-3">
                  {stat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* HOW ORPHANLINK WORKS SECTION */}
        <div id="how-it-works" className="w-full py-20 border-t border-slate-200/50 dark:border-slate-800/40 relative overflow-hidden rounded-3xl bg-gradient-to-b from-white to-teal-50/10 dark:from-slate-950 dark:to-slate-900/20">
          
          {/* Subtle DNA background elements */}
          <div className="absolute right-0 top-1/4 w-40 h-[400px] text-teal-600/5 dark:text-teal-400/5 pointer-events-none -z-10">
            <svg className="w-full h-full" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.8">
              <path d="M10,20 Q30,60 50,20 T90,20" />
              <path d="M10,60 Q30,20 50,60 T90,60" />
              <line x1="25" y1="36" x2="25" y2="44" stroke="currentColor" strokeWidth="1" />
              <line x1="50" y1="20" x2="50" y2="60" stroke="currentColor" strokeWidth="1" />
              <line x1="75" y1="44" x2="75" y2="36" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
          <div className="absolute left-0 bottom-1/4 w-40 h-[400px] text-blue-600/5 dark:text-blue-400/5 pointer-events-none -z-10">
            <svg className="w-full h-full" viewBox="0 0 100 200" fill="none" stroke="currentColor" strokeWidth="0.8">
              <path d="M10,20 Q30,60 50,20 T90,20" />
              <path d="M10,60 Q30,20 50,60 T90,60" />
              <line x1="25" y1="36" x2="25" y2="44" stroke="currentColor" strokeWidth="1" />
              <line x1="50" y1="20" x2="50" y2="60" stroke="currentColor" strokeWidth="1" />
              <line x1="75" y1="44" x2="75" y2="36" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>

          <div className="max-w-6xl mx-auto px-6 lg:px-10 text-center space-y-16 relative">
            <div className="space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                How OrphanLink Works
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-sm md:text-base">
                Our autonomous matching orchestrator automates standardizing medical entities, clinical validation, and eligibility checks.
              </p>
            </div>

            {/* Timeline Wrapper - Circular Flow on Desktop, Stack on Mobile */}
            <div className="relative w-full max-w-5xl mx-auto mt-16 lg:mt-24 pb-20">
              
              {/* --- DESKTOP CIRCULAR FLOW CHART --- */}
              <div className="hidden lg:block relative w-full aspect-square max-w-[800px] mx-auto">
                {/* Connecting Circular Line */}
                <div className="absolute inset-0 m-auto w-[550px] h-[550px] rounded-full border-2 border-dashed border-teal-200 dark:border-slate-700 animate-[spin_60s_linear_infinite] opacity-50 pointer-events-none" />
                <div className="absolute inset-0 m-auto w-[550px] h-[550px] rounded-full border border-blue-100 dark:border-slate-800 opacity-30 pointer-events-none" />

                {/* Central Hub */}
                <div className="absolute inset-0 m-auto w-44 h-44 rounded-full bg-white dark:bg-slate-900 shadow-2xl shadow-teal-500/10 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center z-20">
                  <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-teal-500/10 to-blue-500/10 animate-pulse" />
                  <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 relative z-10 flex items-center gap-1">
                    OrphanLink
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 relative z-10">AI Engine</span>
                </div>

                {/* Circular Items */}
                {[
                  {
                    num: "01",
                    title: "Upload Report",
                    desc: "OCR pipeline parses PDFs/TXTs.",
                    icon: (
                      <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    ),
                    color: "teal"
                  },
                  {
                    num: "02",
                    title: "Extract Biomarkers",
                    desc: "LLM extracts age, mutations, therapies.",
                    icon: (
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    ),
                    color: "blue"
                  },
                  {
                    num: "03",
                    title: "Standardize Entities",
                    desc: "Normalized via RxNorm & MyGene.",
                    icon: (
                      <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    ),
                    color: "teal"
                  },
                  {
                    num: "04",
                    title: "Search Database",
                    desc: "Query ClinicalTrials.gov V2 API.",
                    icon: (
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    ),
                    color: "blue"
                  },
                  {
                    num: "05",
                    title: "AI Validation",
                    desc: "Agents resolve safety conflicts.",
                    icon: (
                      <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    ),
                    color: "teal"
                  },
                  {
                    num: "06",
                    title: "Optimal Matches",
                    desc: "Ranked via Hybrid RAG + RRF.",
                    icon: (
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    ),
                    color: "blue"
                  }
                ].map((step, idx) => {
                  const angle = (idx * 60) - 90; // Start at top (-90 deg)
                  const radius = 275; // Distance from center
                  const x = Math.cos(angle * Math.PI / 180) * radius;
                  const y = Math.sin(angle * Math.PI / 180) * radius;
                  
                  return (
                    <div 
                      key={idx} 
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 w-[280px] animate-fade-up z-30"
                      style={{ 
                        left: `calc(50% + ${x}px)`, 
                        top: `calc(50% + ${y}px)`,
                        animationDelay: `${150 + idx * 100}ms`
                      }}
                    >
                      <div className={`group bg-white/90 dark:bg-slate-900/90 border ${step.color === 'teal' ? 'border-teal-100 dark:border-teal-900/50 hover:border-teal-300 dark:hover:border-teal-700/50' : 'border-blue-100 dark:border-blue-900/50 hover:border-blue-300 dark:hover:border-blue-700/50'} backdrop-blur-xl shadow-lg hover:shadow-xl rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-1 relative`}>
                        {/* Connecting Line to Center */}
                        <div 
                          className="absolute -z-10 bg-gradient-to-r from-transparent to-slate-200 dark:to-slate-800" 
                          style={{
                            height: '2px',
                            width: '40px',
                            top: '50%',
                            left: angle > 90 || angle < -90 ? '100%' : 'auto',
                            right: angle > -90 && angle < 90 ? '100%' : 'auto',
                            transform: angle > 90 || angle < -90 ? 'rotate(0deg)' : 'rotate(180deg)',
                            display: angle == 90 || angle == -90 ? 'none' : 'block'
                          }} 
                        />
                        
                        <div className="flex items-start gap-4">
                          <div className={`p-2.5 rounded-xl border shadow-inner shrink-0 group-hover:scale-105 transition-transform ${step.color === 'teal' ? 'bg-teal-50 dark:bg-teal-950/40 border-teal-200/30 text-teal-600' : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200/30 text-blue-600'}`}>
                            {step.icon}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{step.num}</span>
                              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">{step.title}</h3>
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{step.desc}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* --- MOBILE STACK VIEW --- */}
              <div className="lg:hidden space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-teal-500 before:via-blue-500 before:to-transparent px-4">
                {[
                  {
                    num: "01",
                    title: "Upload Report",
                    desc: "OCR pipeline parses PDFs/TXTs for extraction.",
                    icon: (
                      <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    )
                  },
                  {
                    num: "02",
                    title: "Extract Biomarkers",
                    desc: "LLM extracts age, mutations, therapies.",
                    icon: (
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                      </svg>
                    )
                  },
                  {
                    num: "03",
                    title: "Standardize Entities",
                    desc: "Normalized via RxNorm & MyGene APIs.",
                    icon: (
                      <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    )
                  },
                  {
                    num: "04",
                    title: "Search Database",
                    desc: "Query ClinicalTrials.gov V2 API in real-time.",
                    icon: (
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )
                  },
                  {
                    num: "05",
                    title: "AI Validation",
                    desc: "Agents resolve inclusion & safety conflicts.",
                    icon: (
                      <svg className="w-5 h-5 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    )
                  },
                  {
                    num: "06",
                    title: "Optimal Matches",
                    desc: "Ranked via Hybrid RAG + Reciprocal Rank Fusion.",
                    icon: (
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    )
                  }
                ].map((step, idx) => (
                  <div key={idx} className="relative flex items-start gap-6">
                    <div className="absolute left-0 w-10 h-10 rounded-full border-4 border-slate-50 dark:border-slate-950 bg-white dark:bg-slate-900 flex items-center justify-center z-10 shadow-sm">
                      <span className="text-[10px] font-bold text-slate-800 dark:text-slate-200">{step.num}</span>
                    </div>
                    <div className="flex-1 ml-12 p-5 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-sm">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800">
                          {step.icon}
                        </div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{step.title}</h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>


        {/* EMOTIONAL HERO/CTA SECTION */}
        <div className="w-full py-24 md:py-28 relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-900 via-teal-950 to-slate-950 text-white text-center shadow-xl border border-teal-800/30">
          {/* Blurred glowing circles */}
          <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-teal-500/20 blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] rounded-full bg-blue-500/10 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />

          {/* Dotted pattern overlay */}
          <div className="absolute inset-0 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none" />

          {/* Floating particles */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg className="w-full h-full" viewBox="0 0 800 400" fill="none">
              <circle cx="120" cy="80" r="3" className="fill-teal-300 animate-pulse" />
              <circle cx="340" cy="280" r="4" className="fill-blue-300 animate-pulse" style={{ animationDelay: '1.5s' }} />
              <circle cx="560" cy="120" r="2.5" className="fill-teal-400 animate-pulse" style={{ animationDelay: '3s' }} />
              <circle cx="720" cy="220" r="5" className="fill-blue-400 animate-pulse" style={{ animationDelay: '0.8s' }} />
              <circle cx="200" cy="320" r="3" className="fill-teal-200 animate-pulse" style={{ animationDelay: '2.5s' }} />
              <circle cx="640" cy="300" r="3.5" className="fill-teal-300 animate-pulse" style={{ animationDelay: '1.2s' }} />
            </svg>
          </div>

          {/* Soft DNA patterns */}
          <div className="absolute left-8 lg:left-16 top-1/2 -translate-y-1/2 w-24 h-48 text-teal-400/5 pointer-events-none hidden md:block">
            <svg className="w-full h-full" viewBox="0 0 40 100" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M10,10 C30,30 30,50 10,70" />
              <path d="M30,10 C10,30 10,50 30,70" />
              <line x1="16" y1="23" x2="24" y2="23" />
              <line x1="20" y1="40" x2="20" y2="40" />
              <line x1="16" y1="57" x2="24" y2="57" />
            </svg>
          </div>
          <div className="absolute right-8 lg:right-16 top-1/2 -translate-y-1/2 w-24 h-48 text-blue-400/5 pointer-events-none hidden md:block">
            <svg className="w-full h-full" viewBox="0 0 40 100" fill="none" stroke="currentColor" strokeWidth="1">
              <path d="M10,10 C30,30 30,50 10,70" />
              <path d="M30,10 C10,30 10,50 30,70" />
              <line x1="16" y1="23" x2="24" y2="23" />
              <line x1="20" y1="40" x2="20" y2="40" />
              <line x1="16" y1="57" x2="24" y2="57" />
            </svg>
          </div>

          <div className="relative z-10 max-w-3xl mx-auto space-y-8 flex flex-col items-center px-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight text-white max-w-2xl text-center">
              Helping Rare Disease Patients Find Hope Faster
            </h2>
            <p className="text-base md:text-lg text-teal-100/80 leading-relaxed max-w-xl font-normal text-center">
              OrphanLink combines AI, biomarker intelligence, and trusted medical data to help patients discover clinical trials tailored to their condition.
            </p>
            <div className="pt-4">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white hover:bg-teal-55 text-teal-900 font-bold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-95 transition-all text-base border-0 flex items-center justify-center gap-3 cursor-pointer group"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-teal-900 transition-transform group-hover:-translate-y-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Biomarker Report
              </button>
            </div>
          </div>
        </div>

        {/* PREMIUM FOOTER */}
        <footer id="contact" className="w-full bg-slate-950 text-slate-400 rounded-3xl border border-slate-900 p-8 md:p-12 lg:p-16 space-y-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
            {/* Logo and Description */}
            <div className="lg:col-span-5 space-y-4 text-left">
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold tracking-tight text-white">
                  OrphanLink
                </span>
                <span className="w-2 h-2 rounded-full bg-teal-400 mt-1 shadow-[0_0_8px_rgba(45,212,191,0.8)]"></span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed max-w-sm font-normal">
                Empowering rare disease and cancer patients to discover life-saving clinical trials through autonomous AI, biomarker intelligence, and real-time validation.
              </p>
            </div>

            {/* Quick Links */}
            <div className="lg:col-span-2 lg:col-start-7 space-y-4 text-left font-normal">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Quick Links</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button 
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="hover:text-teal-400 transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      const el = document.getElementById('how-it-works');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hover:text-teal-400 transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                  >
                    How It Works
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      const el = document.getElementById('why-orphanlink');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hover:text-teal-400 transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Why OrphanLink
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      const el = document.getElementById('about');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hover:text-teal-400 transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                  >
                    About
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => {
                      const el = document.getElementById('contact');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="hover:text-teal-400 transition-colors text-left bg-transparent border-0 p-0 cursor-pointer"
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div className="lg:col-span-2 space-y-4 text-left font-normal">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Resources</h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <a href="https://clinicaltrials.gov" target="_blank" rel="noopener noreferrer" className="hover:text-teal-400 transition-colors">
                    ClinicalTrials.gov
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-teal-400 transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-teal-400 transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div className="lg:col-span-3 space-y-4 text-left font-normal">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">Contact</h4>
              <ul className="space-y-2.5 text-sm">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-teal-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a href="mailto:support@orphanlink.ai" className="hover:text-teal-400 transition-colors">
                    support@orphanlink.ai
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© {new Date().getFullYear()} OrphanLink. All rights reserved.</p>
            <p className="flex items-center gap-1.5 font-normal">
              <span>Empowered by AI for Rare Disease Hope</span>
              <span className="w-1.5 h-1.5 bg-teal-400 rounded-full"></span>
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (appState === "chat-pipeline" && activeStep !== "evaluate" && activeStep !== "validate" && results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center max-w-4xl mx-auto h-[80vh] w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="w-full flex flex-col h-full border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden rounded-2xl relative bg-white dark:bg-slate-900">
          <CardHeader className="pb-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-sm">
            <CardTitle className="text-slate-800 dark:text-white text-xl font-bold flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Clinical Intake Coordinator
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col flex-1 p-0 overflow-hidden bg-slate-50/50 dark:bg-slate-950/20">
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm shadow-sm ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 rounded-bl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
            
            {/* Bottom Status Tracker */}
            <div className="px-6 py-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400 shadow-sm z-10">
              <div className="flex gap-4">
                <span className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${patientBiomarkers?.age ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                  Age: {patientBiomarkers?.age || 'Empty'}
                </span>
                <span className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${patientBiomarkers?.mutations?.length > 0 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                  Mutations: {patientBiomarkers?.mutations?.length > 0 ? patientBiomarkers.mutations.join(', ') : 'Empty'}
                </span>
                <span className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${patientBiomarkers?.prior_therapies?.length > 0 ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>
                  Therapies: {patientBiomarkers?.prior_therapies?.length > 0 ? patientBiomarkers.prior_therapies.join(', ') : 'Empty'}
                </span>
              </div>
              {isUploading && <span className="text-teal-600 animate-pulse">Agent is typing...</span>}
            </div>
 
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <form onSubmit={handleChatSubmit} className="flex gap-3">
                <input
                  type="text"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-white transition-all shadow-inner"
                  placeholder="Type your response..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isUploading}
                />
                <Button type="submit" disabled={isUploading || !chatInput.trim()} className="bg-teal-600 hover:bg-teal-700 px-6 rounded-xl shadow-md transition-all hover:shadow-lg">
                  Send
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      

      {/* Missing Information Quiz Overlay */}
      <Dialog open={quizQuestions.length > 0} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-2xl rounded-xl">
          <DialogHeader className="border-b border-indigo-100 dark:border-slate-800 pb-4">
            <DialogTitle className="text-xl font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              Missing Information Detected
            </DialogTitle>
            <DialogDescription className="text-indigo-700 dark:text-indigo-400 mt-1">
              Please answer the following questions to continue matching.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleQuizSubmit} className="space-y-6 pt-4">
            {quizQuestions.map((q, idx) => (
              <div key={idx} className="space-y-2">
                <label className="block text-sm font-semibold text-slate-800 dark:text-slate-200">{q}</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-4 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                  placeholder="Type your answer here..."
                  value={quizAnswers[q] || ""}
                  onChange={(e) => setQuizAnswers({...quizAnswers, [q]: e.target.value})}
                />
              </div>
            ))}
            <div className="pt-2 flex justify-end">
              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 rounded-lg shadow-md transition-colors text-md">
                Submit Answers & Resume Optimization
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Right Pane: Results Canvas */}
      {results.length === 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-6xl mx-auto mt-8">
          {/* Left Column: Pipeline Tracker */}
          <Card className="min-h-[500px] bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800">
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4">
              <CardTitle className="text-xl font-semibold text-slate-800 dark:text-white">Pipeline Tracker</CardTitle>
            </CardHeader>
            <CardContent className="p-8 flex flex-col justify-start h-full">
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                {[
                  { id: "abstractor", label: "[1] Extracting & Parsing Text via PyMuPDF" },
                  { id: "intake", label: "[2] Standardizing via RxNorm/MyGene" },
                  { id: "evaluate", label: "[3] Matching & Evaluating Trials" },
                  { id: "validate", label: "[4] Executing Validator Safety Loop" },
                ].map((step, _, arr) => {
                  const stepIndex = arr.findIndex(s => s.id === step.id);
                  const currentIndex = arr.findIndex(s => s.id === activeStep) !== -1 ? arr.findIndex(s => s.id === activeStep) : 4;
                  const isActive = step.id === activeStep;
                  const isPast = stepIndex < currentIndex || activeStep === "done";
                  
                  return (
                    <div key={step.id} className="relative flex items-center gap-6">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 bg-white dark:bg-slate-950 shrink-0 z-10 shadow-sm transition-all duration-500 ${isPast ? 'border-emerald-500 text-emerald-500' : isActive ? 'border-blue-500 text-blue-500 ring-4 ring-blue-100 dark:ring-blue-900/50' : 'border-slate-200 dark:border-slate-800 text-slate-300 dark:text-slate-700'}`}>
                        {isPast ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : isActive ? (
                          <div className="w-3 h-3 bg-blue-500 rounded-full animate-ping" />
                        ) : (
                          <div className="w-2 h-2 bg-slate-200 dark:bg-slate-800 rounded-full" />
                        )}
                      </div>
                      <div className={`flex-1 p-4 rounded-xl border transition-all duration-500 ${isActive ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/50 shadow-md translate-x-2' : isPast ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-100 dark:border-emerald-900/50' : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 opacity-60'}`}>
                        <div className={`font-semibold text-sm ${isActive ? 'text-blue-700 dark:text-blue-400' : isPast ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{step.label}</div>
                        {isActive && <div className="text-xs text-blue-600 dark:text-blue-400 mt-1 animate-pulse">Running agentic node...</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Right Column: Progress Board */}
          <Card className="min-h-[500px] bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 flex flex-col relative overflow-hidden">
            {isUploading && activeStep && (
              <div className="absolute top-0 left-0 w-full h-1">
                <div className="h-full bg-blue-500 animate-pulse w-1/3 rounded-r-full" style={{ animationDuration: '2s' }}></div>
              </div>
            )}
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4 bg-slate-50/50 dark:bg-slate-950/20">
              <CardTitle className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  {isUploading ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-300 dark:bg-slate-600"></span>
                  )}
                </span>
                Live AI Reasoning Viewer
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 flex-1 flex flex-col justify-center">
              {isUploading ? (
                <div className="space-y-8 animate-in fade-in duration-500 w-full max-w-lg mx-auto">
                  <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
                    <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-inner">
                      <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">{getStageDetails(activeStep).title}</h3>
                      <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">Status: Running Active Node</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div className="bg-slate-50 dark:bg-slate-950/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono block mb-2 flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Action
                      </span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{getStageDetails(activeStep).doing}</p>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-950/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                      <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono block mb-2 flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" /> Why It Matters
                      </span>
                      <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{getStageDetails(activeStep).why}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-100/50 dark:border-indigo-900/30">
                        <span className="text-[10px] font-bold tracking-widest text-indigo-400 uppercase font-mono block mb-1">Technologies</span>
                        <p className="text-xs text-indigo-900 dark:text-indigo-300 font-medium leading-relaxed">{getStageDetails(activeStep).tech}</p>
                      </div>
                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-100/50 dark:border-emerald-900/30">
                        <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase font-mono block mb-1">Processing Info</span>
                        <p className="text-xs text-emerald-900 dark:text-emerald-300 font-medium leading-relaxed">{getStageDetails(activeStep).info}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4 my-auto text-slate-400 dark:text-slate-500">
                  <svg className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  <p>Awaiting document upload or chat intake to begin...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="w-full flex flex-col gap-16 mt-8 max-w-6xl mx-auto px-6 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* 1. PATIENT SUMMARY */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/></svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Patient Summary</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Age / Demographics</span>
                  <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{patientBiomarkers?.age || "Not detected"}</span>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col gap-3">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Active Mutations</span>
                  <div className="flex flex-wrap gap-2">
                    {patientBiomarkers?.active_mutations?.length > 0 ? (
                      patientBiomarkers.active_mutations.map((mut: string, i: number) => (
                        <Badge key={i} className="bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200/50 hover:bg-teal-100 rounded-lg px-3 py-1 font-mono">{mut}</Badge>
                      ))
                    ) : (
                      <span className="text-sm font-medium text-slate-400">None detected</span>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-6 flex flex-col gap-3">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Past Therapies</span>
                  <div className="flex flex-wrap gap-2">
                    {patientBiomarkers?.past_therapies?.length > 0 ? (
                      patientBiomarkers.past_therapies.map((tx: string, i: number) => (
                        <Badge key={i} className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400 border border-indigo-200/50 hover:bg-indigo-100 rounded-lg px-3 py-1 font-mono">{tx}</Badge>
                      ))
                    ) : (
                      <span className="text-sm font-medium text-slate-400">None detected</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* 2. MATCH CONFIDENCE & VALIDATION */}
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Evaluation Confidence</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Biomarkers Extracted", status: true },
                { label: "Entities Standardized", status: true },
                { label: "Inclusion Evaluated", status: true },
                { label: "Exclusions Checked", status: true },
              ].map((step, i) => (
                <div key={i} className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm border border-emerald-200 dark:border-emerald-900/30 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-4 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-sm ring-4 ring-emerald-50 dark:ring-emerald-950/50">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-wide uppercase">{step.label}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 3. TRIAL RESULTS */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="9" x2="15" y1="9" y2="9"/><line x1="9" x2="15" y1="15" y2="15"/></svg>
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Evaluated Trials</h2>
              </div>
              <Button onClick={handleDownloadReport} className="bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm group hover:-translate-y-0.5">
                <svg className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Clinical Report
              </Button>
            </div>
            <div className="space-y-4">
              <Accordion className="w-full space-y-4">
                {results.map((res, i) => {
                  const isMatch = res.evaluation?.status === "MATCH";
                  const highlightClass = isMatch ? "bg-emerald-200 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300 font-medium" : "bg-rose-200 dark:bg-rose-900/30 text-rose-900 dark:text-rose-300 font-medium";

                  return (
                    <AccordionItem key={i} value={`item-${i}`} className={`group rounded-3xl border transition-all hover:shadow-lg ${isMatch ? 'border-emerald-200 dark:border-emerald-900/30 bg-white/80 dark:bg-slate-900/60' : 'border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/20 opacity-90'} px-6 overflow-hidden backdrop-blur-sm`}>
                      <AccordionTrigger className="hover:no-underline py-6">
                        <div className="flex justify-between items-start w-full pr-4 text-left gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <Badge variant={isMatch ? "default" : "secondary"} className={`${isMatch ? "bg-emerald-500 hover:bg-emerald-600 text-white border-0" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"} text-xs py-1 px-4 shadow-sm font-bold tracking-wide`}>
                                {isMatch ? "✓ MATCH" : "✕ EXCLUDED"}
                              </Badge>
                              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 shadow-inner">{res.trial?.nct_id}</span>
                            </div>
                            <h3 className={`text-lg font-bold leading-relaxed line-clamp-2 group-aria-expanded/accordion-trigger:line-clamp-none transition-all duration-300 pr-8 ${isMatch ? 'text-slate-800 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400'}`}>
                              {res.trial?.title}
                            </h3>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0 pb-8 space-y-6">
                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono block mb-2">Evaluator Agent Reasoning</span>
                          {res.evaluation?.reason}
                        </div>
                        
                        {/* Side-by-Side Highlight Comparison */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {/* Left: Patient Profile */}
                          <div className="bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
                            <h4 className="text-[10px] tracking-widest uppercase font-bold text-slate-500 dark:text-slate-400 mb-4 font-mono flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              Patient Context
                            </h4>
                            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 leading-relaxed shadow-inner font-mono">
                              {patientBiomarkers ? (
                                <HighlightText 
                                  text={`Age: ${patientBiomarkers.age || "Unknown"}
Mutations: ${(patientBiomarkers.active_mutations || []).join(", ") || "None"}
Therapies: ${(patientBiomarkers.past_therapies || []).join(", ") || "None"}`} 
                                  highlights={res.evaluation?.key_patient_terms || []} 
                                  highlightClass={highlightClass} 
                                  tooltips={patientBiomarkers.medical_terms_glossary || {}}
                                />
                              ) : (
                                "No biomarker data available."
                              )}
                            </div>
                          </div>

                          {/* Right: Trial Criteria */}
                          <div className="bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
                            <h4 className="text-[10px] tracking-widest uppercase font-bold text-slate-500 dark:text-slate-400 mb-4 font-mono flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              Trial Criteria ({res.trial?.chunk_type})
                            </h4>
                            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto max-h-80 leading-relaxed shadow-inner">
                              <HighlightText 
                                text={res.trial?.text} 
                                highlights={res.evaluation?.key_trial_terms || []} 
                                highlightClass={highlightClass} 
                                tooltips={patientBiomarkers?.medical_terms_glossary || {}}
                              />
                            </div>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>
          </section>

          {/* 6. PATIENT ACTION PLAN */}
          <section className="space-y-6 pt-12 border-t border-slate-200 dark:border-slate-800 pb-20">
            <div className="max-w-4xl mx-auto flex flex-col gap-4">
              <div className="flex items-center gap-3 pb-2 justify-center text-center flex-col">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-md ring-4 ring-emerald-50 dark:ring-emerald-900/30">
                  <Activity className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Your Action Plan</h2>
                  <p className="text-sm text-slate-500 mt-1 font-medium">Recommended next steps based on your trial matches</p>
                </div>
              </div>
              
              <div className="bg-white/80 dark:bg-slate-900/60 p-6 md:p-10 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-sm mt-4">
                <div className="space-y-4">
                  {taskList.map((task, i) => {
                    const isCompleted = completedTasks.has(i);
                    const isHighPriority = i === 0;
                    const Icon = task.toLowerCase().includes("schedule") || task.toLowerCase().includes("appointment") ? Calendar : task.toLowerCase().includes("consent") || task.toLowerCase().includes("document") ? FileText : Activity;
                    
                    return (
                      <div key={i} className={`flex flex-col p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-all hover:shadow-md cursor-pointer ${isCompleted ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-slate-100 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'}`} onClick={() => toggleTask(i)}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className={`p-1.5 rounded-lg ${isCompleted ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          {isHighPriority && !isCompleted && <Badge className="bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-400 font-bold border-0 text-[10px] uppercase tracking-wider px-2 py-0.5 shadow-sm">High Priority</Badge>}
                        </div>
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            id={`task-${i}`} 
                            checked={isCompleted} 
                            onCheckedChange={() => toggleTask(i)} 
                            className="mt-0.5 w-6 h-6 rounded-md shrink-0 bg-slate-50 dark:bg-slate-950 data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500 border-slate-300 dark:border-slate-700 transition-colors"
                          />
                          <label htmlFor={`task-${i}`} className={`text-base font-medium leading-relaxed cursor-pointer select-none transition-all pt-0.5 ${isCompleted ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                            {task}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                  {taskList.length === 0 && (
                     <div className="text-center text-slate-500 text-sm mt-10">No actions required yet.</div>
                  )}
                </div>
              </div>
            </div>
          </section>

        </div>
      )}

      {/* Floating Premium AI Clinical Coordinator */}
      {results && results.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {/* Chat Window */}
          {isPostMatchChatOpen && (
            <div className="mb-4 w-[420px] max-w-[calc(100vw-2rem)] h-[650px] max-h-[80vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 fade-in duration-300">
              {/* Header */}
              <div className="bg-gradient-to-r from-teal-600 to-teal-500 dark:from-slate-900 dark:to-slate-800 px-6 py-5 text-white flex items-center justify-between shadow-sm relative overflow-hidden">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
                    <Sparkles className="w-5 h-5 text-teal-50" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-base tracking-tight text-white leading-none mb-1">AI Clinical Coordinator</h3>
                    <p className="text-[11px] text-teal-100/90 font-medium tracking-wide">Ask about: ✓ Biomarkers ✓ Eligibility</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 relative z-10">
                  <button 
                    onClick={() => setIsPostMatchChatOpen(false)}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors text-white backdrop-blur-sm"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50/40 dark:bg-slate-950/40 scrollbar-thin flex flex-col relative">
                {postMatchChatLogs.map((msg, idx) => (
                  <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-sm shadow-sm leading-relaxed text-left ${
                      msg.role === 'user' 
                        ? 'bg-teal-600 text-white rounded-br-none ml-auto font-medium' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 rounded-bl-none mr-auto shadow-sm'
                    }`}>
                      {msg.role === 'user' ? (
                        msg.content
                      ) : (
                        <div className="prose prose-sm dark:prose-invert prose-p:leading-relaxed prose-pre:bg-slate-100 prose-pre:text-slate-800 max-w-none">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {isPostMatchThinking && (
                  <div className="flex justify-start w-full">
                    <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl rounded-bl-none border border-slate-150 dark:border-slate-800 px-5 py-4 text-sm max-w-[85%] mr-auto flex items-center gap-3 shadow-sm">
                      <div className="flex space-x-1.5">
                        <span className="w-2 h-2 bg-teal-400 dark:bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-2 h-2 bg-teal-400 dark:bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-2 h-2 bg-teal-400 dark:bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-xs font-bold tracking-wide uppercase text-teal-600 dark:text-teal-400">Analyzing...</span>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* 2x2 Suggestion Grid */}
              <div className="px-5 pt-4 pb-2 bg-white/95 dark:bg-slate-900/95 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  {getRecommendedQuestions().map((chipText, i) => (
                    <button
                      key={i}
                      onClick={() => handlePostMatchChatSubmit(undefined, chipText)}
                      disabled={isPostMatchThinking}
                      className="bg-teal-50/50 hover:bg-teal-100/50 dark:bg-teal-950/20 dark:hover:bg-teal-900/40 border border-teal-100 dark:border-teal-900/30 text-teal-800 dark:text-teal-300 text-[11px] px-3 py-2.5 rounded-xl transition-all hover:-translate-y-0.5 disabled:opacity-50 text-left font-medium leading-snug shadow-sm truncate h-12"
                      title={chipText}
                    >
                      {chipText}
                    </button>
                  ))}
                </div>
              </div>

              {/* Input Form */}
              <form 
                onSubmit={(e) => handlePostMatchChatSubmit(e)}
                className="p-5 bg-white/95 dark:bg-slate-900/95 flex gap-3 items-center"
              >
                <input
                  type="text"
                  value={postMatchChatInput}
                  onChange={(e) => setPostMatchChatInput(e.target.value)}
                  placeholder="Ask a question..."
                  disabled={isPostMatchThinking}
                  className="flex-1 px-5 py-4 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900 dark:text-white transition-all shadow-inner font-medium"
                />
                <button
                  type="submit"
                  disabled={isPostMatchThinking || !postMatchChatInput.trim()}
                  className="h-14 w-14 rounded-2xl bg-teal-600 dark:bg-teal-500 text-white flex items-center justify-center hover:bg-teal-700 dark:hover:bg-teal-600 active:scale-95 disabled:opacity-40 transition-all shadow-md shrink-0 hover:shadow-lg"
                >
                  <Send className="w-5 h-5 ml-1" />
                </button>
              </form>
            </div>
          )}

          {/* Floating Bubble Button */}
          {!isPostMatchChatOpen && (
            <button
              onClick={() => setIsPostMatchChatOpen(true)}
              className="group flex items-center gap-3 bg-teal-600 dark:bg-teal-500 text-white rounded-full shadow-xl shadow-teal-600/20 hover:shadow-teal-600/40 hover:-translate-y-1 active:scale-95 transition-all cursor-pointer relative border border-teal-500 dark:border-teal-400 focus:outline-none pr-6 pl-4 py-3 animate-in zoom-in duration-300"
              aria-label="Toggle AI Clinical Coordinator"
            >
              <div className="relative flex items-center justify-center">
                <span className="absolute inset-0 rounded-full bg-teal-400 animate-ping opacity-30"></span>
                <Sparkles className="w-6 h-6 relative z-10" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-bold leading-none mb-0.5 tracking-tight">AI Coordinator</span>
                <span className="text-[10px] font-medium text-teal-100 opacity-90 leading-none">Ask questions here</span>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
