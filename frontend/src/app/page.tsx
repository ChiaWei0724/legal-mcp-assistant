'use client';

import { useState, type KeyboardEventHandler, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { useTheme } from "next-themes";
import {
  Activity,
  BookOpenCheck,
  Bot,
  MessageSquare,
  Network,
  SendHorizontal,
  Users,
  Sun,
  Moon
} from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ViewState = "chat" | "team" | "info";
type FontSize = "small" | "medium" | "large";

const quickTopics = [
  { label: "租屋糾紛", tone: "from-orange-500 to-rose-500" },
  { label: "交通事故", tone: "from-amber-400 to-red-500" },
  { label: "借貸糾紛", tone: "from-emerald-400 to-teal-500" },
  { label: "網路誹謗", tone: "from-indigo-400 to-purple-600" },
];

const systemLogs = [
  "RAG 向量檢索引擎已啟動",
  "MCP Server 建立連線成功",
  "最新判決資料庫完成同步",
];

const knowledgeStates = [
  { label: "知識圖譜識別", value: "待命", icon: Network },
  { label: "系統狀態", value: "穩定", icon: Activity },
];

// 👥 團隊成員資料 (根據提案書內容)
const teamMembers = [
  {
    name: "龍禹丞",
    role: "隊長 / 雲端架構",
    desc: "資訊網路背景，掌握網路原理及架設，負責部署此專案到雲端主機以提供演示。",
    color: "from-blue-500 to-cyan-500"
  },
  {
    name: "陳嘉維",
    role: "AI 提示工程師",
    desc: "具備提示工程與語言模型調校經驗，負責優化大語言模型提示詞，提升輸出內容的準確率與語意一致性。",
    color: "from-indigo-500 to-purple-600"
  },
  {
    name: "胡允豪",
    role: "後端開發 & MCP",
    desc: "精通 Python 程式與 API 整合，負責串接對話介面與模型端服務（MCP），打造友善互動體驗。",
    color: "from-emerald-500 to-teal-600"
  },
  {
    name: "彭冠綸",
    role: "領域專家 / 法規整合",
    desc: "熟悉交通與民事司法流程，負責整合法規資料庫、驗證法律相關疑問。",
    color: "from-orange-500 to-red-500"
  },
  {
    name: "呂育昇",
    role: "技術支援 / 爬蟲開發",
    desc: "自學爬蟲背景，精通多種程式語言，負責提供技術支援與資料蒐集。",
    color: "from-pink-500 to-rose-600"
  }
];

export default function Home() {
  const [currentView, setCurrentView] = useState<ViewState>("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>("medium"); 
  
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fontSizeConfig = {
    small: "text-sm",
    medium: "text-base",
    large: "text-xl leading-relaxed"
  };

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    if (currentView !== "chat") setCurrentView("chat");

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiUrl}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: { reply: string } = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ 後端連線失敗，請確認伺服器是否運行中。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const renderMainContent = () => {
    switch (currentView) {
      case "team":
        return (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-3">
                <Users className="text-indigo-500 dark:text-indigo-400" /> 團隊成員
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-8">我們是來自 NextWave 2025 的黑客松團隊 - 「張三」。</p>
              
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {teamMembers.map((member) => (
                  <div key={member.name} className="p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 hover:border-indigo-500/50 transition hover:shadow-lg hover:-translate-y-1">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${member.color} mb-4 flex items-center justify-center text-xl font-bold text-white shadow-md`}>
                      {member.name[0]}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">{member.name}</h3>
                    <p className="text-sm font-medium text-indigo-600 dark:text-indigo-300 mb-3">{member.role}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{member.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case "info":
        return (
          <div className="flex flex-col gap-6 animate-in fade-in duration-500">
            <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/50 p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-3">
                <BookOpenCheck className="text-emerald-500 dark:text-emerald-400" /> 作品說明
              </h2>
              <div className="space-y-6 text-slate-700 dark:text-slate-300 leading-relaxed">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">關於「今日張三又犯法了嗎？」</h3>
                  <p>本系統結合生成式 AI 與法律資料庫，打造一個可用對話方式進行互動的智慧法律顧問。使用者可像與朋友聊天般提問，系統能以自然語言解析問題，結合法規與判例提供專業且幽默的回應。</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">核心技術架構</h3>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><span className="text-indigo-600 dark:text-indigo-300 font-medium">RAG 檢索增強生成</span>：結合 ChromaDB 向量資料庫與 BM25 關鍵字檢索，精準鎖定法條。</li>
                    <li><span className="text-indigo-600 dark:text-indigo-300 font-medium">AI 查詢改寫</span>：使用 Gemini 2.0 Flash 自動修正錯字、補全主詞（如將「拒絕九策」修正為「拒絕酒測」）。</li>
                    <li><span className="text-indigo-600 dark:text-indigo-300 font-medium">MCP 協定</span>：符合 Model Context Protocol 標準，具備未來擴充性。</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case "chat":
      default:
        return (
          <section className="flex flex-1 flex-col justify-between gap-6 animate-in fade-in duration-500">
            <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                你的案件描述
              </h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                請用自然語句描述事件、涉及人員與時間地點，我會即時生成分析。
              </p>

              <div className="mt-4 max-h-[500px] min-h-[300px] space-y-4 overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-950/40 p-4">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-slate-400 dark:text-slate-500 opacity-60">
                    <Bot className="h-12 w-12 mb-2" />
                    <p>還沒有對話紀錄，試著問問看「闖紅燈罰多少？」</p>
                  </div>
                ) : (
                  messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex w-full ${
                        msg.role === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${fontSizeConfig[fontSize]} ${
                          msg.role === "user"
                            ? "bg-indigo-600 text-white"
                            : "bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-white/5"
                        }`}
                      >
                        {msg.role === "user" ? (
                          msg.content
                        ) : (
                          <ReactMarkdown
                            components={{
                              strong: (props) => <span className="font-bold text-indigo-600 dark:text-amber-400" {...props} />,
                              ul: (props) => <ul className="ml-5 list-disc space-y-2 my-2 text-slate-700 dark:text-slate-300" {...props} />,
                              li: (props) => <li className="pl-1" {...props} />,
                              h1: (props) => <h1 className="text-xl font-bold text-slate-900 dark:text-white my-3" {...props} />,
                              h2: (props) => <h2 className="text-lg font-bold text-slate-900 dark:text-white my-2" {...props} />,
                              blockquote: (props) => <blockquote className="mt-4 border-l-4 border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-900/50 p-3 italic text-slate-600 dark:text-slate-400 rounded-r-lg" {...props} />,
                            }}
                          >
                            {msg.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-950/50 p-4 md:flex-row md:items-center shadow-sm">
                <input
                  type="text"
                  placeholder="請用白話描述你的情況..."
                  className="flex-1 border-0 bg-transparent text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button
                  type="button"
                  onClick={() => handleSend()}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 shadow-md shadow-indigo-200 dark:shadow-none"
                >
                  <SendHorizontal className="h-4 w-4" />
                  {isLoading ? "分析中..." : "送出分析"}
                </button>
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-4 py-10 text-slate-900 dark:text-slate-100 md:px-8 transition-colors duration-300">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
        
        {/* 左側 Sidebar */}
        <aside className="flex flex-col rounded-3xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-950/70 p-6 shadow-xl dark:shadow-black/40 backdrop-blur lg:w-72 transition-colors duration-300">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              NextWave 2025
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              今日張三又犯法了嗎？
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            <button
              onClick={() => setCurrentView("chat")}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-lg transition active:scale-95 ${
                currentView === "chat"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm dark:bg-indigo-600/20 dark:border-indigo-500/50 dark:text-white dark:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                  : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <Bot className={`h-5 w-5 ${currentView === "chat" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
              AI 法律諮詢
            </button>

            <button
              onClick={() => setCurrentView("team")}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-lg transition active:scale-95 ${
                currentView === "team"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm dark:bg-indigo-600/20 dark:border-indigo-500/50 dark:text-white dark:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                  : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <Users className={`h-5 w-5 ${currentView === "team" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
              團隊成員
            </button>

            <button
              onClick={() => setCurrentView("info")}
              className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left text-lg transition active:scale-95 ${
                currentView === "info"
                  ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm dark:bg-indigo-600/20 dark:border-indigo-500/50 dark:text-white dark:shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                  : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              <BookOpenCheck className={`h-5 w-5 ${currentView === "info" ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400"}`} />
              作品說明
            </button>
          </div>

          <div className="mt-auto space-y-4">
            {/* 字體大小切換 */}
            <div className="rounded-2xl bg-slate-100 dark:bg-white/5 p-2">
              <div className="flex justify-between items-center px-2 mb-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">字體大小</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setFontSize("small")}
                  className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${fontSize === 'small' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'}`}
                >
                  A
                </button>
                <button
                  onClick={() => setFontSize("medium")}
                  className={`flex-1 rounded-xl py-2 text-sm font-bold transition ${fontSize === 'medium' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'}`}
                >
                  A+
                </button>
                <button
                  onClick={() => setFontSize("large")}
                  className={`flex-1 rounded-xl py-2 text-lg font-bold transition ${fontSize === 'large' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10'}`}
                >
                  A++
                </button>
              </div>
            </div>

            {/* 主題切換 */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-100 dark:bg-white/5 p-2">
               {mounted && (
                 <>
                  <button 
                    onClick={() => setTheme("light")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition ${theme === 'light' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  >
                    <Sun className="h-4 w-4" /> 亮色
                  </button>
                  <button 
                    onClick={() => setTheme("dark")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition ${theme === 'dark' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                  >
                    <Moon className="h-4 w-4" /> 深色
                  </button>
                 </>
               )}
            </div>

            <div className="rounded-2xl border border-indigo-100 dark:border-white/5 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-indigo-600 dark:via-indigo-500 dark:to-purple-600 p-4 shadow-sm dark:shadow-lg">
              <p className="text-sm text-indigo-900 dark:text-white/80">RAG 資料庫狀態</p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-indigo-700 dark:text-white">連線中</p>
              <p className="text-sm text-indigo-500 dark:text-white/70">MCP Server · 待命</p>
            </div>
          </div>
        </aside>

        {/* 右側主畫面 */}
        <main className="flex flex-1 flex-col gap-6 rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-950/60 p-8 shadow-xl dark:shadow-black/30 backdrop-blur transition-colors duration-300">
          <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/80 dark:bg-slate-900/40 p-8 shadow-sm">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              法律諮詢助手
            </p>
            <h1 className="mt-4 text-3xl font-semibold text-slate-900 dark:text-slate-50">
              你好！我是你的 AI 法律助手
            </h1>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
              別擔心法律太難懂，簡單描述你的狀況，我會根據最新判決與知識圖譜幫你分析。
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {quickTopics.map((topic) => (
                <button
                  key={topic.label}
                  onClick={() => handleSend(`${topic.label}發生了什麼事？`)}
                  className={`rounded-2xl bg-gradient-to-r ${topic.tone} px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:scale-105 hover:shadow-lg active:scale-95`}
                >
                  {topic.label}
                </button>
              ))}
            </div>
          </div>

          {renderMainContent()}

          {currentView === "chat" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    系統運作日誌 (System Log)
                  </h3>
                  <MessageSquare className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-400">
                  {systemLogs.map((log) => (
                    <div
                      key={log}
                      className="rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 px-4 py-3"
                    >
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 dark:border-white/5 bg-white/60 dark:bg-slate-900/30 p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                    知識圖譜識別
                  </h3>
                  <Network className="h-4 w-4 text-slate-400" />
                </div>
                <div className="mt-6 space-y-4">
                  {knowledgeStates.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-950/40 px-4 py-3"
                    >
                      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                        <item.icon className="h-4 w-4 text-indigo-500 dark:text-indigo-300" />
                        {item.label}
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}