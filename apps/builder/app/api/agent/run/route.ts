import { NextResponse } from "next/server";
import { runAgent } from "@/agent/agent";
import { OpenAICompatibleModelProvider } from "@/agent/model";
import { getSkillsByIds } from "@/registry/skills";
import { getToolIdsForSkills, getToolsByIds } from "@/registry/tools";
import { builderRunRequestSchema } from "@/schemas/agent-config";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

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
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: unknown) {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      }

      try {
        const skills = getSkillsByIds(parsed.data.selectedSkills);
        const result = await runAgent({
          model,
          tools: getToolsByIds([
            ...parsed.data.selectedTools,
            ...getToolIdsForSkills(skills),
          ]),
          skills,
          systemPrompt: parsed.data.systemPrompt,
          userInput: parsed.data.userInput,
          maxSteps: 8,
          onTraceStep: (step) => send({ type: "trace", step }),
        });
        send({ type: "final", answer: result.answer, trace: result.trace });
      } catch (error) {
        send({ type: "error", error: errorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}
