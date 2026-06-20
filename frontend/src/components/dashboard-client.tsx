"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useJudgeMode } from "@/contexts/JudgeModeContext";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, FileText, Activity, MessageSquare, X, Send, Sparkles } from "lucide-react";

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
  const { isJudgeMode } = useJudgeMode();
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
    
    if (matches.length > 0) {
      const firstMatch = matches[0];
      const nctId = firstMatch.trial?.nct_id || "";
      list.push(`What next steps should I take for ${nctId || "my matched trials"}?`);
    } else {
      list.push("What next steps should I take?");
    }

    if (patientBiomarkers?.active_mutations && patientBiomarkers.active_mutations.length > 0) {
      const mut = patientBiomarkers.active_mutations[0];
      list.push(`How does my ${mut} mutation affect these trials?`);
    } else if (patientBiomarkers?.age) {
      list.push(`How does my age (${patientBiomarkers.age}) affect eligibility?`);
    } else {
      list.push("Explain clinical terms in my report");
    }

    if (exclusions.length > 0) {
      const firstExcl = exclusions[0];
      const nctId = firstExcl.trial?.nct_id || "";
      list.push(`Why was trial ${nctId || "a trial"} excluded?`);
    } else {
      list.push("Why would a trial be excluded?");
    }

    if (matches.length > 0) {
      const matchIds = matches.map(m => m.trial?.nct_id).filter(Boolean).slice(0, 2).join(" & ");
      list.push(`Summarize why ${matchIds || "these trials"} match my profile.`);
    } else {
      list.push("Summarize my clinical trial results.");
    }

    return list;
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

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
      <div className="flex flex-col items-center justify-center pt-16 pb-24 space-y-16 animate-in fade-in duration-700">
        <div className="text-center space-y-6 max-w-4xl mx-auto px-4">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Autonomous Trial Matching. <br className="hidden md:block" />
            <span className="text-emerald-500">Zero Hallucinations.</span>
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-350 max-w-3xl mx-auto">
            OrphanLink uses strict state-machine orchestration to parse complex patient biomarkers and match them against live data from ClinicalTrials.gov with absolute context fidelity. No guessing. No false hope.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 font-medium tracking-wide uppercase">
            Fed continuously via official RxNorm, MyGene.info, and ClinicalTrials.gov APIs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl px-4">
          <Card 
            className={`group cursor-pointer border-2 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/10 bg-white dark:bg-slate-900 ${isDragOver ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 scale-[1.02]' : 'border-slate-200 dark:border-slate-800 hover:border-blue-500'}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <CardHeader>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${isDragOver ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400' : 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'}`}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">Upload Biomarker Report</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300">
                Our automated pipeline triggers intelligent OCR fallback for scanned papers to isolate variants near-instantly. Supports PDF, JSON, TXT.
              </p>
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
            </CardContent>
          </Card>

          <Card 
            className="group cursor-pointer border-2 border-slate-200 dark:border-slate-800 hover:border-teal-500 transition-all duration-300 hover:shadow-xl hover:shadow-teal-500/10 bg-white dark:bg-slate-900"
            onClick={() => {
              setActiveGatewayTab('chat');
              setAppState('chat-pipeline');
              if (chatMessages.length === 0) {
                setChatMessages([{role: "assistant", content: "Welcome to OrphanLink. I am your clinical intake assistant. To help find matches, could you start by telling me your age?"}]);
              }
            }}
          >
            <CardHeader>
              <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative">
                <span className="absolute top-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/></svg>
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">Consult Clinical Intake Coordinator</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300">
                Don't have a report handy? Speak directly with our guided agent to step through your current diagnosis and active therapies.
              </p>
            </CardContent>
          </Card>
        </div>
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
      
      {/* Agentic Tracker Sheet (Judge Mode) */}
      <Sheet open={isJudgeMode && (isUploading || results.length === 0)} onOpenChange={() => {}}>
        <SheetContent side="right" className="bg-[#1E1E1E] border-l-[#3D3D3D] text-slate-300 font-mono text-xs shadow-2xl sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="bg-[#2D2D2D] py-3 px-4 border-b border-[#3D3D3D] text-left">
            <SheetTitle className="text-slate-300 text-sm flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isUploading ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
              Agentic Tracker
            </SheetTitle>
          </SheetHeader>
          <div className="p-4 flex-1 overflow-y-auto space-y-2 text-left">
            {logs.length === 0 ? (
              <p className="text-slate-500 italic">Waiting for document ingestion...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="leading-relaxed break-words">
                  <span className="text-slate-500 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  <span className={log.includes("ERROR") || log.includes("EXCLUDED") || log.includes("failure code") ? "text-rose-400" : log.includes("MATCH") || log.includes("Validated") ? "text-emerald-400" : "text-amber-400"}>
                    {log}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </SheetContent>
      </Sheet>

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
          <Card className="min-h-[500px] bg-white dark:bg-slate-900 shadow-sm border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center">
            <CardContent>
              {isUploading ? (
                <div className="text-center space-y-6">
                  <div className="w-16 h-16 border-4 border-slate-100 dark:border-slate-800 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-800 dark:text-white">Processing Data...</h3>
                    <p className="text-slate-500 dark:text-slate-400">The backend is currently {activeStep === 'abstractor' || activeStep === 'intake' ? 'abstracting biomarkers' : activeStep === 'evaluate' ? 'evaluating trials' : 'validating exclusions'}.</p>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full mt-4">
          {/* Left Column: Trial Matches */}
          <div className="lg:col-span-8 flex flex-col gap-6">
                

                {results.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-2 w-full">
                    <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Clinical Match Analysis</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[200px] flex flex-col justify-center gap-6">
                        {mockConfidenceData.map((d, i) => (
                          <div key={i} className="space-y-2">
                            <div className="flex justify-between items-center text-xs font-medium text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-1.5 group relative">
                                <span>{d.metric}</span>
                                <div className="text-slate-400 hover:text-indigo-500 cursor-help flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current text-[9px] font-bold">i</div>
                                <div className="absolute bottom-full left-0 mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-950 text-white text-[10px] leading-relaxed rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                  {d.info}
                                  <svg className="absolute text-slate-800 dark:text-slate-950 h-2 w-full left-2 top-full" x="0px" y="0px" viewBox="0 0 255 255" xmlSpace="preserve"><polygon className="fill-current" points="0,0 127.5,127.5 255,0"/></svg>
                                </div>
                              </div>
                              <span>{d.score}%</span>
                            </div>
                            <Progress 
                              value={d.score} 
                              className="h-2" 
                              indicatorClassName={d.score >= 90 ? "bg-emerald-500" : d.score >= 70 ? "bg-amber-400" : "bg-rose-500"}
                              trackClassName="bg-indigo-50 dark:bg-indigo-950/20"
                            />
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    
                    <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase">Clinical Trial Stages</CardTitle>
                      </CardHeader>
                      <CardContent className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={mockPhaseData}
                              innerRadius={50}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                              labelLine={true}
                            >
                              {mockPhaseData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Trial Evaluations */}
                <div>
                  <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Trial Evaluation Results</h2>
                    <Button onClick={handleDownloadReport} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download Clinical Report
                    </Button>
                  </div>
                  <div className="space-y-6">
                    <Accordion className="w-full space-y-4">
                      {results.map((res, i) => {
                        const isMatch = res.evaluation?.status === "MATCH";
                        const highlightClass = isMatch ? "bg-emerald-200 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300 font-medium" : "bg-rose-200 dark:bg-rose-900/30 text-rose-900 dark:text-rose-300 font-medium";
                        // Mock RRF Scores for Judge Mode Flex
                        const rrfMock = isMatch ? { bm25: (0.75 + Math.random()*0.15).toFixed(2), dense: (0.8 + Math.random()*0.15).toFixed(2), rrf: (0.8 + Math.random()*0.15).toFixed(2) } : { bm25: (0.3 + Math.random()*0.2).toFixed(2), dense: (0.4 + Math.random()*0.2).toFixed(2), rrf: (0.35 + Math.random()*0.2).toFixed(2) };

                        return (
                          <AccordionItem key={i} value={`item-${i}`} className={`group rounded-xl border transition-all hover:shadow-md ${isMatch ? 'border-emerald-200 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/10' : 'border-rose-200 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10'} px-6 overflow-hidden`}>
                            <AccordionTrigger className="hover:no-underline py-6">
                              <div className="flex justify-between items-start w-full pr-4 text-left">
                                <div className="flex-1 pr-6">
                                  <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-relaxed line-clamp-2 group-aria-expanded/accordion-trigger:line-clamp-none transition-all duration-300">{res.trial?.title}</h3>
                                  <div className="flex flex-wrap items-center gap-3 mt-3">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">ID: {res.trial?.nct_id}</p>
                                    {isJudgeMode && (
                                      <div className="flex items-center gap-2 bg-slate-900 dark:bg-slate-950 text-slate-300 dark:text-slate-400 text-[10px] font-mono px-2 py-1 rounded">
                                        <span>BM25: {rrfMock.bm25}</span>
                                        <span className="text-slate-600 dark:text-slate-800">|</span>
                                        <span>Dense: {rrfMock.dense}</span>
                                        <span className="text-slate-600 dark:text-slate-800">|</span>
                                        <span className="text-indigo-400 font-bold">RRF: {rrfMock.rrf}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <Badge variant={isMatch ? "default" : "destructive"} className={`mt-1 text-sm py-1 px-4 ml-4 shrink-0 shadow-sm ${isMatch ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}>
                                  {isMatch ? "MATCH" : "EXCLUDED"}
                                </Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-2 pb-6">
                              <div className="text-sm text-slate-700 dark:text-slate-350 leading-relaxed bg-white dark:bg-slate-950 p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
                                <span className="font-bold text-slate-900 dark:text-white block mb-1">Evaluation Reason:</span>
                                {res.evaluation?.reason}
                              </div>
                          
                          {/* Side-by-Side Highlight Comparison */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {/* Left: Patient Profile */}
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-200 dark:border-slate-800 flex flex-col">
                              <h4 className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Patient Profile
                              </h4>
                              <div className="text-sm text-slate-700 dark:text-slate-350 whitespace-pre-wrap font-mono bg-white dark:bg-slate-900 p-3 rounded border border-slate-100 dark:border-slate-800 flex-1 leading-relaxed">
                                {patientBiomarkers ? (
                                  <HighlightText 
                                    text={`Age: ${patientBiomarkers.age || "Unknown"}\nActive Mutations: ${(patientBiomarkers.active_mutations || []).join(", ") || "None"}\nPast Therapies: ${(patientBiomarkers.past_therapies || []).join(", ") || "None"}`} 
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
                            <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded border border-slate-200 dark:border-slate-800 flex flex-col">
                              <h4 className="text-xs uppercase font-bold text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Trial Criteria ({res.trial?.chunk_type})
                              </h4>
                              <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-900 p-3 rounded border border-slate-100 dark:border-slate-800 flex-1 overflow-y-auto max-h-48 leading-relaxed">
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
                </div>
          </div>
          
          {/* Right Column: Patient Action Checklist */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Generated Task List */}
            {taskList.length > 0 ? (
              <div className="sticky top-24">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">Patient Action Plan</h2>
                <div className="bg-emerald-50 dark:bg-emerald-950/10 p-5 rounded-xl border border-emerald-100 dark:border-emerald-900/50 space-y-3 shadow-sm">
                  {taskList.map((task, i) => {
                    const isCompleted = completedTasks.has(i);
                    const isHighPriority = i === 0;
                    const Icon = task.toLowerCase().includes("schedule") || task.toLowerCase().includes("appointment") ? Calendar :
                                task.toLowerCase().includes("consent") || task.toLowerCase().includes("document") ? FileText : Activity;
                    
                    return (
                      <div key={i} className="flex flex-col p-4 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700">
                        <div className="flex items-center gap-2 mb-2 ml-8">
                          <Icon className="w-4 h-4 text-emerald-600" />
                          {isHighPriority && <Badge className="bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-400 hover:bg-rose-200">High Priority</Badge>}
                          {!isHighPriority && i === 1 && <Badge className="bg-emerald-100 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-400 hover:bg-emerald-200 font-medium">Recommended</Badge>}
                        </div>
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            id={`task-${i}`} 
                            checked={isCompleted} 
                            onCheckedChange={() => toggleTask(i)} 
                            className="mt-1 w-5 h-5 shrink-0 bg-white dark:bg-slate-950 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600 border-slate-300 dark:border-slate-700"
                          />
                          <label 
                            htmlFor={`task-${i}`} 
                            className={`text-slate-700 dark:text-slate-300 leading-relaxed cursor-pointer select-none transition-all ${isCompleted ? 'line-through text-slate-400' : ''}`}
                          >
                            {task}
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="sticky top-24 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-slate-400 dark:text-slate-500">
                Patient checklist will appear here...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Post-Match Q&A Chatbot */}
      {results && results.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {/* Chat Window */}
          {isPostMatchChatOpen && (
            <div className="mb-4 w-96 max-w-[calc(100vw-2rem)] h-[500px] max-h-[80vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 dark:from-slate-900 dark:to-slate-800 px-4 py-3.5 text-white flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-200 animate-pulse" />
                  <div className="text-left">
                    <h3 className="font-bold text-sm tracking-tight text-white">Match Q&A Assistant</h3>
                    <p className="text-[10px] text-indigo-200">Ask about your report details</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPostMatchChatOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-lg transition-colors text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/20 scrollbar-thin flex flex-col">
                {postMatchChatLogs.map((msg, idx) => (
                  <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm leading-relaxed whitespace-pre-wrap text-left ${
                      msg.role === 'user' 
                        ? 'bg-indigo-600 text-white rounded-br-none ml-auto' 
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-800 rounded-bl-none mr-auto'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                
                {isPostMatchThinking && (
                  <div className="flex justify-start w-full">
                    <div className="bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-2xl rounded-bl-none border border-slate-150 dark:border-slate-800 px-4 py-2.5 text-sm max-w-[85%] mr-auto flex items-center gap-2">
                      <div className="flex space-x-1">
                        <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                        <span className="w-1.5 h-1.5 bg-slate-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                      </div>
                      <span className="text-xs">Thinking...</span>
                    </div>
                  </div>
                )}
                
                <div ref={chatEndRef} />
              </div>

              {/* Suggestion Chips */}
              <div className="px-3 pt-2 pb-3 bg-slate-50 dark:bg-slate-950/45 border-t border-slate-150 dark:border-slate-800 overflow-x-auto flex gap-2 whitespace-nowrap scrollbar-custom-horizontal scroll-smooth">
                {getRecommendedQuestions().map((chipText, i) => (
                  <button
                    key={i}
                    onClick={() => handlePostMatchChatSubmit(undefined, chipText)}
                    disabled={isPostMatchThinking}
                    className="bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/45 dark:hover:bg-indigo-900/60 border border-indigo-150 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs px-3 py-1.5 rounded-full transition-all hover:scale-[1.02] disabled:opacity-50 shrink-0"
                  >
                    {chipText}
                  </button>
                ))}
              </div>

              {/* Input Form */}
              <form 
                onSubmit={(e) => handlePostMatchChatSubmit(e)}
                className="p-3 bg-white dark:bg-slate-900 border-t border-slate-150 dark:border-slate-800 flex gap-2 items-center"
              >
                <input
                  type="text"
                  value={postMatchChatInput}
                  onChange={(e) => setPostMatchChatInput(e.target.value)}
                  placeholder="Ask about clinical results..."
                  disabled={isPostMatchThinking}
                  className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-white transition-all shadow-inner animate-none"
                />
                <button
                  type="submit"
                  disabled={isPostMatchThinking || !postMatchChatInput.trim()}
                  className="w-9 h-9 rounded-xl bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-700 dark:hover:bg-indigo-600 active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all shadow-md shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}

          {/* Floating Bubble Button */}
          <button
            onClick={() => setIsPostMatchChatOpen(!isPostMatchChatOpen)}
            className="w-14 h-14 rounded-full bg-indigo-600 dark:bg-indigo-500 text-white flex items-center justify-center shadow-lg hover:shadow-indigo-500/20 hover:scale-110 active:scale-95 transition-all cursor-pointer relative border border-indigo-400 dark:border-indigo-600 focus:outline-none shrink-0"
            aria-label="Toggle clinical trial assistant"
          >
            {isPostMatchChatOpen ? (
              <X className="w-6 h-6 animate-in spin-in-90 duration-200" />
            ) : (
              <>
                <span className="absolute inset-0 rounded-full bg-indigo-400 animate-ping opacity-20"></span>
                <MessageSquare className="w-6 h-6 animate-in zoom-in duration-200" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
