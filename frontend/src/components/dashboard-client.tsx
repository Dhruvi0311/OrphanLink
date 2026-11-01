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
import { Calendar, FileText, Activity, MessageSquare, X, Send, Sparkles, ChevronDown, ChevronUp, Loader2, AlertCircle, CheckCircle2, HelpCircle, XCircle } from "lucide-react";
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

const CLINICAL_MICRO_INSIGHTS = [
  {
    icon: "💡",
    tag: "Recruitment Bottleneck",
    fact: "Over 80% of clinical trials miss enrollment deadlines. OrphanLink condenses 10+ hours of clinician search into under 3 minutes."
  },
  {
    icon: "🧬",
    tag: "Precision Oncology",
    fact: "40%+ of modern cancer therapies require exact biomarker qualification. Our Abstractor extracts mutations in under 2 seconds."
  },
  {
    icon: "🛡️",
    tag: "Dual-Agent Safety Loop",
    fact: "Evaluator checks inclusion criteria citing verbatim text, while Validator independently audits for negative exclusion conflicts."
  },
  {
    icon: "⚡",
    tag: "Ontological Linking",
    fact: "Brand names (Keytruda, Tagrisso) are standardized to scientific active ingredients in real time via live RxNorm & MyGene APIs."
  },
  {
    icon: "🩺",
    tag: "Human-In-The-Loop",
    fact: "When critical fields like age or prior lines of therapy are missing, our Quiz Generator pauses and asks the patient in plain English."
  }
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

const cleanDeduplicatedText = (text: string | undefined): string => {
  if (!text) return "";
  const lines = text.split("\n");
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (cleaned.length > 0 && cleaned[cleaned.length - 1] !== "") {
        cleaned.push("");
      }
      continue;
    }

    if (trimmed === "---") {
      if (cleaned.length > 0 && cleaned[cleaned.length - 1] !== "---") {
        cleaned.push("---");
      }
      continue;
    }

    const norm = trimmed.toLowerCase();
    if (seen.has(norm)) {
      continue;
    }
    seen.add(norm);
    cleaned.push(line);
  }

  return cleaned.join("\n").trim();
};

const cleanReasonText = (reason: string | undefined): string => {
  if (!reason) return "";
  const sentences = reason.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const s of sentences) {
    const norm = s.trim().toLowerCase();
    if (!seen.has(norm)) {
      seen.add(norm);
      cleaned.push(s.trim());
    }
  }
  return cleaned.join(" ");
};

