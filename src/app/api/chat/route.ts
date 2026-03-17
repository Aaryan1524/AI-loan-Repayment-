import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CURRENCY_SYMBOLS } from "@/lib/formatCurrency";

/* ─── Types ─── */

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface LoanSnapshot {
  name: string;
  type: string;
  balance: number;
  principal: number;
  rate: number;
  termMonths: number;
  emiOverride?: number;
}

interface AssetSnapshot {
  name: string;
  type: string;
  value: number;
  returnRate: number;
  maturityDate: string | null;
  useToRepay: boolean;
}

interface IncomeSnapshot {
  name: string;
  type: string;
  monthlyAmount: number;
}

interface ChatRequest {
  messages: Message[];          // Full conversation history
  loans: LoanSnapshot[];
  assets: AssetSnapshot[];
  incomeSources: IncomeSnapshot[];
  totalDebt: number;
  totalMonthlyEMI: number;
  monthlySurplus: number;
  payoffDate: string;
  totalInterestPaid: number;
  totalInterestSaved: number;
  monthsShortened: number;
  activeStrategy: string;
  currency?: string;
}

/* ─── System prompt builder ─── */
function buildSystemPrompt(ctx: ChatRequest, sym: string): string {
  const loansList = ctx.loans.length > 0
    ? ctx.loans.map(l =>
      `  • ${l.name} (${l.type}): ${sym}${l.balance.toLocaleString()} remaining of ${sym}${l.principal.toLocaleString()} at ${l.rate}% APR, ${l.termMonths === 0 ? "revolving" : `${l.termMonths} months`}`
    ).join("\n")
    : "  • No loans on file yet.";

  const assetsList = ctx.assets.length > 0
    ? ctx.assets.map(a =>
      `  • ${a.name} (${a.type}): ${sym}${a.value.toLocaleString()} at ${a.returnRate}% return${a.maturityDate ? `, matures ${a.maturityDate}` : ""}${a.useToRepay ? " [flagged for repayment]" : ""}`
    ).join("\n")
    : "  • No assets on file yet.";

  const incomeList = ctx.incomeSources.length > 0
    ? ctx.incomeSources.map(src =>
      `  • ${src.name} (${src.type}): ${sym}${src.monthlyAmount.toLocaleString()}/mo`
    ).join("\n")
    : "  • No income sources on file yet.";

  return `You are ClearDebt AI Advisor — a warm, expert personal finance coach embedded inside ClearDebt, a loan repayment planning dashboard. Your user has given you full access to their financial picture and you should use it deeply to give personalised, specific, actionable guidance.

=== USER'S CURRENT FINANCIAL SNAPSHOT ===

DEBT SUMMARY
  Total Debt: ${sym}${ctx.totalDebt.toLocaleString()}
  Total Monthly EMI: ${sym}${ctx.totalMonthlyEMI.toLocaleString()}/mo
  Monthly Surplus (after EMIs): ${sym}${Math.max(0, ctx.monthlySurplus).toLocaleString()}/mo
  Estimated Payoff Date: ${ctx.payoffDate}
  Total Interest Remaining: ${sym}${ctx.totalInterestPaid.toLocaleString()}
  Interest You Could Save: ${sym}${ctx.totalInterestSaved.toLocaleString()}
  Months Shortened with Optimisation: ${ctx.monthsShortened}
  Active Strategy: ${ctx.activeStrategy}

LOANS
${loansList}

ASSETS
${assetsList}

INCOME SOURCES
${incomeList}
=== END SNAPSHOT ===

GUIDELINES:
- Reference specific numbers from their snapshot — never give generic advice.
- You REMEMBER this entire conversation. Bring up earlier points when relevant.
- Be encouraging but honest. If they're in trouble, acknowledge it gently and pivot to solutions.
- Keep messages concise for chat — 2–4 short paragraphs max, or bullet points.
- Surface concrete next steps: "pay an extra ${sym}200 this month on your mortgage" beats "pay more."
- When comparing strategies (avalanche vs snowball), use their actual loan names.
- Ask follow-up questions to learn about their goals, risk tolerance, and timeline.
- Never mention you're Claude/Anthropic. You are the ClearDebt AI Advisor.`;
}

/* ─── Route Handler ─── */
export async function POST(req: NextRequest) {
  try {
    const body: ChatRequest = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { reply: "AI Advisor is not configured. Add your ANTHROPIC_API_KEY to .env.local to chat with your advisor." },
        { status: 200 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    const currencyCode = (body.currency as keyof typeof CURRENCY_SYMBOLS) ?? "USD";
    const sym = CURRENCY_SYMBOLS[currencyCode] ?? "$";

    const systemPrompt = buildSystemPrompt(body, sym);

    // Convert our message history to Anthropic format
    const messages: Anthropic.MessageParam[] = body.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 600,
      system: systemPrompt,
      messages,
    });

    const textBlock = response.content.find(b => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in Claude response");
    }

    return NextResponse.json({ reply: textBlock.text });
  } catch (err) {
    console.error("AI Chat error:", err);
    return NextResponse.json(
      { reply: "I couldn't respond right now — please try again in a moment.", error: String(err) },
      { status: 200 }
    );
  }
}
