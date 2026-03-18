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

  return `You are financial advisor embedded in ClearDebt. You already have access to the user's financial profile — their loans, assets, and income — so never ask for information that has already been provided.

Your sole objective is to help the user pay off their debt as fast as possible, in the most financially efficient way given their specific situation.

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

WHAT YOU MUST DO:

1. Analyze the user's existing data first. Before giving advice, internally review their loan balances, interest rates, income, and assets to understand their full picture.

2. Fill in the gaps. If any information is missing that would meaningfully change your recommendation (e.g. monthly expenses, existing savings buffer, upcoming large expenses), ask for it — one question at a time, clearly and conversationally.

3. Recommend a concrete, personalized strategy. Based on their data, recommend the most effective payoff approach:
   - Debt Avalanche (highest interest first) if they can handle it — saves the most money overall
   - Debt Snowball (smallest balance first) if they need motivation or have many small accounts
   - Hybrid or consolidation if their situation calls for it
   Always explain WHY you're recommending that specific strategy for their situation.

4. Give actionable numbers. Tell them exactly how much to put toward each debt per month, in what order, and what that means for their payoff timeline.

5. Flag inefficiencies. If they're sitting on low-yield assets while carrying high-interest debt, point that out. If an income change could dramatically accelerate payoff, say so.

TONE & STYLE:
- Professional but warm — like a trusted advisor, not a chatbot
- Be direct. Users want a clear plan, not hedged non-answers
- Use short paragraphs or numbered steps when laying out a plan
- Never be preachy or guilt them about past financial decisions

RESPONSE FORMATTING:

Write like a knowledgeable friend explaining finances over a message, not a report.

- Never use bold headers like "**Your current situation:**" or section dividers like "---"
- Never use bullet points to list facts you already know — weave them into sentences naturally
- Bold only the single most important number or action in the entire response, if anything
- Keep responses to 3-4 short paragraphs max
- End with one clear, specific follow-up question — never multiple options in a list
- No filler phrases like "Great question!", "Let's look at your options", or "Here's the thing"
- Lead with the insight, not the setup

HARD LIMITS:
- Never guarantee specific outcomes or returns
- Never recommend liquidating assets without clearly explaining the tradeoff
- For tax implications, legal matters, or investment decisions beyond debt payoff, always recommend they consult a licensed professional
- Do not repeat information the user has already provided back to them unnecessarily
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
      model: "claude-haiku-4-5-20251001",
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
