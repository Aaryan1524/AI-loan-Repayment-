"use client";

import { useState, useRef, useEffect } from "react";
import { Send, RefreshCw, Sparkles } from "lucide-react";
import { useFinancialData } from "@/hooks/useFinancialData";
import { useAppStore } from "@/lib/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/* ─── Types ─── */
interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
}

/* ─── Suggested starter prompts ─── */
const STARTER_PROMPTS = [
  "What's the fastest way to pay off my loans?",
  "Should I use the avalanche or snowball strategy?",
  "How much interest will I save with extra payments?",
  "Which loan should I focus on first?",
  "Can my assets help reduce my debt faster?",
  "What's my debt-free date with my current plan?",
];

/* ─── Typewriter Effect Component ─── */
function TypewriterMarkdown({ content, animate }: { content: string, animate: boolean }) {
  const [displayedContent, setDisplayedContent] = useState(animate ? "" : content);

  useEffect(() => {
    if (!animate) {
      setDisplayedContent(content);
      return;
    }
    let i = 0;
    const speed = Math.max(1, Math.floor(content.length / 60)); // Adjust speed based on length
    const intervalId = setInterval(() => {
      i += speed;
      if (i > content.length) {
        clearInterval(intervalId);
        setDisplayedContent(content);
      } else {
        setDisplayedContent(content.slice(0, i));
      }
    }, 15);
    
    return () => clearInterval(intervalId);
  }, [content, animate]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]}>
      {displayedContent}
    </ReactMarkdown>
  );
}

