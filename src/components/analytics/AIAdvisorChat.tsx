"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, RefreshCw } from "lucide-react";
import { useFinancialData } from "@/hooks/useFinancialData";
import { useAppStore } from "@/lib/store";
import { CURRENCY_SYMBOLS } from "@/lib/formatCurrency";

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

/* ─── Typing indicator ─── */
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot size={16} className="text-primary" />
      </div>
      <div className="bg-white border border-border-light rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
        <div className="flex gap-1.5 items-center h-5">
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

/* ─── Single message bubble ─── */
function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
        isUser ? "bg-primary text-white" : "bg-primary/10 text-primary"
      }`}>
        {isUser ? <User size={15} /> : <Bot size={15} />}
      </div>
      <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? "bg-primary text-white rounded-br-none shadow-sm"
          : "bg-white border border-border-light text-text-main-light rounded-bl-none shadow-sm"
      }`}>
        {msg.content}
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
  const sym = CURRENCY_SYMBOLS[currency] ?? "$";

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
    <div className="flex flex-col h-full">
      {/* Message / Welcome area */}
      <div className="flex-1 overflow-y-auto pb-6">
        {!hasStarted ? (
          /* ── Welcome ── */
          <div className="flex flex-col items-center text-center pt-8 pb-10 px-4">
            <h2 className="font-display text-2xl font-semibold text-text-main-light mb-3">
              Your personal debt strategist
            </h2>
            <p className="text-text-muted-light max-w-md leading-relaxed mb-10">
              I have complete knowledge of your loans, assets, and income. Ask me anything — from optimal repayment strategy to specific payoff scenarios.
            </p>

            {/* Starter prompts grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
              {STARTER_PROMPTS.map(p => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="text-left text-sm px-4 py-3.5 rounded-2xl border border-border-light bg-white hover:border-primary/40 hover:bg-primary/5 text-text-main-light transition-all leading-snug shadow-sm hover:shadow"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Subtle context note */}
            <p className="text-xs text-text-muted-light/60 mt-8">
              {loans.length} loan{loans.length !== 1 ? "s" : ""} · {sym}{totalDebt.toLocaleString()} total debt · payoff {payoffDateStr} · {assets.length} asset{assets.length !== 1 ? "s" : ""}
            </p>
          </div>
        ) : (
          /* ── Messages ── */
          <div className="space-y-4 py-4">
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {isTyping && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ── Input bar ── */}
      <div className="pt-2 pb-1">
        <div className="flex items-end gap-3 bg-white border border-border-light rounded-3xl px-5 py-3.5 shadow-sm focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10 transition-all">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your debt strategy…"
            rows={1}
            className="flex-1 bg-transparent text-sm text-text-main-light placeholder:text-text-muted-light resize-none outline-none leading-relaxed max-h-32"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          {hasStarted && (
            <button onClick={handleClear} className="text-text-muted-light hover:text-text-main-light transition-colors text-xs flex-shrink-0 mb-0.5">
              <RefreshCw size={14} />
            </button>
          )}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            className="w-8 h-8 rounded-2xl bg-primary text-white flex items-center justify-center flex-shrink-0 hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {isTyping ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-text-muted-light/50 mt-2">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
