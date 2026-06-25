import { NextResponse } from "next/server";
import { runAgent } from "@/agent/agent";
import { OpenAICompatibleModelProvider } from "@/agent/model";
import { AGENT_CONFIG } from "@/agent/config";
import { getSelectedTools } from "@/tools";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { input?: unknown } | null;
  if (typeof body?.input !== "string" || body.input.trim().length === 0) {
    return NextResponse.json({ error: "Input must be a non-empty string" }, { status: 400 });
  }
  const input = body.input.trim();

  const result = await runAgent({
    model: new OpenAICompatibleModelProvider({
      baseUrl: AGENT_CONFIG.baseUrl,
      apiKey,
      model: AGENT_CONFIG.model,
    }),
    tools: getSelectedTools(AGENT_CONFIG.selectedToolIds),
    systemPrompt: AGENT_CONFIG.systemPrompt,
    userInput: input,
    maxSteps: 6,
  });

  return NextResponse.json(result);
}