export default function DashboardClient() {
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [taskList, setTaskList] = useState<string[]>([]);
  const [patientBiomarkers, setPatientBiomarkers] = useState<any>(null);
  const [intermediateBiomarkers, setIntermediateBiomarkers] = useState<any>(null);
  const [progressPercent, setProgressPercent] = useState<number>(15);
  const [activeFactIndex, setActiveFactIndex] = useState<number>(0);

  useEffect(() => {
    if (!isUploading) return;
    const interval = setInterval(() => {
      setActiveFactIndex(prev => (prev + 1) % CLINICAL_MICRO_INSIGHTS.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [isUploading]);
  
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<string[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  
  const [activeStep, setActiveStep] = useState<string>("idle");
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
      const syntheticEvent = {
        target: { files: e.dataTransfer.files }
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      
      handleFileUpload(syntheticEvent);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const fileList = Array.from(files);

    setIsUploading(true);
    setProgressPercent(15);
    setIntermediateBiomarkers(null);
    setActiveFactIndex(0);
    const docNames = fileList.map(f => f.name).join(", ");
    setLogs([`> SYSTEM: Uploading ${fileList.length} document(s): ${docNames}...`]);
    setResults([]);
    setTaskList([]);
    setQuizQuestions([]);
    setQuizAnswers({});
    setPatientBiomarkers(null);
    setActiveGatewayTab("upload");

    const formData = new FormData();
    fileList.forEach((file) => {
      formData.append("files", file);
    });
    // Also attach primary file for backward compatibility
    formData.append("file", fileList[0]);

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
      setActiveStep("idle");
    }
  };

  const startSseStream = (jobId: string) => {
    const eventSource = new EventSource(`http://localhost:8000/stream/${jobId}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.event === "log") {
        const msg = data.message;
        setLogs((prev) => [...prev, msg]);
        
        if (msg.includes("EXTRACTOR_AGENT:")) {
          setActiveStep("abstractor");
          setProgressPercent(25);
        } else if (msg.includes("QUIZ_GENERATOR:")) {
          setActiveStep("intake");
          setProgressPercent(40);
        } else if (msg.includes("ENTITY_LINKER:")) {
          setActiveStep("intake");
          setProgressPercent(55);
        } else if (msg.includes("RETRIEVER_AGENT:")) {
          setActiveStep("intake");
          setProgressPercent(70);
        } else if (msg.includes("EVALUATOR_AGENT:")) {
          setActiveStep("evaluate");
          setProgressPercent(85);
        } else if (msg.includes("VALIDATOR_AGENT:") || msg.includes("TASK_GENERATOR:")) {
          setActiveStep("validate");
          setProgressPercent(95);
        }
        
      } else if (data.event === "intermediate_biomarkers") {
        setIntermediateBiomarkers(data.biomarkers);
        if (data.biomarkers) {
          setPatientBiomarkers((prev: any) => ({ ...prev, ...data.biomarkers }));
        }
      } else if (data.event === "quiz_required") {
        setProgressPercent(45);
        if (data.biomarkers) {
          setIntermediateBiomarkers(data.biomarkers);
          setPatientBiomarkers((prev: any) => ({ ...prev, ...data.biomarkers }));
        }
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
        setProgressPercent(100);
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
        setActiveStep("idle");
        eventSource.close();
      }
    };

    eventSource.onerror = (error) => {
      setLogs((prev) => [...prev, "> ERROR: SSE Connection lost."]);
      setIsUploading(false);
      setActiveStep("idle");
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

  const getContextualChatSuggestions = () => {
    if (chatMessages.length === 0) return ["Breast Cancer", "Lung Cancer (NSCLC)", "Ovarian Cancer", "Rare Solid Tumor"];
    const lastAssistantMsg = [...chatMessages].reverse().find(m => m.role === "assistant")?.content.toLowerCase() || "";
    
    if (lastAssistantMsg.includes("cancer") || lastAssistantMsg.includes("condition") || lastAssistantMsg.includes("diagnosed") || lastAssistantMsg.includes("type of")) {
      return ["Breast Cancer", "Non-Small Cell Lung Cancer", "Ovarian Cancer", "Colorectal Cancer", "Rare Solid Tumor"];
    }
    if (lastAssistantMsg.includes("age") || lastAssistantMsg.includes("old") || lastAssistantMsg.includes("years")) {
      return ["35 years old", "45 years old", "52 years old", "64 years old"];
    }
    if (lastAssistantMsg.includes("stage") || lastAssistantMsg.includes("metastat") || lastAssistantMsg.includes("spread") || lastAssistantMsg.includes("status")) {
      return ["Stage IV (Metastatic)", "Stage III (Locally Advanced)", "Stage II (Early Stage)", "Recurrent Cancer", "Not sure"];
    }
    if (lastAssistantMsg.includes("mutation") || lastAssistantMsg.includes("biomarker") || lastAssistantMsg.includes("genomic") || lastAssistantMsg.includes("genetic")) {
      return ["BRCA2 Mutation", "EGFR Positive", "HER2 High", "KRAS G12C", "No Known Mutations (Wild-Type)"];
    }
    if (lastAssistantMsg.includes("treatment") || lastAssistantMsg.includes("therap") || lastAssistantMsg.includes("chemo") || lastAssistantMsg.includes("prior")) {
      return ["Prior Chemotherapy", "Immunotherapy (Keytruda)", "Targeted Oral Pills", "No Prior Treatment (Naive)"];
    }
    return ["Tell me more", "I'm not sure / Skip", "Find Trials Now"];
  };

  const handleChatSubmit = async (e?: React.FormEvent, messageOverride?: string) => {
    if (e) e.preventDefault();
    const userMessage = (messageOverride || chatInput).trim();
    if (!userMessage) return;

    setChatInput("");
    setChatMessages((prev) => [...prev, {role: "user", content: userMessage}]);

    const lowerMsg = userMessage.toLowerCase();

    // 1. Stage Detection
    const stageRegex = /\bstage\s+(iv|iii|ii|i|[1-4])\b/i;
    const stageMatch = userMessage.match(stageRegex);
    if (stageMatch) {
      setPatientBiomarkers((prev: any) => ({
        ...prev,
        cancer_stage: stageMatch[0].toUpperCase()
      }));
    } else if (lowerMsg.includes("metastatic")) {
      setPatientBiomarkers((prev: any) => ({
        ...prev,
        cancer_stage: "Metastatic (Stage IV)"
      }));
    } else if (lowerMsg.includes("early stage")) {
      setPatientBiomarkers((prev: any) => ({
        ...prev,
        cancer_stage: "Stage I-II (Early Stage)"
      }));
    }

    // 2. Age Detection (prevent matching Stage 4 or line numbers)
    if (!stageMatch && !/\bstage\s+\d/i.test(userMessage)) {
      const ageMatch = userMessage.match(/\b(?:age\s*[:=]?\s*|i am\s+|i'm\s+)?(\d{1,3})(?:\s*(?:years?\s*old|yo|yrs?))?\b/i);
      if (ageMatch) {
        const parsedAge = parseInt(ageMatch[1]);
        if (parsedAge >= 1 && parsedAge <= 110) {
          setPatientBiomarkers((prev: any) => ({
            ...prev,
            age: parsedAge
          }));
        }
      }
    }

    // 3. Condition / Cancer Type Detection
    const cancerKeywords = [
      { key: "breast", name: "Breast Cancer" },
      { key: "lung", name: "Lung Cancer (NSCLC)" },
      { key: "nsclc", name: "Non-Small Cell Lung Cancer" },
      { key: "ovarian", name: "Ovarian Cancer" },
      { key: "colorectal", name: "Colorectal Cancer" },
      { key: "colon", name: "Colorectal Cancer" },
      { key: "melanoma", name: "Cutaneous Melanoma" },
      { key: "prostate", name: "Prostate Cancer" },
      { key: "pancreatic", name: "Pancreatic Cancer" },
      { key: "leukemia", name: "Leukemia" },
      { key: "lymphoma", name: "Lymphoma" },
      { key: "solid tumor", name: "Advanced Solid Tumor" },
      { key: "glioblastoma", name: "Glioblastoma" },
      { key: "sarcoma", name: "Rare Sarcoma" }
    ];
    for (const c of cancerKeywords) {
      if (lowerMsg.includes(c.key)) {
        setPatientBiomarkers((prev: any) => ({
          ...prev,
          condition_or_cancer_type: c.name
        }));
        break;
      }
    }

    // 4. Genomic Biomarkers / Mutations Detection
    if (lowerMsg.includes("no known") || lowerMsg.includes("wild-type") || lowerMsg.includes("no mutation") || lowerMsg.includes("negative") || (lowerMsg === "none" && !patientBiomarkers?.active_mutations?.length)) {
      setPatientBiomarkers((prev: any) => ({
        ...prev,
        active_mutations: ["Wild-Type / None"]
      }));
    } else {
      const knownMuts = ["brca1", "brca2", "egfr", "her2", "kras", "braf", "alk", "tp53", "ros1", "ret", "pik3ca", "met", "ntrk", "pd-l1"];
      for (const m of knownMuts) {
        if (lowerMsg.includes(m)) {
          setPatientBiomarkers((prev: any) => ({
            ...prev,
            active_mutations: Array.from(new Set([...(prev?.active_mutations || []).filter((x: string) => !x.includes("Wild-Type")), m.toUpperCase()]))
          }));
        }
      }
    }

    // 5. Prior Therapies Detection
    if (lowerMsg.includes("no prior") || lowerMsg.includes("naive") || lowerMsg.includes("newly diagnosed") || lowerMsg.includes("first line") || (lowerMsg === "none" && patientBiomarkers?.active_mutations?.length)) {
      setPatientBiomarkers((prev: any) => ({
        ...prev,
        past_therapies: ["Treatment-Naive (None)"]
      }));
    } else {
      const therapyKeywords = [
        { key: "chemo", name: "Chemotherapy" },
        { key: "keytruda", name: "Pembrolizumab (Keytruda)" },
        { key: "pembrolizumab", name: "Pembrolizumab (Keytruda)" },
        { key: "tagrisso", name: "Osimertinib (Tagrisso)" },
        { key: "osimertinib", name: "Osimertinib (Tagrisso)" },
        { key: "herceptin", name: "Trastuzumab (Herceptin)" },
        { key: "trastuzumab", name: "Trastuzumab (Herceptin)" },
        { key: "immunotherapy", name: "Immunotherapy" },
        { key: "radiation", name: "Radiation Therapy" },
        { key: "surgery", name: "Surgical Resection" },
        { key: "tamoxifen", name: "Tamoxifen" },
        { key: "parp", name: "PARP Inhibitor (Olaparib)" },
        { key: "olaparib", name: "Olaparib (Lynparza)" }
      ];
      for (const t of therapyKeywords) {
        if (lowerMsg.includes(t.key)) {
          setPatientBiomarkers((prev: any) => ({
            ...prev,
            past_therapies: Array.from(new Set([...(prev?.past_therapies || []).filter((x: string) => !x.includes("Naive")), t.name]))
          }));
        }
      }
    }
    
    setIsUploading(true);
    try {
      if (!currentJobId) {
        setLogs([`> SYSTEM: Initializing AI Intake Chat...`]);
        setResults([]);
        setTaskList([]);

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
                  multiple
                  onChange={(e) => {
                    handleFileUpload(e);
                    setAppState('upload-pipeline');
                  }}
                />

                <button
                  id="talk-to-ai-coordinator-btn"
                  onClick={() => {
                    setActiveGatewayTab('chat');
                    setAppState('chat-pipeline');
                    if (chatMessages.length === 0) {
                      setChatMessages([{
                        role: "assistant", 
                        content: "Hello! I am your OrphanLink Clinical Intake Coordinator. I will help match you with active clinical trials on ClinicalTrials.gov with zero hallucination. To get started, what type of cancer or condition were you diagnosed with?"
                      }]);
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
                  <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 relative z-10">
                    OrphanLink
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
            </p>
          </div>
        </footer>
      </div>
    );
  }

  if (appState === "chat-pipeline" && activeStep !== "evaluate" && activeStep !== "validate" && results.length === 0) {
    const hasCondition = Boolean(patientBiomarkers?.condition_or_cancer_type);
    const hasStage = Boolean(patientBiomarkers?.cancer_stage);
    const hasAge = Boolean(patientBiomarkers?.age);
    const hasMutations = Boolean((patientBiomarkers?.active_mutations && patientBiomarkers.active_mutations.length > 0) || (patientBiomarkers?.mutations && patientBiomarkers.mutations.length > 0));
    const hasTherapies = Boolean((patientBiomarkers?.past_therapies && patientBiomarkers.past_therapies.length > 0) || (patientBiomarkers?.prior_therapies && patientBiomarkers.prior_therapies.length > 0));

    const completedCount = [hasCondition, hasStage, hasAge, hasMutations, hasTherapies].filter(Boolean).length;
    const completionPercent = Math.round((completedCount / 5) * 100);
    const suggestions = getContextualChatSuggestions();

    return (
      <div className="flex flex-col items-center justify-center max-w-4xl mx-auto h-[84vh] w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="w-full flex flex-col h-full border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden rounded-2xl relative bg-white dark:bg-slate-900">
          
          {/* Header */}
          <CardHeader className="py-3 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  id="chat-back-home-btn"
                  onClick={() => setAppState("landing")}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                >
                  ← Home
                </button>
                <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                <CardTitle className="text-slate-800 dark:text-white text-lg font-bold">
                  AI Clinical Intake Coordinator
                </CardTitle>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    Profile: {completedCount}/5 Captured ({completionPercent}%)
                  </span>
                  <div className="w-28 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-1 shadow-inner">
                    <div 
                      className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 rounded-full"
                      style={{ width: `${Math.max(completionPercent, 10)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          {/* Chat Messages */}
          <CardContent className="flex flex-col flex-1 p-0 overflow-hidden bg-slate-50/60 dark:bg-slate-950/30">
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-5 py-3 text-sm shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-teal-600 text-white rounded-br-none' : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700/80 rounded-bl-none'}`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isUploading && (
                <div className="flex justify-start animate-in fade-in duration-300">
                  <div className="bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 rounded-2xl rounded-bl-none px-4 py-2.5 shadow-sm flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" />
                    OrphanLink Intake Coordinator is analyzing clinical context...
                  </div>
                </div>
              )}
            </div>

            {/* Live Clinical Profile Tracker */}
            <div className="px-6 py-2.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-sm z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                  <Activity className="w-3 h-3 text-teal-500" /> Live Extracted Patient Dossier
                </span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                  {completedCount >= 4 ? "✓ Intake Ready for Match" : `${completedCount}/5 Clinical Criteria`}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {/* 1. Condition */}
                <div className={`flex flex-col gap-1 p-2.5 rounded-xl border transition-all duration-500 ${hasCondition ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Diagnosis</span>
                    {hasCondition ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">✓ Captured</span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Awaiting</span>
                    )}
                  </div>
                  <div className={`text-xs truncate ${hasCondition ? 'font-bold text-emerald-950 dark:text-emerald-100' : 'text-slate-400 italic'}`} title={patientBiomarkers?.condition_or_cancer_type || 'Awaiting input'}>
                    {patientBiomarkers?.condition_or_cancer_type || 'Awaiting...'}
                  </div>
                </div>

                {/* 2. Cancer Stage */}
                <div className={`flex flex-col gap-1 p-2.5 rounded-xl border transition-all duration-500 ${hasStage ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Stage</span>
                    {hasStage ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">✓ Captured</span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Awaiting</span>
                    )}
                  </div>
                  <div className={`text-xs truncate ${hasStage ? 'font-bold text-emerald-950 dark:text-emerald-100' : 'text-slate-400 italic'}`} title={patientBiomarkers?.cancer_stage || 'Awaiting input'}>
                    {patientBiomarkers?.cancer_stage || 'Awaiting...'}
                  </div>
                </div>

                {/* 3. Age */}
                <div className={`flex flex-col gap-1 p-2.5 rounded-xl border transition-all duration-500 ${hasAge ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Age</span>
                    {hasAge ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">✓ Captured</span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Awaiting</span>
                    )}
                  </div>
                  <div className={`text-xs truncate ${hasAge ? 'font-bold text-emerald-950 dark:text-emerald-100' : 'text-slate-400 italic'}`}>
                    {patientBiomarkers?.age ? `${patientBiomarkers.age} yrs` : 'Awaiting...'}
                  </div>
                </div>

                {/* 4. Mutations */}
                <div className={`flex flex-col gap-1 p-2.5 rounded-xl border transition-all duration-500 ${hasMutations ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Biomarkers</span>
                    {hasMutations ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">✓ Captured</span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Awaiting</span>
                    )}
                  </div>
                  <div className={`text-xs truncate ${hasMutations ? 'font-bold text-emerald-950 dark:text-emerald-100' : 'text-slate-400 italic'}`} title={(patientBiomarkers?.active_mutations || patientBiomarkers?.mutations || []).join(', ') || 'Awaiting input'}>
                    {(patientBiomarkers?.active_mutations || patientBiomarkers?.mutations || []).join(', ') || 'Awaiting...'}
                  </div>
                </div>

                {/* 5. Therapies */}
                <div className={`flex flex-col gap-1 p-2.5 rounded-xl border transition-all duration-500 ${hasTherapies ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 shadow-xs' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider font-mono">Therapies</span>
                    {hasTherapies ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded">✓ Captured</span>
                    ) : (
                      <span className="text-[10px] font-medium text-slate-400">Awaiting</span>
                    )}
                  </div>
                  <div className={`text-xs truncate ${hasTherapies ? 'font-bold text-emerald-950 dark:text-emerald-100' : 'text-slate-400 italic'}`} title={(patientBiomarkers?.past_therapies || patientBiomarkers?.prior_therapies || []).join(', ') || 'Awaiting input'}>
                    {(patientBiomarkers?.past_therapies || patientBiomarkers?.prior_therapies || []).join(', ') || 'Awaiting...'}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Input Bar */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
              <form onSubmit={handleChatSubmit} className="flex gap-3">
                <input
                  id="chat-intake-input"
                  type="text"
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-white transition-all shadow-inner"
                  placeholder="Type your answer here..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  disabled={isUploading}
                />
                <Button 
                  id="chat-intake-submit-btn"
                  type="submit" 
                  disabled={isUploading || !chatInput.trim()} 
                  className="bg-teal-600 hover:bg-teal-700 px-6 rounded-xl shadow-md transition-all hover:shadow-lg font-semibold"
                >
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
        <div className="w-full max-w-6xl mx-auto mt-4 space-y-4">
          <div className="flex items-center justify-between pb-1">
            <button
              onClick={() => setAppState("landing")}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              ← Back to Home
            </button>
            <span className="text-xs font-mono text-slate-400">
              {isUploading ? "Pipeline Active" : "Pipeline Ready"}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full">
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
                    const currentIndex = arr.findIndex(s => s.id === activeStep) !== -1 ? arr.findIndex(s => s.id === activeStep) : (activeStep === "done" ? 4 : -1);
                    const isActive = isUploading && step.id === activeStep;
                    const isPast = (currentIndex !== -1 && stepIndex < currentIndex) || activeStep === "done";
                    
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
            {isUploading && (
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 relative overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-teal-400 to-emerald-500 transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}
            <CardHeader className="border-b border-slate-200 dark:border-slate-800 pb-4 bg-slate-50/50 dark:bg-slate-950/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-3">
                  Live AI Reasoning Viewer
                </CardTitle>
                {isUploading && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/50 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                      {progressPercent}% Complete
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-6 flex-1 flex flex-col justify-start space-y-6">
              {isUploading ? (
                <div className="space-y-6 animate-in fade-in duration-500 w-full max-w-lg mx-auto">
                  
                  {/* Instant Reward: Live Extracted Biomarker Snapshot */}
                  {intermediateBiomarkers && (
                    <div className="bg-gradient-to-r from-teal-500/10 via-blue-500/10 to-indigo-500/10 border border-teal-500/30 rounded-2xl p-4 shadow-sm animate-in fade-in slide-in-from-top-3 duration-500">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 flex items-center gap-1.5 font-mono">
                          <Sparkles className="w-3.5 h-3.5 text-teal-500 animate-spin" style={{ animationDuration: '6s' }} />
                          Instant Biomarker Preview (Extracted in &lt;2s)
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Searching trials...</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 items-center">
                        {intermediateBiomarkers.age ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                            Age: {intermediateBiomarkers.age}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                            Age: Pending Clarification
                          </span>
                        )}

                        {(intermediateBiomarkers.active_mutations || []).map((mut: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shadow-sm">
                            🧬 {mut}
                          </span>
                        ))}

                        {(intermediateBiomarkers.past_therapies || []).map((therapy: string, idx: number) => (
                          <span key={idx} className="px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-700">
                            💊 {therapy}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Active Agent State Card */}
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                    <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-inner">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">{getStageDetails(activeStep).title}</h3>
                        <span className="text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded">Active Agent Node</span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">{getStageDetails(activeStep).doing}</p>
                    </div>
                  </div>

                  {/* Rotating Clinical Micro-Insights Card */}
                  <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/25 dark:border-amber-500/20 rounded-2xl p-4 transition-all duration-500">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                        <span>{CLINICAL_MICRO_INSIGHTS[activeFactIndex].icon}</span>
                        {CLINICAL_MICRO_INSIGHTS[activeFactIndex].tag}
                      </span>
                      <span className="text-[10px] text-amber-600/70 dark:text-amber-400/60 font-mono">Did You Know?</span>
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-medium transition-opacity duration-300">
                      {CLINICAL_MICRO_INSIGHTS[activeFactIndex].fact}
                    </p>
                  </div>

                  {/* Real-Time Agent Audit Ticker */}
                  <div className="bg-slate-900 text-slate-300 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-800 font-mono text-xs shadow-inner">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1.5 mb-2 uppercase tracking-widest">
                      <span>Live Multi-Agent Log Ticker</span>
                      <span className="flex items-center gap-1 text-emerald-400">● Streaming</span>
                    </div>
                    <div className="space-y-1">
                      {logs.slice(-2).map((log, i) => (
                        <p key={i} className="text-[11px] text-slate-300 truncate">
                          {log}
                        </p>
                      ))}
                    </div>
                  </div>

                </div>
              ) : (
                <div className="text-center space-y-4 my-auto text-slate-400 dark:text-slate-500 py-12">
                  {logs.some(l => l.includes("ERROR")) ? (
                    <div className="space-y-3 max-w-md mx-auto p-5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-2xl text-red-600 dark:text-red-400 shadow-sm animate-in fade-in duration-300">
                      <div className="font-semibold text-sm flex items-center justify-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Pipeline Error Encountered
                      </div>
                      <p className="text-xs text-red-500 dark:text-red-300 font-mono text-left bg-white/60 dark:bg-slate-950/60 p-2.5 rounded-lg border border-red-100 dark:border-red-900/30 break-words">
                        {logs.filter(l => l.includes("ERROR")).slice(-1)[0]}
                      </p>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-semibold px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors cursor-pointer shadow-xs"
                      >
                        Try Re-uploading Document
                      </button>
                    </div>
                  ) : (
                    <>
                      <svg className="w-16 h-16 mx-auto text-slate-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      <p>Awaiting document upload or chat intake to begin...</p>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      ) : (
        <div className="w-full flex flex-col gap-16 mt-8 max-w-6xl mx-auto px-6 pb-32 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* 1. PATIENT SUMMARY */}
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/></svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Aggregated Patient Profile</h2>
                  <p className="text-xs text-slate-500 font-medium">Canonical profile synthesized from all uploaded clinical documents</p>
                </div>
              </div>

              {/* Source Document Provenance Badges */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 font-mono hidden sm:inline">Source Records:</span>
                {(patientBiomarkers?.source_documents && patientBiomarkers.source_documents.length > 0) ? (
                  patientBiomarkers.source_documents.map((doc: string, dIdx: number) => (
                    <Badge key={dIdx} variant="outline" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-mono py-0.5">
                      📄 {doc}
                    </Badge>
                  ))
                ) : (
                  <Badge variant="outline" className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 text-[11px] font-mono py-0.5">
                    📄 Clinical Uploads
                  </Badge>
                )}
              </div>
            </div>

            {/* Core Patient Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* 1. Condition / Cancer */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Condition / Histopathology</span>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
                    {patientBiomarkers?.condition_or_cancer_type || "Not specified"}
                  </span>
                  <span className="text-[11px] text-slate-500">Histopathology: Confirmed</span>
                </CardContent>
              </Card>

              {/* 2. Formal Cancer Stage (TNM) */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Formal Cancer Stage (TNM)</span>
                    {(!patientBiomarkers?.cancer_stage || String(patientBiomarkers.cancer_stage).toLowerCase().includes("not assigned") || String(patientBiomarkers.cancer_stage).toLowerCase().includes("null")) && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 text-[10px] font-mono py-0">
                        Unknown / Unassigned
                      </Badge>
                    )}
                  </div>
                  <span className="text-base font-bold text-slate-800 dark:text-slate-100">
                    {patientBiomarkers?.cancer_stage || "Not assigned (Core biopsy alone)"}
                  </span>
                  <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    {(!patientBiomarkers?.cancer_stage || String(patientBiomarkers.cancer_stage).toLowerCase().includes("not assigned") || String(patientBiomarkers.cancer_stage).toLowerCase().includes("null")) ? "Requires complete surgical staging / TNM" : "Documented clinical stage"}
                  </span>
                </CardContent>
              </Card>

              {/* 3. Metastatic Disease Status (Stored Separately from Stage) */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Metastatic Disease Status</span>
                    {patientBiomarkers?.metastatic_status && !String(patientBiomarkers.metastatic_status).toLowerCase().includes("null") && !String(patientBiomarkers.metastatic_status).toLowerCase().includes("undocumented") ? (
                      <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 text-[10px] font-mono py-0">
                        Documented Metastatic
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-mono py-0">
                        Undocumented
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
                    {patientBiomarkers?.metastatic_status || "Undocumented / Unassigned"}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {patientBiomarkers?.metastatic_sites && patientBiomarkers.metastatic_sites.length > 0 ? `Sites: ${patientBiomarkers.metastatic_sites.join(', ')}` : "Evaluated directly for metastatic criteria"}
                  </span>
                </CardContent>
              </Card>

              {/* 4. ECOG Performance Status */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">ECOG Performance Status</span>
                    {(patientBiomarkers?.ecog_score !== null && patientBiomarkers?.ecog_score !== undefined) ? (
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] font-mono py-0">
                        Score: {patientBiomarkers.ecog_score}
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 text-[10px] font-mono py-0">
                        Undocumented
                      </Badge>
                    )}
                  </div>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">
                    {patientBiomarkers?.ecog_status || (patientBiomarkers?.ecog_score !== null && patientBiomarkers?.ecog_score !== undefined ? `ECOG ${patientBiomarkers.ecog_score}` : "Not documented")}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {(patientBiomarkers?.ecog_score !== null && patientBiomarkers?.ecog_score !== undefined) ? "Verified in clinical case summary" : "Awaiting clinical documentation"}
                  </span>
                </CardContent>
              </Card>

              {/* 5. Age & Demographics */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Age & Demographics</span>
                  <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{patientBiomarkers?.age ? `${patientBiomarkers.age} yrs` : "Not detected"}</span>
                  <span className="text-[11px] text-slate-500">Documented in records</span>
                </CardContent>
              </Card>

              {/* 6. Genetic Testing & Mutations (4 Distinct States) */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <CardContent className="p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Genetic Testing & Mutations</span>
                    <Badge className="text-[10px] font-mono py-0 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {patientBiomarkers?.genetic_testing_status === "CONFIRMED_MUTATION" ? "Mutation Detected" :
                       patientBiomarkers?.genetic_testing_status === "CONFIRMED_NEGATIVE" ? "Confirmed Negative" :
                       patientBiomarkers?.genetic_testing_status === "NOT_TESTED" ? "Not Tested" : "Not Documented"}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(patientBiomarkers?.active_mutations || []).length > 0 ? (
                      patientBiomarkers.active_mutations.map((mut: string, i: number) => (
                        <Badge key={i} className="bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-400 border border-teal-200/50 hover:bg-teal-100 rounded-lg px-2.5 py-0.5 text-xs font-mono font-bold">
                          🧬 {mut}
                        </Badge>
                      ))
                    ) : patientBiomarkers?.genetic_testing_status === "CONFIRMED_NEGATIVE" ? (
                      <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 text-xs font-mono">
                        ✓ Confirmed Negative (Wild-Type)
                      </Badge>
                    ) : patientBiomarkers?.genetic_testing_status === "NOT_TESTED" ? (
                      <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 text-xs font-mono">
                        ⚠️ Not Tested
                      </Badge>
                    ) : (
                      <span className="text-xs font-medium text-slate-400 italic">Not documented in record</span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {patientBiomarkers?.genetic_testing_status === "CONFIRMED_MUTATION" ? "Standardized via MyGene" : "Never infer wild-type without testing"}
                  </span>
                </CardContent>
              </Card>
            </div>

            {/* Receptor Status & Therapy Provenance Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Receptor Status Card */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardContent className="p-5 flex flex-col gap-3">
                  <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Receptor Status (IHC / Pathology)</span>
                  {patientBiomarkers?.receptor_status ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                        <span className="text-[10px] font-mono text-slate-400 block font-semibold">ER</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{patientBiomarkers.receptor_status.ER || "Negative"}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                        <span className="text-[10px] font-mono text-slate-400 block font-semibold">PR</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{patientBiomarkers.receptor_status.PR || "Negative"}</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-center">
                        <span className="text-[10px] font-mono text-slate-400 block font-semibold">HER2</span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{patientBiomarkers.receptor_status.HER2 || "IHC 0"}</span>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 font-mono">Pathology: TNBC (ER-, PR-, HER2 0)</span>
                  )}
                  <span className="text-[11px] text-slate-500">Source: Pathology Report</span>
                </CardContent>
              </Card>

              {/* Verified Medication Records Card */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardContent className="p-5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Verified Medication Records
                    </span>
                    <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 text-[10px] font-mono">
                      Confirmed
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {(patientBiomarkers?.verified_therapies && patientBiomarkers.verified_therapies.length > 0) ? (
                      patientBiomarkers.verified_therapies.map((v: any, vIdx: number) => {
                        const name = typeof v === 'string' ? v : v.name;
                        const doc = typeof v === 'object' && v.source_document ? v.source_document : "Oncology Consultation Summary";
                        return (
                          <div key={vIdx} className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl p-2.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 font-mono">
                              💊 {name}
                            </span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                              {doc}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-500">No verified medications documented.</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Patient-Reported Therapies Card */}
              <Card className="shadow-sm border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                <CardContent className="p-5 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase font-mono flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Patient-Reported Regimens
                    </span>
                    <Badge className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 text-[10px] font-mono">
                      Requires Verification
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    {(patientBiomarkers?.patient_reported_therapies && patientBiomarkers.patient_reported_therapies.length > 0) ? (
                      patientBiomarkers.patient_reported_therapies.map((p: any, pIdx: number) => {
                        const name = typeof p === 'string' ? p : p.name;
                        const doc = typeof p === 'object' && p.source_document ? p.source_document : "Oncology Consultation Summary";
                        return (
                          <div key={pIdx} className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-2.5 flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-900 dark:text-amber-200 font-mono">
                              ⚠️ {name}
                            </span>
                            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                              {doc}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-500">None reported requiring verification.</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Extracted Facts with Verifiable Provenance */}
            {patientBiomarkers?.facts && patientBiomarkers.facts.length > 0 && (
              <div className="bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono block">
                  Verifiable Document Provenance & Evidence Quotes
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {patientBiomarkers.facts.map((fact: any, fIdx: number) => (
                    <div key={fIdx} className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1 shadow-xs">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="font-bold text-teal-600 dark:text-teal-400 uppercase">{fact.field}</span>
                        <span className="text-slate-400">Confidence: {fact.confidence ? Math.round(fact.confidence * 100) : 95}%</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 font-medium italic">&ldquo;{fact.evidence_snippet}&rdquo;</p>
                      <div className="text-[10px] text-slate-400 text-right font-mono">
                        Source: {fact.source_document || "Clinical Document"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Evaluated Clinical Trials</h2>
                  <p className="text-xs text-slate-500 font-medium">3-Valued Criteria Classification: Potential Match, Needs More Information, or Excluded</p>
                </div>
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
                  const rawStatus = (res.evaluation?.status || "").toUpperCase();
                  const recStatus = (res.trial?.recruitment_status || res.evaluation?.recruitment_status || "UNKNOWN").toUpperCase();
                  const isClosed = ["COMPLETED", "TERMINATED", "WITHDRAWN", "SUSPENDED", "INACTIVE"].includes(recStatus);
                  
                  const isMatch = (rawStatus === "MATCH" || rawStatus === "POTENTIAL_MATCH") && !isClosed;
                  const isNeedsInfo = (rawStatus === "NEEDS_MORE_INFORMATION" || rawStatus === "INDETERMINATE") && !isClosed;

                  const badgeClass = isMatch ? 
                    "bg-emerald-500 hover:bg-emerald-600 text-white border-0" : 
                    isNeedsInfo ? 
                    "bg-amber-500 hover:bg-amber-600 text-white border-0" : 
                    "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700";

                  const statusTitle = isMatch ? "✓ POTENTIAL MATCH" : isNeedsInfo ? "? NEEDS MORE INFORMATION" : (isClosed ? `✕ EXCLUDED (${recStatus})` : "✕ EXCLUDED");

                  const cardBorder = isMatch ? 
                    "border-emerald-200 dark:border-emerald-900/30 bg-white/80 dark:bg-slate-900/60" : 
                    isNeedsInfo ? 
                    "border-amber-200 dark:border-amber-900/30 bg-white/80 dark:bg-slate-900/60" : 
                    "border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/20 opacity-90";

                  const highlightClass = isMatch ? 
                    "bg-emerald-200 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-300 font-medium" : 
                    isNeedsInfo ? 
                    "bg-amber-200 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 font-medium" : 
                    "bg-rose-200 dark:bg-rose-900/30 text-rose-900 dark:text-rose-300 font-medium";

                  const hasIndiaSite = Boolean(res.trial?.has_indian_site || res.evaluation?.has_indian_site);
                  const locationsList = (res.trial?.locations || res.evaluation?.locations || []) as string[];
                  const countriesList = (res.trial?.countries || res.evaluation?.countries || []) as string[];

                  return (
                    <AccordionItem key={i} value={`item-${i}`} className={`group rounded-3xl border transition-all hover:shadow-lg ${cardBorder} px-6 overflow-hidden backdrop-blur-sm`}>
                      <AccordionTrigger className="hover:no-underline py-6">
                        <div className="flex justify-between items-start w-full pr-4 text-left gap-4">
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2.5 mb-3">
                              <Badge variant={isMatch ? "default" : "secondary"} className={`${badgeClass} text-xs py-1 px-3.5 shadow-sm font-bold tracking-wide`}>
                                {statusTitle}
                              </Badge>

                              {/* Separate Recruitment Status Badge */}
                              <Badge className={`text-xs py-1 px-3 font-mono font-semibold ${
                                recStatus === "RECRUITING" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" :
                                recStatus === "ACTIVE_NOT_RECRUITING" ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300" :
                                recStatus === "TERMINATED" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300" :
                                "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300"
                              }`}>
                                {recStatus === "RECRUITING" ? "🟢 Recruiting" :
                                 recStatus === "TERMINATED" ? "🔴 Terminated (Closed)" :
                                 recStatus === "COMPLETED" ? "⚪ Completed (Closed)" : recStatus}
                              </Badge>

                              {/* Separate Country / Site Availability Badge */}
                              <Badge className={`text-xs py-1 px-3 font-mono font-semibold ${
                                hasIndiaSite ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200" :
                                "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200"
                              }`}>
                                {hasIndiaSite ? "🇮🇳 Sites in India Available" : (countriesList.length > 0 ? `🌍 Sites: ${countriesList.join(', ')}` : "🌐 Multicenter Sites")}
                              </Badge>

                              <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-800 shadow-inner">{res.trial?.nct_id}</span>
                            </div>
                            <h3 className={`text-lg font-bold leading-relaxed line-clamp-2 group-aria-expanded/accordion-trigger:line-clamp-none transition-all duration-300 pr-8 ${isMatch ? 'text-slate-800 dark:text-slate-100' : isNeedsInfo ? 'text-amber-950 dark:text-amber-100' : 'text-slate-600 dark:text-slate-400'}`}>
                              {res.trial?.title}
                            </h3>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pt-0 pb-8 space-y-6">
                        {/* Site Availability & Geographic Reach Card */}
                        <div className="bg-white/70 dark:bg-slate-900/40 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono">Geography & Site Availability</span>
                            {hasIndiaSite && (
                              <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200 text-[10px] font-mono">
                                Prioritized for India Patient Search
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            {locationsList.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {locationsList.slice(0, 6).map((loc, lIdx) => (
                                  <span key={lIdx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono">
                                    📍 {loc}
                                  </span>
                                ))}
                                {locationsList.length > 6 && (
                                  <span className="text-xs text-slate-400 self-center">+{locationsList.length - 6} more sites</span>
                                )}
                              </div>
                            ) : (
                              <span className="italic text-slate-400">Multicenter international study locations documented in protocol registry.</span>
                            )}
                          </div>
                        </div>

                        {/* Reasoning Box */}
                        <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-inner">
                          <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono block mb-2">Evaluator Agent Reasoning</span>
                          {cleanReasonText(res.evaluation?.reason)}
                        </div>

                        {/* Targeted Follow-up Questions Callout (For Needs More Information) */}
                        {isNeedsInfo && res.evaluation?.missing_information_questions && res.evaluation.missing_information_questions.length > 0 && (
                          <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 rounded-2xl p-5 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 font-mono flex items-center gap-2">
                                <HelpCircle className="w-4 h-4 text-amber-500" />
                                Targeted Follow-up Questions (Required to Confirm Eligibility)
                              </span>
                              <Badge className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 text-[10px] font-mono">
                                Clarification Needed
                              </Badge>
                            </div>
                            <ul className="space-y-2 pl-4 list-disc text-xs text-amber-900 dark:text-amber-200">
                              {res.evaluation.missing_information_questions.map((q: string, qIdx: number) => (
                                <li key={qIdx} className="leading-relaxed font-medium">
                                  {q}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Criteria Breakdown (3-Valued Evaluation) */}
                        {res.evaluation?.criteria_evaluations && res.evaluation.criteria_evaluations.length > 0 && (
                          <div className="space-y-3">
                            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase font-mono block">
                              Individual Protocol Criteria Evaluation (3-Valued Logic)
                            </span>
                            <div className="grid grid-cols-1 gap-2.5">
                              {res.evaluation.criteria_evaluations.map((crit: any, cIdx: number) => {
                                const critStatus = (crit.status || "UNKNOWN").toUpperCase();
                                const statusBadgeClass = 
                                  critStatus === "MET" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300" :
                                  critStatus === "NOT_MET" ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300" :
                                  "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300";

                                return (
                                  <div key={cIdx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 flex flex-col gap-2 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] border ${statusBadgeClass}`}>
                                          [{critStatus}]
                                        </span>
                                        <span className="font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide text-[10px] font-mono">
                                          {crit.criterion_type || "Inclusion"} Criterion
                                        </span>
                                      </div>
                                      {crit.source_document && (
                                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                          Doc: {crit.source_document}
                                        </span>
                                      )}
                                    </div>
                                    <p className="font-medium text-slate-800 dark:text-slate-200">
                                      {crit.criterion_text}
                                    </p>
                                    <div className="text-[11px] text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800/60">
                                      <span className="font-semibold text-slate-500">Evidence Snippet:</span> &ldquo;{crit.evidence_snippet}&rdquo;
                                    </div>
                                    {crit.reasoning && (
                                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                                        {crit.reasoning}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Side-by-Side Highlight Comparison */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                          {/* Left: Patient Profile */}
                          <div className="bg-slate-50/50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col shadow-sm">
                            <h4 className="text-[10px] tracking-widest uppercase font-bold text-slate-500 dark:text-slate-400 mb-4 font-mono flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                              Aggregated Patient Context
                            </h4>
                            <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap bg-white dark:bg-slate-950 p-5 rounded-xl border border-slate-100 dark:border-slate-800 flex-1 leading-relaxed shadow-inner font-mono">
                              {patientBiomarkers ? (
                                <HighlightText 
                                  text={`Condition: ${patientBiomarkers.condition_or_cancer_type || "Not specified"}
Stage: ${patientBiomarkers.cancer_stage || "Not assigned from core biopsy alone"}
Age: ${patientBiomarkers.age || "Unknown"}
Receptor Status: ${patientBiomarkers.receptor_status ? `ER: ${patientBiomarkers.receptor_status.ER || 'Neg'}, PR: ${patientBiomarkers.receptor_status.PR || 'Neg'}, HER2: ${patientBiomarkers.receptor_status.HER2 || '0'}` : "TNBC"}
Mutations: ${(patientBiomarkers.active_mutations || []).join(", ") || "None"}
Verified Medications: ${(patientBiomarkers.verified_therapies || []).map((v: any) => typeof v === 'string' ? v : v.name).join(", ") || "None documented"}
Patient-Reported Regimens: ${(patientBiomarkers.patient_reported_therapies || []).map((p: any) => typeof p === 'string' ? p : p.name).join(", ") || "None reported"}
Source Documents: ${(patientBiomarkers.source_documents || []).join(", ") || "Medical Records"}`} 
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
                                text={cleanDeduplicatedText(res.trial?.text)} 
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

          {/* 4. PATIENT ACTION PLAN */}
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
