'use client';

import { useState, type KeyboardEventHandler, useEffect, useRef, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "next-themes";
import { flushSync, createPortal } from "react-dom";
import {
  Activity,
  BookOpenCheck,
  Bot,
  Network,
  SendHorizontal,
  Users,
  Sun,
  Moon,
  Sparkles,
  Scale,
  Smile,
  PartyPopper,
  Plus,
  Trash2,
  Hourglass,
  ExternalLink,
  Gavel,
  AlertTriangle,
  Tag,
  Mic,
  ChevronDown,
  Check,
  Copy,
  CheckCircle2,
  MicOff,
  Menu,
  X
} from "lucide-react";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface TooltipProps {
  content: string;
  rect: DOMRect | null;
  onClose: () => void;
  onMouseEnter: () => void;
  linkUrl: string;
}

const PortalTooltip = ({ content, rect, onClose, onMouseEnter, linkUrl }: TooltipProps) => {
  const [copied, setCopied] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, transform: '' });
  const [arrowClass, setArrowClass] = useState('');

  useEffect(() => {
    if (!rect) return;

    const tooltipWidth = 360;
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    
    if (left < 10) left = 10;
    if (typeof window !== "undefined" && left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 20;
    }

    const viewportHeight = window.innerHeight;
    const isTopHalf = rect.top < (viewportHeight / 2);

    let top, transform, arrow;

    if (isTopHalf) {
        top = rect.bottom + 12;
        transform = 'translateY(0)'; 
        arrow = "border-b-slate-800/95 border-t-0 -top-2";
    } else {
        top = rect.top - 12;
        transform = 'translateY(-100%)'; 
        arrow = "border-t-slate-800/95 border-b-0 -bottom-2";
    }

    setPosition({ top, left, transform });
    setArrowClass(arrow);
  }, [rect]);

  if (!rect || typeof document === "undefined") return null;
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return createPortal(
    <div 
      className="fixed z-[9999] w-[360px] max-w-[90vw] flex flex-col bg-slate-800/95 backdrop-blur-xl rounded-xl shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-200"
      style={{ left: `${position.left}px`, top: `${position.top}px`, transform: position.transform }}
      onMouseLeave={onClose}
      onMouseEnter={onMouseEnter}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/50 rounded-t-xl">
         <span className="text-xs font-bold text-indigo-300 flex items-center gap-2">
            <Scale className="w-3.5 h-3.5" /> 法規快覽
         </span>
         <div className="flex gap-2">
            <button 
                onClick={handleCopy}
                className="flex items-center gap-1 text-[10px] bg-white/10 hover:bg-white/20 px-2 py-1 rounded text-slate-300 transition-colors"
            >
                {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "已複製" : "複製內文"}
            </button>
         </div>
      </div>
      
      <div className="p-4 max-h-[40vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent">
        <div className="whitespace-pre-wrap text-sm leading-7 text-slate-200 text-justify font-sans">
           {content}
        </div>
      </div>
      
      <a 
         href={linkUrl} 
         target="_blank" 
         rel="noreferrer" 
         className="px-4 py-2 border-t border-white/10 text-indigo-300 text-[10px] flex items-center justify-end gap-1 hover:text-indigo-200 hover:bg-white/5 rounded-b-xl cursor-pointer transition-colors"
      >
         前往全國法規資料庫 <ExternalLink className="w-3 h-3" />
      </a>

      <div 
        className="absolute w-full h-6 bg-transparent"
        style={position.transform === 'translateY(0)' ? { top: -20 } : { bottom: -20 }} 
      ></div>

      <div 
        className={`absolute w-0 h-0 border-8 border-x-transparent ${arrowClass}`} 
        style={{ left: rect.left - position.left + rect.width/2 - 8 }}
      ></div>
    </div>,
    document.body
  );
};

const extractTextFromNode = (node: any): string => {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return node.toString();
  if (Array.isArray(node)) return node.map(extractTextFromNode).join("");
  if (node.props && node.props.children) return extractTextFromNode(node.props.children);
  return "";
};