/* ─── Typing indicator ─── */
function TypingIndicator() {
  return (
    <div className="flex gap-4 w-full mb-8 animate-fade-in max-w-3xl mx-auto px-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-transparent border border-border-light text-primary mt-0.5">
        <Sparkles size={16} />
      </div>
      <div className="flex items-center h-8">
        <div className="flex gap-1.5 items-center">
          <span className="w-2 h-2 rounded-full bg-text-muted-light/40 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-text-muted-light/40 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-text-muted-light/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

/* ─── Single message bubble ─── */
function MessageBubble({ msg, isLast }: { msg: Message, isLast?: boolean }) {
  const isUser = msg.role === "user";
  
  if (isUser) {
    return (
      <div className="flex justify-end w-full mb-8 max-w-3xl mx-auto px-4">
        <div className="max-w-[75%] px-5 py-3.5 rounded-2xl bg-[#f4f4f5] dark:bg-[#27272a] text-[#18181b] dark:text-[#ececf1] text-[15px] leading-relaxed shadow-sm">
          {msg.content}
        </div>
      </div>
    );
  }

  // AI Message
  return (
    <div className="flex gap-4 w-full mb-8 animate-fade-in max-w-3xl mx-auto px-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-transparent border border-border-light dark:border-border-dark text-primary mt-0.5">
        <Sparkles size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] leading-relaxed text-[#18181b] dark:text-[#ececf1] prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-surface-light prose-pre:border prose-pre:border-border-light prose-headings:font-display">
          <TypewriterMarkdown content={msg.content} animate={isLast ?? false} />
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ─── */
export default function AIAdvisorChat() {
  const {
    loans, assets, incomeSources,
    totalDebt, totalMonthlyEMI, monthlySurplus, payoffDate,
    totalInterestPaid, totalInterestSaved, monthsShortened,
    isLoading: dataLoading,
  } = useFinancialData();

  /* Format payoff date safely for display and API */
  const payoffDateStr = payoffDate instanceof Date
    ? payoffDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : payoffDate ?? "TBD";

  const activeScenario = useAppStore(s => s.activeScenario);
  const scenarios = useAppStore(s => s.scenarios);
  const currency = useAppStore(s => s.currency);

  const activeScene = scenarios.find(sc => sc.id === activeScenario);
  const strategy = activeScene?.strategy ?? "baseline";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const buildContext = () => ({
    loans: loans.map(l => ({ name: l.name, type: l.type, balance: l.balance, principal: l.principal, rate: l.rate, termMonths: l.termMonths, emiOverride: l.emiOverride })),
    assets: assets.map(a => ({ name: a.name, type: a.type, value: a.value, returnRate: a.returnRate, maturityDate: a.maturityDate, useToRepay: a.useToRepay })),
    incomeSources: incomeSources.map(src => ({ name: src.name, type: src.type, monthlyAmount: src.monthlyAmount })),
    totalDebt, totalMonthlyEMI, monthlySurplus,
    payoffDate: payoffDateStr,
    totalInterestPaid: totalInterestPaid ?? 0,
    totalInterestSaved: totalInterestSaved ?? 0,
    monthsShortened: monthsShortened ?? 0,
    activeStrategy: strategy,
    currency,
  });

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;
    setHasStarted(true);
    const userMsg: Message = { role: "user", content: text.trim(), id: crypto.randomUUID() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          ...buildContext(),
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "Sorry, I couldn't respond. Try again.", id: crypto.randomUUID() }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Network error — please check your connection and try again.", id: crypto.randomUUID() }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  const handleClear = () => { setMessages([]); setHasStarted(false); setInput(""); };

  if (dataLoading) return null;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Message / Welcome area */}
      <div className="flex-1 overflow-y-auto pb-6 scroll-smooth">
        {!hasStarted ? (
          /* ── Welcome ── */
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-4 max-w-3xl mx-auto animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-[#E8F0EA] dark:bg-surface-dark flex items-center justify-center text-primary mb-6 shadow-sm border border-border-light dark:border-border-dark">
              <Sparkles size={24} />
            </div>
            <h2 className="font-display text-3xl font-semibold text-text-main-light dark:text-text-main-dark mb-4">
              Hi, I&apos;m Alex.
            </h2>
            <p className="text-text-muted-light dark:text-text-muted-dark max-w-lg leading-relaxed mb-12 text-[15px]">
              I&apos;m your personal financial strategist. I have securely reviewed your loans, assets, and income. Ask me anything to build your optimal debt-free roadmap.
            </p>

            {/* Starter prompts grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              {STARTER_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-left text-sm px-5 py-4 rounded-2xl border border-border-light dark:border-border-dark bg-surface-light dark:bg-surface-dark hover:border-primary/40 hover:bg-primary/5 text-text-main-light dark:text-text-main-dark transition-all leading-relaxed shadow-sm hover:shadow"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="py-6">
            {messages.map((msg, idx) => (
              <MessageBubble 
                key={msg.id} 
                msg={msg} 
                isLast={msg.role === "assistant" && idx === messages.length - 1} 
              />
            ))}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className="pt-2 pb-6 px-4 max-w-3xl mx-auto w-full">
        <div className="relative flex items-end gap-3 bg-white dark:bg-[#18181b] border border-[#e5e7eb] dark:border-[#3f3f46] rounded-2xl px-4 py-3 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Alex about your debt strategy..."
            rows={1}
            className="flex-1 bg-transparent text-[15px] text-[#18181b] dark:text-[#ececf1] placeholder:text-[#a1a1aa] resize-none outline-none leading-relaxed max-h-32 py-0.5"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <div className="flex items-center gap-2 mb-0.5 flex-shrink-0">
            {hasStarted && (
              <button 
                onClick={handleClear} 
                className="w-8 h-8 rounded-xl flex items-center justify-center text-text-muted-light hover:bg-[#f4f4f5] dark:hover:bg-[#27272a] hover:text-text-main-light transition-colors"
                title="Start new chat"
              >
                <RefreshCw size={15} />
              </button>
            )}
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isTyping ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} className="ml-0.5" />}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-[#a1a1aa] mt-3">
          Alex can make mistakes. Please verify financial figures.
        </p>
      </div>
    </div>
  );
}
