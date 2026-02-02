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
  X,
  Paperclip,
  FileText,
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
        // 將 URL-safe Base64 (-_ ) 轉回標準 Base64 (+/)
        const std = str.replace(/-/g, '+').replace(/_/g, '/');
        return decodeURIComponent(atob(std).split('').map(function(c) {
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
  followUpQuestions?: string[];
  image?: string;
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

  // Image upload state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageType, setImageType] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Backend health status
  const [backendStatus, setBackendStatus] = useState<"connecting" | "online" | "offline">("connecting");
  const [lawCount, setLawCount] = useState<number>(0);

  // Textarea auto-resize
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Scroll-to-bottom
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Document generation state
  const [showDocModal, setShowDocModal] = useState(false);
  const [docType, setDocType] = useState<string>("存證信函");
  const [generatedDoc, setGeneratedDoc] = useState<string>("");
  const [isGeneratingDoc, setIsGeneratingDoc] = useState(false);
  const [docCopied, setDocCopied] = useState(false);
  const [docProgress, setDocProgress] = useState(0);
  const docProgressRef = useRef<NodeJS.Timeout | null>(null);

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

  // Backend health check
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_URL}/`, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const data = await res.json();
          setBackendStatus("online");
          setLawCount(data.law_count || 0);
        } else {
          setBackendStatus("offline");
        }
      } catch {
        setBackendStatus("offline");
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  // Textarea auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 150) + 'px';
  }, [input]);

  // Scroll-to-bottom detection
  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollButton(distFromBottom > 200);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [messages]);

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
    const match = text.match(/(.+?)第([\d-]+)條(?:之(\d+))?/);
    if (match) {
        const name = match[1].trim(); flno = match[3] ? `${match[2]}-${match[3]}` : match[2];
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("圖片大小不能超過 10MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("請選擇圖片檔案（JPG、PNG 等）");
      return;
    }
    setImageType(file.type);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      const base64 = dataUrl.split(",")[1];
      setSelectedImage(base64);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleGenerateDocument = async () => {
    if (!sessionId) return;
    setIsGeneratingDoc(true); setGeneratedDoc(""); setDocProgress(0);

    // Simulated progress: accelerates to ~30%, then slows toward 90%
    if (docProgressRef.current) clearInterval(docProgressRef.current);
    docProgressRef.current = setInterval(() => {
      setDocProgress(prev => {
        if (prev >= 90) return prev;
        const increment = prev < 30 ? 3 : prev < 60 ? 1.5 : 0.5;
        return Math.min(prev + increment, 90);
      });
    }, 300);

    try {
      const res = await fetch(`${API_URL}/generate-document`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: docType, session_id: sessionId, client_id: clientId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) {
        setGeneratedDoc(`錯誤：${data.error}`);
      } else {
        setGeneratedDoc(data.document || "文書生成失敗");
      }
    } catch {
      setGeneratedDoc("連線失敗，請確認後端是否運行中。");
    } finally {
      if (docProgressRef.current) clearInterval(docProgressRef.current);
      setDocProgress(100);
      setTimeout(() => setIsGeneratingDoc(false), 400);
    }
  };

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim(); if (!trimmed || isLoading) return;

    if (isListening && recognitionRef.current) {
        recognitionRef.current.stop();
        setIsListening(false);
    }

    if (currentView !== "chat") setCurrentView("chat");
    const userMessage: ChatMessage = { role: "user", content: trimmed, image: selectedImage || undefined };
    setMessages((prev) => [...prev, userMessage]); setInput(""); setIsLoading(true);

    const bodyPayload: any = { message: trimmed, style: chatStyle, session_id: sessionId, client_id: clientId };
    if (selectedImage) {
      bodyPayload.image = selectedImage;
      bodyPayload.image_type = imageType || "image/jpeg";
    }
    setSelectedImage(null); setImagePreview(null); setImageType(null);

    try {
      const res = await fetch(`${API_URL}/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages((prev) => [...prev, {
          role: "assistant",
          content: data.reply,
          analysis: data.analysis,
          followUpQuestions: data.follow_up_questions || [],
      }]);

      if (!sessionId && data.session_id) {
        setSessionId(data.session_id);
        const autoTitle = trimmed.length > 25 ? trimmed.slice(0, 25) + '...' : trimmed;
        setSessions(prev => [{ id: data.session_id, title: autoTitle }, ...prev]);
      }
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
        const isLawLink = hrefStr.startsWith("https://law.ai/view");
        const rawText = extractTextFromNode(children); 
        
        if (isLawLink) {
            let decodedContent = "";
            let pcode = "";
            let flno = "";

            try {
                const urlObj = new URL(hrefStr);
                pcode = urlObj.searchParams.get("pcode") || "";
                flno = urlObj.searchParams.get("flno") || "";
                const b64 = urlObj.searchParams.get("data") || "";
                if (b64) decodedContent = b64DecodeUnicode(b64);
            } catch {
                 // Fallback: 嘗試解析舊格式
                 try {
                    if (hrefStr.includes("data=")) {
                        const b64 = hrefStr.split("data=")[1];
                        decodedContent = b64DecodeUnicode(b64);
                    }
                 } catch {}
            }

            if (!decodedContent) decodedContent = "無法讀取條文內容";
            
            let realLink = "";
            if (pcode && flno) {
                realLink = `https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=${pcode}&flno=${flno}`;
            } else {
                realLink = getLawLink(rawText); 
            }
            
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
    ul: (props: any) => <ul className="ml-5 list-disc space-y-1.5 my-3 text-slate-700 dark:text-slate-300" {...props} />,
    ol: (props: any) => <ol className="ml-5 list-decimal space-y-1.5 my-3 text-slate-700 dark:text-slate-300" {...props} />,
    li: (props: any) => <li className="pl-1 leading-7" {...props} />,
    h1: (props: any) => <h1 className="text-xl font-bold text-slate-900 dark:text-white mt-5 mb-2" {...props} />,
    h2: (props: any) => <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-4 mb-2 pb-1 border-b border-slate-200 dark:border-white/10" {...props} />,
    h3: (props: any) => <h3 className="text-base font-bold text-slate-900 dark:text-white mt-3 mb-1" {...props} />,
    hr: () => <hr className="my-4 border-slate-200 dark:border-white/10" />,
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

                {/* 專案簡介 */}
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-6 md:p-8 shadow-sm">
                  <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-3"><BookOpenCheck className="text-emerald-500 dark:text-emerald-400" /> 作品說明</h2>
                  <div className="space-y-4 text-slate-700 dark:text-slate-300 leading-relaxed">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">關於「我的AI溢出就像雨水」</h3>
                      <p>本系統是一個專為台灣民眾設計的 <span className="font-bold text-indigo-600 dark:text-indigo-400">AI 法律諮詢輔助系統</span>。我們觀察到許多民眾（如租屋族、車禍當事人）在面臨法律糾紛時，常因法條艱澀或資訊不對稱而感到無助。</p>
                      <p className="mt-2">本系統採用 Google Gemini 2.5 Flash 作為核心大腦，結合 RAG（檢索增強生成）技術讀取全國法規資料庫共 <span className="font-bold text-indigo-600 dark:text-indigo-400">47,000+ 條法規</span>，提供即時、有憑有據且白話的法律分析。</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
                      <div className="p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                        <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mb-1">白話轉譯</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">將複雜法條轉換為一般人聽得懂的建議</p>
                      </div>
                      <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mb-1">有憑有據</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">每條回答精準引用法規出處並提供原文連結</p>
                      </div>
                      <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20">
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-1">風險可視</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">自動分析法律領域與風險等級，一目了然</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 功能亮點 */}
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-6 md:p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-3"><Sparkles className="text-amber-500 dark:text-amber-400" /> 功能亮點</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Scale className="w-4 h-4 text-indigo-500" /> 三種對話模式</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-1">
                        <li>- <span className="font-medium">專業律師模式</span>：嚴謹用語，引用實務判決案例</li>
                        <li>- <span className="font-medium">一般民眾模式</span>：白話易懂，用生活例子解釋</li>
                        <li>- <span className="font-medium">幽默風趣模式</span>：鄉民梗與比喻帶出法律知識</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> AI 智慧判讀儀表板</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-1">
                        <li>- <span className="font-medium">領域識別</span>：自動判斷刑事、民事或行政領域</li>
                        <li>- <span className="font-medium">風險評估</span>：標示高/中/低風險等級</li>
                        <li>- <span className="font-medium">知識圖譜</span>：自動提取案件關鍵字標籤</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Gavel className="w-4 h-4 text-amber-500" /> 法規快覽 Tooltip</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-1">
                        <li>- 法條連結滑鼠移入即顯示完整條文內容</li>
                        <li>- 自動產生正確的全國法規資料庫連結</li>
                        <li>- 支援一鍵複製條文原文</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-purple-500" /> 法律文書生成</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-1">
                        <li>- 存證信函：正式通知對方法律權益主張</li>
                        <li>- 和解協議書：雙方和解的正式文書</li>
                        <li>- 行政申訴書：對行政處分提出申訴</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Mic className="w-4 h-4 text-red-500" /> 語音輸入</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-1">
                        <li>- 使用 Web Speech API 即時語音辨識</li>
                        <li>- 支援中文連續語音輸入</li>
                        <li>- 可搭配文字同時編輯</li>
                      </ul>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5">
                      <p className="text-sm font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Paperclip className="w-4 h-4 text-cyan-500" /> 圖片法律分析</p>
                      <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-1">
                        <li>- 上傳罰單、合約等法律文件圖片</li>
                        <li>- Gemini Vision 自動辨識文件內容</li>
                        <li>- AI 結合圖片與問題進行法律分析</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* 技術架構 */}
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-6 md:p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-3"><Network className="text-indigo-500 dark:text-indigo-400" /> 技術架構</h2>
                  <div className="space-y-4 text-slate-700 dark:text-slate-300">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Frontend 前端</h3>
                      <div className="flex flex-wrap gap-2">
                        {["Next.js 16", "React 19", "Tailwind CSS 4", "Lucide Icons", "ReactMarkdown", "Web Speech API"].map(t => (
                          <span key={t} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/20">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">Backend 後端</h3>
                      <div className="flex flex-wrap gap-2">
                        {["Python FastAPI", "SQLite", "ChromaDB", "BM25 (jieba)", "sentence-transformers"].map(t => (
                          <span key={t} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">AI Core</h3>
                      <div className="flex flex-wrap gap-2">
                        {["Google Gemini 2.5 Flash", "RAG 檢索增強生成", "Query Rewriting", "Chain-of-Thought", "Vision 圖片分析"].map(t => (
                          <span key={t} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-500/10 dark:text-purple-300 dark:border-purple-500/20">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">MCP Server</h3>
                      <div className="flex flex-wrap gap-2">
                        {["Model Context Protocol", "法規搜尋 Tool", "風險分析 Tool", "文書生成 Tool", "SSE / stdio 雙模式"].map(t => (
                          <span key={t} className="px-2.5 py-1 text-xs font-medium rounded-lg bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">搜尋引擎 — 雙軌混合搜尋</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">結合 <span className="font-bold text-indigo-600 dark:text-indigo-400">Vector Search</span>（語意理解）與 <span className="font-bold text-indigo-600 dark:text-indigo-400">BM25</span>（關鍵字精準匹配）的混合式搜尋架構。內建同義詞擴充字典，自動將口語（如「打人」「酒測」）對應至法律用語（如「傷害罪」「酒精濃度檢定」），大幅提升搜尋召回率。</p>
                    </div>
                  </div>
                </div>

                {/* 資料來源 */}
                <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-6 md:p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-3"><Tag className="text-rose-500 dark:text-rose-400" /> 資料來源</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">所有法規資料均透過<span className="font-bold text-indigo-600 dark:text-indigo-400">全國法規資料庫 Open API</span> 下載，涵蓋憲法、民法、刑法、行政法規等各類法律共 47,000+ 條。資料經 jieba 中文分詞後建立 BM25 索引，並使用 paraphrase-multilingual-MiniLM-L12-v2 模型產生語意向量存入 ChromaDB，實現高精度的雙軌檢索。</p>
                </div>

                {/* 免責聲明 */}
                <div className="rounded-3xl border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-6 md:p-8 shadow-sm">
                  <h2 className="text-xl font-bold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-3"><AlertTriangle className="text-amber-500" /> 免責聲明</h2>
                  <p className="text-sm text-amber-900/70 dark:text-amber-200/70 leading-relaxed">本系統所提供之法律資訊僅供參考，不構成正式法律意見。系統回答基於全國法規資料庫公開法規進行檢索與生成，實際個案判決可能因證據、法官心證及最新修法而異。若有具體法律問題，請務必諮詢專業律師。</p>
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
            <div className="flex-1 relative overflow-hidden">
              <div ref={chatScrollRef} className="h-full overflow-y-auto px-4 py-4 md:px-6 md:py-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 space-y-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center">
                    <Bot className="h-16 w-16 mb-4 text-indigo-300 dark:text-indigo-800/60" />
                    <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">有什麼法律問題嗎？</p>
                    <p className="text-sm text-slate-400 dark:text-slate-500 mb-6">選擇以下問題或自行輸入</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full px-4">
                      {["闖紅燈會被罰多少？", "車禍肇事逃逸怎麼辦？", "租屋押金可以扣嗎？", "被詐騙了要怎麼報案？"].map((q) => (
                        <button key={q} onClick={() => handleSend(q)} className="px-4 py-3 text-sm text-left rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 hover:border-indigo-300 dark:hover:border-indigo-500/40 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all active:scale-[0.98]">
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, index) => (
                        <div key={index} className="flex flex-col gap-2">
                            <div className={`flex w-full ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                                <div className={`relative w-fit min-w-0 max-w-[95%] md:max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${fontSizeConfig[fontSize]} ${msg.role === "user" ? "bg-indigo-600 text-white ml-auto" : "bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/5 mr-auto"} overflow-hidden break-words`}>
                                    {msg.role === "user" && msg.image && (
                                      <div className="mb-2">
                                        <img src={`data:image/jpeg;base64,${msg.image}`} alt="上傳圖片" className="max-w-[240px] max-h-[180px] rounded-lg object-cover border border-white/20" />
                                      </div>
                                    )}
                                    {msg.role === "user" ? <div className="whitespace-pre-wrap break-words">{msg.content}</div> : <ReactMarkdown urlTransform={(url) => url} components={markdownComponents}>{msg.content}</ReactMarkdown>}
                                </div>
                            </div>
                            {msg.role === "assistant" && msg.analysis && (
                                <div className="w-full max-w-[95%] md:max-w-[85%] mr-auto px-1">
                                    <AnalysisPanel data={msg.analysis} />
                                </div>
                            )}
                            {msg.role === "assistant" && msg.followUpQuestions && msg.followUpQuestions.length > 0 && (
                                <div className="w-full max-w-[95%] md:max-w-[85%] mr-auto px-1 flex flex-wrap gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                    {msg.followUpQuestions.map((q, qi) => (
                                        <button key={qi} onClick={() => handleSend(q)} className="px-3 py-1.5 text-sm rounded-full border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 hover:border-indigo-300 dark:hover:border-indigo-400/50 transition-all active:scale-95 cursor-pointer">
                                            {q}
                                        </button>
                                    ))}
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

              {/* Scroll to bottom button */}
              {showScrollButton && messages.length > 0 && (
                <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <button onClick={() => { chatScrollRef.current?.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' }); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95">
                    <ChevronDown className="w-4 h-4" /> 最新訊息
                  </button>
                </div>
              )}
            </div>

            {/* "生成法律文書" button */}
            {sessionId && messages.length >= 2 && (
              <div className="shrink-0 px-3 md:px-4 pt-2 flex justify-center">
                <button onClick={() => { setShowDocModal(true); setGeneratedDoc(""); setDocCopied(false); }} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all active:scale-95">
                  <FileText className="w-4 h-4" /> 生成法律文書
                </button>
              </div>
            )}

            <div className="shrink-0 p-3 md:p-4 bg-transparent">
                {/* Image preview strip */}
                {imagePreview && (
                  <div className="mb-2 flex items-center gap-2 px-2">
                    <div className="relative group">
                      <img src={imagePreview} alt="預覽" className="h-16 w-16 rounded-lg object-cover border border-slate-200 dark:border-white/10 shadow-sm" />
                      <button onClick={() => { setSelectedImage(null); setImagePreview(null); setImageType(null); }} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md hover:bg-red-600 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">已選擇圖片，可搭配文字描述一起送出</span>
                  </div>
                )}

                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageSelect} className="hidden" />

                <div className={`rounded-3xl border transition-all duration-300 relative flex flex-col bg-white dark:bg-slate-950/80 ${isListening ? 'border-red-400 shadow-[0_0_15px_rgba(248,113,113,0.3)] ring-2 ring-red-400/20' : 'border-slate-200 dark:border-white/10 shadow-lg dark:shadow-black/50 focus-within:ring-2 focus-within:ring-indigo-500/20'}`}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isListening ? "正在聆聽中..." : "請用白話描述你的情況..."}
                        className="w-full bg-transparent border-0 px-5 pt-3 pb-10 text-base text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none resize-none min-h-[52px] max-h-[150px] rounded-3xl"
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
                             <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-colors" title="上傳圖片（罰單、合約等）">
                               <Paperclip className="w-4 h-4" />
                             </button>

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

                             <button onClick={() => handleSend()} disabled={isLoading || (!input.trim() && !selectedImage)} className={`p-2 rounded-full transition-all flex items-center justify-center ${(input.trim() || selectedImage) ? 'bg-indigo-600 text-white shadow-md hover:bg-indigo-500 active:scale-95' : 'bg-slate-100 dark:bg-white/5 text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}><SendHorizontal className="h-4 w-4" /></button>
                        </div>
                    </div>
                </div>
                <div className="mt-1 flex justify-between items-center px-4"><p className="text-[9px] text-slate-400 dark:text-slate-500">Enter 送出 · Shift+Enter 換行</p><p className="text-[9px] text-slate-400 dark:text-slate-500">Gemini 可能會顯示不準確的資訊</p></div>
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
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">AI台灣法律顧問</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-50 whitespace-nowrap">我的AI溢出就像雨水</h2>
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
                    <p className="text-xs text-indigo-900 dark:text-white/80">RAG 資料庫狀態</p>
                    <div className="mt-1 flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            {backendStatus === "online" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${backendStatus === "online" ? "bg-emerald-500" : backendStatus === "offline" ? "bg-red-500" : "bg-amber-400 animate-pulse"}`}></span>
                        </span>
                        <p className={`text-lg font-semibold tracking-tight ${backendStatus === "online" ? "text-indigo-700 dark:text-white" : backendStatus === "offline" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-300 animate-pulse"}`}>
                            {backendStatus === "online" ? "已連線" : backendStatus === "offline" ? "離線" : "連線中"}
                        </p>
                    </div>
                    {backendStatus === "online" && lawCount > 0 && (
                        <p className="mt-1 text-[10px] text-indigo-600/70 dark:text-white/50">{lawCount.toLocaleString()} 條法規已載入</p>
                    )}
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
                <h1 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">我的AI溢出就像雨水 <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${backendStatus === "online" ? "bg-emerald-500" : backendStatus === "offline" ? "bg-red-500" : "bg-amber-400 animate-pulse"}`}></span></h1>
                <ThemeToggle />
            </div>

            {/* 電腦版右上角 Toggle */}
            <div className="hidden lg:flex justify-end px-8 pt-4 shrink-0">
                <ThemeToggle />
            </div>

            {/* 內容渲染 */}
            <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-transparent lg:rounded-3xl lg:border lg:border-slate-200 lg:dark:border-white/5 lg:bg-white/60 lg:dark:bg-slate-900/60 lg:shadow-xl lg:dark:shadow-black/30 lg:backdrop-blur lg:mx-4 lg:mb-4 lg:mt-2">
                {renderMainContent()}
            </main>
        </div>

        {activeTooltip && (
            <PortalTooltip content={activeTooltip.content} rect={activeTooltip.rect} linkUrl={activeTooltip.link} onMouseEnter={() => { if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current); }} onClose={() => setActiveTooltip(null)} />
        )}

        {/* Document Generation Modal */}
        {showDocModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setShowDocModal(false)}>
            <div className="w-full max-w-2xl mx-4 max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
              {/* Modal header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
                <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-500" /> 生成法律文書
                </h2>
                <button onClick={() => setShowDocModal(false)} className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Document type selector */}
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">選擇文書類型</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { type: "存證信函", desc: "正式通知對方法律權益主張", icon: "📄" },
                      { type: "和解協議書", desc: "雙方和解的正式文書", icon: "🤝" },
                      { type: "行政申訴書", desc: "對行政處分提出申訴", icon: "📋" },
                    ].map((item) => (
                      <button key={item.type} onClick={() => setDocType(item.type)} className={`p-4 rounded-xl border-2 text-left transition-all ${docType === item.type ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10" : "border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/30 hover:bg-slate-50 dark:hover:bg-white/5"}`}>
                        <div className="text-2xl mb-2">{item.icon}</div>
                        <div className={`text-sm font-bold ${docType === item.type ? "text-indigo-700 dark:text-indigo-300" : "text-slate-700 dark:text-slate-200"}`}>{item.type}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <button onClick={handleGenerateDocument} disabled={isGeneratingDoc} className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]">
                  {isGeneratingDoc ? (
                    <><Hourglass className="w-4 h-4 animate-spin" /> AI 正在撰寫文書中...</>
                  ) : (
                    <><FileText className="w-4 h-4" /> 生成{docType}</>
                  )}
                </button>

                {/* Progress bar */}
                {isGeneratingDoc && (
                  <div className="space-y-2 animate-in fade-in duration-200">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {docProgress < 30 ? "正在分析對話紀錄..." : docProgress < 60 ? "正在撰寫法律文書..." : docProgress < 90 ? "正在校對法條引用..." : "即將完成..."}
                      </span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{Math.round(docProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out" style={{ width: `${docProgress}%` }} />
                    </div>
                  </div>
                )}

                {/* Generated document display */}
                {generatedDoc && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">生成結果</p>
                      <button onClick={async () => {
                        try { await navigator.clipboard.writeText(generatedDoc); setDocCopied(true); setTimeout(() => setDocCopied(false), 2000); } catch {}
                      }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 transition-colors">
                        {docCopied ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> 已複製</> : <><Copy className="w-3.5 h-3.5" /> 複製全文</>}
                      </button>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/10 max-h-[40vh] overflow-y-auto">
                      <div className="whitespace-pre-wrap text-sm leading-7 text-slate-800 dark:text-slate-200 font-sans">
                        {generatedDoc}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}