// ★ Base64 解碼 (支援 UTF-8)
const b64DecodeUnicode = (str: string) => {
    try {
        return decodeURIComponent(atob(str).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    } catch (e) {
        console.error("Base64 Decode Error", e);
        return "無法解碼條文內容";
    }
};

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// --- 介面定義 ---

interface AnalysisData {
  domain: string;
  risk_level: string;
  keywords: string[];
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  analysis?: AnalysisData;
}

type ViewState = "chat" | "team" | "info";
type FontSize = "small" | "medium" | "large";
type ChatStyle = "professional" | "general" | "humorous"; 

const teamMembers = [
  { name: "龍禹丞", role: "隊長 / 雲端架構", desc: "資訊網路背景，掌握網路原理及架設，負責部署此專案到雲端主機以提供演示。", color: "from-blue-500 to-cyan-500" },
  { name: "陳嘉維", role: "AI 提示工程師", desc: "具備提示工程與語言模型調校經驗，負責優化大語言模型提示詞，提升輸出內容的準確率與語意一致性。", color: "from-indigo-500 to-purple-600" },
  { name: "胡允豪", role: "後端開發", desc: "精通 Python 程式與 API 整合，負責串接對話介面，打造友善互動體驗。", color: "from-emerald-500 to-teal-600" },
  { name: "彭冠綸", role: "領域專家 / 法規整合", desc: "熟悉交通與民事司法流程，負責整合法規資料庫、驗證法律相關疑問。", color: "from-orange-500 to-red-500" },
  { name: "呂育昇", role: "技術支援 / 爬蟲開發", desc: "自學爬蟲背景，精通多種程式語言，負責提供技術支援與資料蒐集。", color: "from-pink-500 to-rose-600" }
];

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewState>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  
  const [chatStyle, setChatStyle] = useState<ChatStyle>("general");
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const modeMenuRef = useRef<HTMLDivElement>(null);
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const startInputRef = useRef(""); 

  const [activeTooltip, setActiveTooltip] = useState<{content: string, rect: DOMRect, link: string} | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<{id: string, title: string}[]>([]);
  const [clientId, setClientId] = useState<string>("");
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    let id = localStorage.getItem("legal_ai_client_id");
    if (!id) {
        id = generateUUID();
        localStorage.setItem("legal_ai_client_id", id);
    }
    setClientId(id);
    fetchSessions(id);

    const handleClickOutside = (event: MouseEvent) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target as Node)) {
        setIsModeMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const fontSizeConfig = {
    small: "text-sm",
    medium: "text-base",
    large: "text-xl leading-relaxed"
  };

  const modeInfo = {
    professional: { label: "專業律師模式", shortLabel: "專業律師", desc: "嚴肅客觀，使用法律術語", icon: Scale, color: "text-slate-800 dark:text-slate-200", bg: "bg-slate-500/10" },
    general: { label: "一般民眾模式", shortLabel: "一般民眾", desc: "親切白話，適合日常諮詢", icon: Smile, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" },
    humorous: { label: "幽默風趣模式", shortLabel: "幽默風趣", desc: "鄉民梗，輕鬆好笑", icon: PartyPopper, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" }
  };

  const getRiskColor = (level: string) => {
      if (!level) return "text-slate-500";
      if (level.includes("高")) return "text-red-500";
      if (level.includes("中")) return "text-amber-500";
      return "text-emerald-500";
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
      }
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("您的瀏覽器不支援語音輸入功能，請使用 Chrome 或 Edge。");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-TW'; 
    recognition.continuous = true; 
    recognition.interimResults = true; 

    startInputRef.current = input;

    recognition.onstart = () => {
        setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (finalTranscript) {
          startInputRef.current += finalTranscript;
      }
      
      setInput(startInputRef.current + interimTranscript);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
      } else {
          console.error("語音識別錯誤:", event.error);
          setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    try {
        recognition.start();
    } catch (e) {
        console.error("無法啟動語音", e);
        setIsListening(false);
    }
  };

  const getLawLink = (text: string) => {
    const lawMap: Record<string, string> = {
        "道路交通管理處罰條例": "K0040012", "刑法": "C0000001", "中華民國刑法": "C0000001", "民法": "B0000001", "刑事訴訟法": "C0010001", "民事訴訟法": "B0010001"
    };
    let pcode = ""; let flno = "";
    const match = text.match(/(.+?)第(\d+)條/);
    if (match) {
        const name = match[1].trim(); flno = match[2];
        for (const key in lawMap) { if (name.includes(key) || key.includes(name)) { pcode = lawMap[key]; break; } }
    } else {
        for (const key in lawMap) { if (text.includes(key)) { pcode = lawMap[key]; break; } }
    }
    if (pcode && flno) return `https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=${pcode}&flno=${flno}`;
    else if (pcode) return `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${pcode}`;
    return `https://law.moj.gov.tw/Law/LawSearch.aspx?q=${encodeURIComponent(text)}`;
  };

  const handleTooltipEnter = (content: string, rect: DOMRect, link: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setActiveTooltip({ content, rect, link });
  };

  const handleTooltipLeave = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
        setActiveTooltip(null);
    }, 400); 
  };

  const fetchSessions = async (cid: string) => {
    if (!cid) return;
    try {
      const res = await fetch(`${API_URL}/sessions?client_id=${cid}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (e) { console.error("Failed to fetch sessions", e); }
  };

  const loadSession = async (id: string) => {
    try {
      setIsLoading(true); setSessionId(id); setCurrentView("chat");
      const res = await fetch(`${API_URL}/sessions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages);
      }
      setIsSidebarOpen(false);
    } finally { setIsLoading(false); }
  };

  const deleteSession = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation(); if(!confirm("確定刪除？")) return;
      try {
        await fetch(`${API_URL}/sessions/${id}`, { method: "DELETE" });
        setSessions(prev => prev.filter(s => s.id !== id));
        if (sessionId === id) startNewChat();
      } catch (e) { console.error("Delete failed", e); }
  };

  const startNewChat = () => {
    setSessionId(null); setMessages([]); setCurrentView("chat");
    setIsSidebarOpen(false);
  };

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim(); if (!trimmed || isLoading) return;
    
    if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
    }

    if (currentView !== "chat") setCurrentView("chat");
    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]); setInput(""); setIsLoading(true);
    
    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, style: chatStyle, session_id: sessionId, client_id: clientId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      
      setMessages((prev) => [...prev, { 
          role: "assistant", 
          content: data.reply,
          analysis: data.analysis
      }]);

      if (!sessionId && data.session_id) { setSessionId(data.session_id); fetchSessions(clientId); }
    } catch {
      setMessages((prev) => [ ...prev, { role: "assistant", content: "❌ 後端連線失敗，請確認伺服器是否運行中。" }, ]);
    } finally { setIsLoading(false); }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void handleSend(); }
  };

  const toggleTheme = async (e: React.MouseEvent<HTMLButtonElement>) => {
    const isDark = theme === 'dark'; const nextTheme = isDark ? "light" : "dark";
    if (!(document as any).startViewTransition) { setTheme(nextTheme); return; }
    const x = e.clientX; const y = e.clientY;
    const endRadius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = (document as any).startViewTransition(() => { flushSync(() => { setTheme(nextTheme); }); });
    await transition.ready;
    const clipPath = [ `circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)` ];
    document.documentElement.animate( { clipPath: clipPath }, { duration: 800, easing: "ease-in", pseudoElement: "::view-transition-new(root)", } );
  };

  const ThemeToggle = () => {
    if (!mounted) return <div className="w-16 h-8 bg-slate-200 rounded-full" />;
    const isDark = theme === 'dark';
    return (
      <button onClick={toggleTheme} className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors duration-500 ease-in-out focus:outline-none shadow-inner border border-white/10 ${isDark ? 'bg-slate-800' : 'bg-blue-200'}`} aria-label="切換日夜模式">
        <span className={`inline-flex h-6 w-6 transform rounded-full bg-white shadow-lg transition-all duration-500 items-center justify-center relative overflow-hidden ${isDark ? 'translate-x-9' : 'translate-x-1'}`}>
           <Sun className={`absolute w-4 h-4 text-amber-500 transition-all duration-500 ease-in-out ${isDark ? 'opacity-0 rotate-180 scale-0' : 'opacity-100 rotate-0 scale-100'}`} strokeWidth={2.5} />
           <Moon className={`absolute w-4 h-4 text-indigo-600 transition-all duration-500 ease-in-out ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-180 scale-0'}`} strokeWidth={2.5} />
        </span>
      </button>
    );
  };

  const markdownComponents = useMemo(() => ({
    p: ({ children }: any) => <div className="mb-2 last:mb-0 leading-7 break-words whitespace-pre-wrap">{children}</div>,
    a: ({ node, href, children, ...props }: any) => {
        const hrefStr = href || "";
        
        // 攔截 Fake HTTPS
        const isLawLink = hrefStr.startsWith("https://law.ai/view?data=");
        const rawText = extractTextFromNode(children); 
        
        if (isLawLink) {
            let decodedContent = "";
            try {
                const b64 = hrefStr.split("data=")[1];
                decodedContent = b64DecodeUnicode(b64);
            } catch {
                decodedContent = "無法讀取條文內容";
            }
            
            const realLink = getLawLink(rawText); 
            
            return (
                <span 
                className="font-bold text-indigo-600 dark:text-amber-400 border-b-2 border-dashed border-indigo-300 dark:border-amber-500/50 hover:bg-indigo-50 dark:hover:bg-amber-400/10 px-1 rounded cursor-pointer transition-colors inline-block select-none"
                onMouseEnter={(e) => { const rect = e.currentTarget.getBoundingClientRect(); handleTooltipEnter(decodedContent, rect, realLink); }}
                onMouseLeave={handleTooltipLeave}
                onClick={(e) => e.preventDefault()}
                >📘 {children}</span>
            );
        }
        return <a href={href} className="text-blue-500 underline break-all hover:text-blue-600" target="_blank" {...props}>{children}</a>;
    },
    strong: ({node, ...props}: any) => <span className="font-bold text-indigo-600 dark:text-amber-400" {...props} />,
    ul: (props: any) => <ul className="ml-5 list-disc space-y-2 my-2 text-slate-700 dark:text-slate-300" {...props} />,
    li: (props: any) => <li className="pl-1" {...props} />,
    h1: (props: any) => <h1 className="text-xl font-bold text-slate-900 dark:text-white my-3" {...props} />,
    h2: (props: any) => <h2 className="text-lg font-bold text-slate-900 dark:text-white my-2" {...props} />,
    blockquote: (props: any) => (
      <div className="mt-6 p-4 bg-slate-100/50 backdrop-blur-sm dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-red-900/30 flex gap-3 items-start shadow-inner">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider">免責聲明</p>
              <div className="text-sm text-slate-600 dark:text-slate-300 italic leading-relaxed break-words">{props.children}</div>
          </div>
      </div>
    ),
  }), []);

  const checkBrowserSupport = () => {
      if (typeof window !== 'undefined') {
          return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
      }
      return false;
  };
  
  const browserSupportsSpeechRecognition = checkBrowserSupport();

  const AnalysisPanel = ({ data }: { data: AnalysisData }) => {
      if (!data) return null;
      return (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">AI 判讀分析</h3><Activity className="h-3 w-3 text-slate-400" /></div>
                <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-white/5"><span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Gavel className="w-3 h-3" /> 領域</span><span className="text-xs font-bold text-slate-800 dark:text-white">{data.domain}</span></div>
                <div className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-950/40 rounded-lg border border-slate-200 dark:border-white/5"><span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> 風險</span><span className={`text-xs font-bold ${getRiskColor(data.risk_level)}`}>{data.risk_level}</span></div>
                </div>
            </div>
            <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2"><h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">知識圖譜識別</h3><Network className="h-3 w-3 text-slate-400" /></div>
                <div className="flex flex-wrap gap-1.5">{data.keywords.length > 0 ? (data.keywords.map((kw, idx) => (<span key={idx} className="px-2 py-1 text-[10px] font-medium rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-transparent flex items-center gap-1"><Tag className="w-2.5 h-2.5" /> {kw}</span>))) : (<span className="text-xs text-slate-500 italic">等待分析...</span>)}</div>
            </div>
        </div>
      );
  };

  const renderMainContent = () => {
    switch (currentView) {
      case "team":
        return (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-6 md:p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3"><Users className="text-indigo-500 dark:text-indigo-400" /> 團隊成員</h2>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {teamMembers.map((member) => (
                    <div key={member.name} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-indigo-500/50 transition hover:shadow-lg hover:-translate-y-1">
                        <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${member.color} mb-4 flex items-center justify-center text-xl font-bold text-white shadow-md`}>{member.name[0]}</div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white">{member.name}</h3>
                        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300 mb-3">{member.role}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{member.desc}</p>
                    </div>
                    ))}
                </div>
                </div>
            </div>
          </div>
        );

      case "info":
        return (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700">
            <div className="flex flex-col gap-6 animate-in fade-in duration-500">
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-6 md:p-8 shadow-sm">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-3"><BookOpenCheck className="text-emerald-500 dark:text-emerald-400" /> 作品說明</h2>
                <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
                    <div><h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">關於「今日張三又犯法了嗎？」</h3><p>本系統結合生成式 AI 與法律資料庫，打造一個可用對話方式進行互動的智慧法律顧問。</p></div>
                    <div><h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">核心技術架構</h3><ul className="list-disc list-inside space-y-2 ml-2"><li><span className="font-bold text-indigo-600 dark:text-indigo-400">RAG 雙軌檢索</span>：結合 ChromaDB 向量搜尋與 BM25 關鍵字搜尋。</li><li><span className="font-bold text-indigo-600 dark:text-indigo-400">AI 查詢改寫</span>：使用 Gemini 2.5 Flash 自動修正錯字。</li><li><span className="font-bold text-indigo-600 dark:text-indigo-400">互動式 UI</span>：提供即時的法條預覽與分析儀表板。</li></ul></div>
                </div>
                </div>
            </div>
          </div>
        );

      case "chat":
      default:
        const CurrentModeIcon = modeInfo[chatStyle].icon;
        const currentModeLabel = modeInfo[chatStyle].shortLabel;
        return (
          <div className="flex flex-1 flex-col relative h-full">
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6 md:py-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-slate-400 dark:text-slate-500 opacity-60">
                    <Bot className="h-16 w-16 mb-4 text-indigo-200 dark:text-indigo-900/40" /><p className="text-lg font-medium">還沒有對話紀錄</p><p className="text-sm">試著問問看「闖紅燈罰多少？」</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, index) => (
                        <div key={index} className="flex flex-col gap-2">
                            <div className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`relative w-fit min-w-0 max-w-[95%] md:max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${fontSizeConfig[fontSize]} ${msg.role === "user" ? "bg-indigo-600 text-white ml-auto" : "bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/5 mr-auto"} overflow-hidden break-words`}>
                                    {msg.role === "user" ? <div className="whitespace-pre-wrap break-words">{msg.content}</div> : <ReactMarkdown urlTransform={(url) => url} components={markdownComponents}>{msg.content}</ReactMarkdown>}
                                </div>
                            </div>
                            {msg.role === "assistant" && msg.analysis && (
                                <div className="w-full max-w-[95%] md:max-w-[85%] mr-auto px-1">
                                    <AnalysisPanel data={msg.analysis} />
                                </div>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex w-full justify-start animate-in fade-in duration-300">
                            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-white/5 flex items-center gap-3 shadow-sm">
                                <div className="relative"><Hourglass className="h-5 w-5 text-indigo-500 animate-spin duration-[2000ms]" /></div>
                                <span className="text-sm text-slate-500 dark:text-slate-400 animate-pulse font-medium">AI 正在翻閱六法全書...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                  </>
                )}
            </div>

            <div className="shrink-0 p-3 md:p-4 bg-transparent">
                <div className={`rounded-3xl border transition-all duration-300 relative flex flex-col bg-white dark:bg-slate-950/80 ${isListening ? 'border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.3)] ring-2 ring-red-400/20' : 'border-slate-200 dark:border-white/10 shadow-lg dark:shadow-black/50 focus-within:ring-2 focus-within:ring-indigo-500/20'}`}>
                    <textarea 
                        value={input} 
                        onChange={(e) => setInput(e.target.value)} 
                        onKeyDown={handleKeyDown} 
                        placeholder={isListening ? "正在聆聽中..." : "請用白話描述你的情況..."} 
                        className="w-full bg-transparent border-0 px-5 pt-3 pb-10 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-none min-h-[52px] rounded-3xl" 
                        rows={1} 
                    />
                    <div className="absolute bottom-2 left-3 right-3 flex justify-between items-center">
                        <div className="relative" ref={modeMenuRef}>
                            <button onClick={() => setIsModeMenuOpen(!isModeMenuOpen)} className={`flex items-center gap-2 px-2 py-1 rounded-full text-xs font-semibold transition-all hover:bg-slate-100 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 ${isModeMenuOpen ? 'bg-slate-100 dark:bg-white/10' : ''}`}>
                                <CurrentModeIcon className="w-3.5 h-3.5" /><span>{currentModeLabel}</span><ChevronDown className={`w-3 h-3 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isModeMenuOpen && (
                                <div className="absolute bottom-full left-0 mb-2 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                                    <div className="p-2"><div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">選擇模式</div>
                                        {Object.entries(modeInfo).map(([key, info]) => {
                                            const isSelected = chatStyle === key; const Icon = info.icon;
                                            return (<button key={key} onClick={() => { setChatStyle(key as ChatStyle); setIsModeMenuOpen(false); }} className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-500/20' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}><Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`} /><div className="flex-1"><div className={`text-sm font-bold ${isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>{info.shortLabel}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{info.desc}</div></div>{isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-1" />}</button>);
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                             {mounted && browserSupportsSpeechRecognition ? (
                                <button 
                                    type="button" 
                                    onClick={toggleListening} 
                                    className={`p-2 rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-red-500/50 shadow-lg scale-110' : 'hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400'}`} 
                                    title={isListening ? "停止錄音" : "語音輸入"}
                                >
                                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                                </button>
                             ) : (
                                <button type="button" className="p-2 rounded-full text-slate-300 dark:text-slate-600 cursor-not-allowed" title="您的瀏覽器不支援語音輸入或正在載入中"><Mic className="w-4 h-4" /></button>
                             )}
                             
                             <button onClick={() => handleSend()} disabled={isLoading || !input.trim()} className={`p-2 rounded-full transition-all flex items-center justify-center ${input.trim() ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-500 active:scale-95' : 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}><SendHorizontal className="h-4 w-4" /></button>
                        </div>
                    </div>
                </div>
                <div className="mt-1 text-center"><p className="text-[9px] text-slate-400 dark:text-slate-500">Gemini 可能會顯示不準確的資訊，請務必再次確認。</p></div>
              </div>
          </div>
        );
    }
  };

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-1000 overflow-hidden relative">
        
        {/* --- 手機版側邊欄 (Drawer) --- */}
        <div className={`lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />
        
        <aside className={`
            fixed top-0 bottom-0 left-0 z-50 w-80 bg-white/95 dark:bg-slate-900/95 p-5 shadow-2xl transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-72 lg:bg-white/80 lg:dark:bg-slate-950/70 lg:shadow-xl lg:backdrop-blur lg:border-r border-slate-200 dark:border-white/5 h-full flex flex-col overflow-y-auto
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">NextWave 2025</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50 whitespace-nowrap">今日張三又犯法了嗎？</h2>
                </div>
                <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white"><X className="w-6 h-6" /></button>
            </div>
            
            <button onClick={startNewChat} className="mb-4 w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-500 active:scale-95"><Plus className="h-5 w-5" /> 開啟新對話</button>

            <div className="flex-1 overflow-y-auto space-y-1 mb-4 pr-1 min-h-[150px] scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                <p className="px-2 text-xs font-semibold text-slate-400 mb-1">歷史紀錄</p>
                {sessions.length === 0 ? <p className="px-2 text-sm text-slate-500 italic">尚無對話</p> : sessions.map((session) => (
                    <div key={session.id} className={`group flex items-center gap-2 rounded-lg px-3 py-2 transition ${sessionId === session.id ? "bg-indigo-100 dark:bg-indigo-500/30" : "hover:bg-slate-100 dark:hover:bg-white/5"}`}>
                        <button onClick={() => loadSession(session.id)} className={`flex-1 text-left text-sm truncate ${sessionId === session.id ? "text-indigo-700 dark:text-indigo-200 font-medium" : "text-slate-600 dark:text-slate-400"}`}>{session.title}</button>
                        <button onClick={(e) => deleteSession(e, session.id)} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-slate-400 hover:text-red-500 transition"><Trash2 className="h-4 w-4" /></button>
                    </div>
                ))}
            </div>

            <div className="space-y-2 border-t border-slate-200 dark:border-white/10 pt-3 shrink-0">
                <button onClick={() => { setCurrentView("team"); setIsSidebarOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition"><Users className="h-4 w-4" /> 團隊成員</button>
                <button onClick={() => { setCurrentView("info"); setIsSidebarOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5 transition"><BookOpenCheck className="h-4 w-4" /> 作品說明</button>
            </div>

            <div className="mt-auto space-y-3 pt-3 shrink-0">
                <div className="rounded-2xl bg-slate-100 dark:bg-white/5 p-2">
                    <div className="flex justify-between items-center px-2 mb-1"><span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1"><Sparkles className="h-3 w-3" /> 字體大小</span></div>
                    <div className="flex gap-2">
                        <button onClick={() => setFontSize("small")} className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${fontSize === 'small' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'}`}>A</button>
                        <button onClick={() => setFontSize("medium")} className={`flex-1 rounded-xl py-1.5 text-sm font-bold transition ${fontSize === 'medium' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'}`}>A+</button>
                        <button onClick={() => setFontSize("large")} className={`flex-1 rounded-xl py-1.5 text-lg font-bold transition ${fontSize === 'large' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'}`}>A++</button>
                    </div>
                </div>
                <div className="rounded-2xl border border-indigo-100 dark:border-white/5 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-600 dark:via-indigo-500 dark:to-purple-600 p-3 shadow-sm dark:shadow-lg">
                    <p className="text-xs text-indigo-900 dark:text-white/80">RAG 資料庫狀態</p><div className="mt-1 flex items-center gap-2"><span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span><p className="text-lg font-semibold tracking-tight text-indigo-700 dark:text-white animate-pulse">連線中</p></div>
                </div>
            </div>
        </aside>

        {/* --- 主要內容區 --- */}
        <div className="flex-1 flex flex-col h-full relative">
            {/* 手機版 Header */}
            <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 shrink-0 z-20">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200">
                    <Menu className="w-6 h-6" />
                </button>
                <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">今日張三又犯法了嗎？</h1>
                <ThemeToggle />
            </div>

            {/* 電腦版右上角 Toggle */}
            <div className="hidden lg:block absolute top-6 right-8 z-[100]">
                <ThemeToggle />
            </div>

            {/* 內容渲染 */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-transparent lg:rounded-3xl lg:border lg:border-slate-200 lg:dark:border-white/5 lg:bg-white/60 lg:dark:bg-slate-900/60 lg:shadow-xl lg:dark:shadow-black/30 lg:backdrop-blur lg:m-4">
                {renderMainContent()}
            </main>
        </div>

        {activeTooltip && (
            <PortalTooltip content={activeTooltip.content} rect={activeTooltip.rect} linkUrl={activeTooltip.link} onMouseEnter={() => { if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); }} onClose={() => setActiveTooltip(null)} />
        )}
    </div>
  );
}