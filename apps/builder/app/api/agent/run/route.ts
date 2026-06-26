import { NextResponse } from "next/server";
import { runAgent } from "@/agent/agent";
import { OpenAICompatibleModelProvider } from "@/agent/model";
import { getToolsByIds } from "@/registry/tools";
import { builderRunRequestSchema } from "@/schemas/agent-config";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = builderRunRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "请求参数无效", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const model = new OpenAICompatibleModelProvider({
    baseUrl: parsed.data.baseUrl,
    apiKey: parsed.data.apiKey,
    model: parsed.data.model,
  });

  const result = await runAgent({
    model,
    tools: getToolsByIds(parsed.data.selectedTools),
    systemPrompt: parsed.data.systemPrompt,
    userInput: parsed.data.userInput,
    maxSteps: 6,
  });

  return NextResponse.json(result);
}
