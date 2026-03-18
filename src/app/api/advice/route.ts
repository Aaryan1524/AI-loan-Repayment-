import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { CURRENCY_SYMBOLS } from "@/lib/formatCurrency";

/* ─── Request / Response types ─── */

interface LoanSnapshot {
  name: string;
  balance: number;
  rate: number;
  termMonths: number;
}

interface AssetSnapshot {
  name: string;
  value: number;
  returnRate: number;
  maturityDate: string | null;
}

interface AdviceRequest {
  loans: LoanSnapshot[];
  assets: AssetSnapshot[];
  totalDebt: number;
  payoffDate: string; // ISO
  totalInterestSaved: number;
  suggestedLumpSums: {
    assetId: string;
    amount: number;
    interestSaved: number;
  }[];
  strategy: string;
  currency?: string;
}

export interface AdviceResponse {
  insight: string;
  suggestions: string[];
  error?: string;
}

/* ─── Route Handler ─── */

export async function POST(req: NextRequest) {
  try {
    const body: AdviceRequest = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json<AdviceResponse>(
        {
          insight:
            "AI Advisor is not configured yet. Add your ANTHROPIC_API_KEY to .env.local to enable personalised insights.",
          suggestions: [
            "Add ANTHROPIC_API_KEY to your .env.local file",
            "Restart the dev server after adding the key",
            "Come back to see AI-powered repayment advice",
          ],
        },
        { status: 200 }
      );
    }

    const anthropic = new Anthropic({ apiKey });

    // Get currency symbol
    const currencyCode = (body.currency as keyof typeof CURRENCY_SYMBOLS) ?? "USD";
    const sym = CURRENCY_SYMBOLS[currencyCode] ?? "$";

    // Build prompt with financial context
    const loansSummary = body.loans
      .map(
        (l) =>
          `- ${l.name}: ${sym}${l.balance.toLocaleString()} at ${l.rate}% APR (${l.termMonths === 0 ? "revolving" : `${l.termMonths} months remaining`})`
      )
      .join("\n");

    const assetsSummary =
      body.assets.length > 0
        ? body.assets
            .map(
              (a) =>
                `- ${a.name}: ${sym}${a.value.toLocaleString()} at ${a.returnRate}% return${a.maturityDate ? ` (matures ${a.maturityDate})` : ""}`
            )
            .join("\n")
        : "No assets on file.";

    const lumpSumContext =
      body.suggestedLumpSums.length > 0
        ? body.suggestedLumpSums
            .map(
              (ls) =>
                `- Redirecting ${sym}${ls.amount.toLocaleString()} could save ${sym}${ls.interestSaved.toLocaleString()} in interest`
            )
            .join("\n")
        : "No lump sum opportunities identified.";

    const systemPrompt = `You are ClearDebt AI Advisor, a financial advisor embedded in ClearDebt. You already have access to the user's financial profile. Your sole objective is to help the user pay off their debt as fast as possible, in the most financially efficient way given their specific situation.

WHAT YOU MUST DO:
1. Analyze the user's existing data first.
2. Recommend a concrete, personalized strategy (Avalanche, Snowball, etc.) and explain WHY.
3. Give actionable numbers.
4. Flag inefficiencies.

TONE & STYLE:
- Professional but warm — like a trusted advisor, not a chatbot
- Be direct. Users want a clear plan, not hedged non-answers
- Never be preachy or guilt them about past financial decisions

HARD LIMITS:
- Never guarantee specific outcomes or returns
- Never recommend liquidating assets without clearly explaining the tradeoff
- For tax implications or legal matters, recommend a licensed professional
- Do not repeat information the user has already provided back to them unnecessarily
- Never mention you're Claude/Anthropic.`;

    const userPrompt = `Here is the user's current financial snapshot:

**Total Debt:** ${sym}${body.totalDebt.toLocaleString()}
**Estimated Payoff Date:** ${body.payoffDate}
**Current Strategy:** ${body.strategy}
**Potential Interest Savings:** ${sym}${body.totalInterestSaved.toLocaleString()}

**Loans:**
${loansSummary}

**Assets:**
${assetsSummary}

**Lump Sum Opportunities:**
${lumpSumContext}

Based on this snapshot, provide:
1. A 2-3 sentence personalised insight about their financial situation — mention specific numbers and dates.
2. Exactly 3 actionable suggestions they can take right now, each as a single clear sentence.

Respond in this exact JSON format:
{
  "insight": "Your 2-3 sentence insight here...",
  "suggestions": ["Suggestion 1", "Suggestion 2", "Suggestion 3"]
}`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    // Extract text from response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text in Claude response");
    }

    // Parse JSON from response
    const raw = textBlock.text;
    // Extract JSON from potential markdown code fences
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Could not parse JSON from Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      insight: string;
      suggestions: string[];
    };

    return NextResponse.json<AdviceResponse>({
      insight: parsed.insight,
      suggestions: parsed.suggestions.slice(0, 3),
    });
  } catch (err) {
    console.error("AI Advice error:", err);
    return NextResponse.json<AdviceResponse>(
      {
        insight:
          "Unable to generate AI insight at the moment. Your repayment data is still being tracked accurately.",
        suggestions: ["Try refreshing the page", "Check your API key in .env.local"],
        error: String(err),
      },
      { status: 200 } // Don't break the UI — degrade gracefully
    );
  }
}
