import type { AgentMessage, ModelProvider } from "./model";
import { buildAgentSystemPrompt, parseModelAction } from "./protocol";
import type { Skill } from "./skill";
import type { AnyTool } from "./tool";
import type { TraceStep } from "./trace";

export type RunAgentInput = {
  model: ModelProvider;
  tools: AnyTool[];
  systemPrompt: string;
  userInput: string;
  skills?: Skill[];
  maxSteps?: number;
  onTraceStep?: (step: TraceStep) => void | Promise<void>;
};

export type RunAgentResult = {
  answer: string;
  trace: TraceStep[];
};

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

type SafeJsonStringifyResult =
  | {
      ok: true;
      value: string;
    }
  | {
      ok: false;
      error: string;
    };

function safeJsonStringify(value: unknown): SafeJsonStringifyResult {
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string") {
      return { ok: false, error: "JSON.stringify returned no JSON content" };
    }
    return { ok: true, value: serialized };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

function buildObservationContent(toolName: string, serializedOutput: string) {
  return [
    `Observation from tool "${toolName}": ${serializedOutput}`,
    "Continue by returning JSON using the Agent protocol.",
  ].join("\n");
}

function cloneMessages(messages: AgentMessage[]) {
  return messages.map((message) => ({ ...message }));
}

function nowIso() {
  return new Date().toISOString();
}

async function appendTrace(
  trace: TraceStep[],
  step: TraceStep,
  onTraceStep?: RunAgentInput["onTraceStep"],
) {
  trace.push(step);
  await onTraceStep?.(step);
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const maxSteps = input.maxSteps ?? 8;
  const trace: TraceStep[] = [];
  const skills = input.skills ?? [];
  const messages: AgentMessage[] = [
    {
      role: "system",
      content: buildAgentSystemPrompt(input.systemPrompt, input.tools, skills),
    },
    { role: "user", content: input.userInput },
  ];

  if (skills.length > 0) {
    await appendTrace(
      trace,
      { step: 0, type: "skill", phase: "loaded", loadedAt: nowIso(), skills },
      input.onTraceStep,
    );
  }

  for (let step = 1; step <= maxSteps; step += 1) {
    let modelOutput: string;
    const modelInput = cloneMessages(messages);
    const modelStartedAt = nowIso();
    const modelStartedMs = Date.now();

    await appendTrace(
      trace,
      { step, type: "model", phase: "started", startedAt: modelStartedAt, modelInput },
      input.onTraceStep,
    );

    try {
      modelOutput = await input.model.complete(modelInput);
    } catch (error) {
      await appendTrace(
        trace,
        { step, type: "error", phase: "failed", error: errorMessage(error), modelInput },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    await appendTrace(
      trace,
      {
        step,
        type: "model",
        phase: "completed",
        startedAt: modelStartedAt,
        completedAt: nowIso(),
        durationMs: Date.now() - modelStartedMs,
        modelInput,
        modelOutput,
      },
      input.onTraceStep,
    );

    let action: ReturnType<typeof parseModelAction>;
    try {
      action = parseModelAction(modelOutput);
    } catch (error) {
      await appendTrace(
        trace,
        {
          step,
          type: "error",
          phase: "failed",
          error: errorMessage(error),
          modelInput,
          modelOutput,
        },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    await appendTrace(
      trace,
      { step, type: "action", phase: "parsed", action, modelOutput },
      input.onTraceStep,
    );

    if (action.type === "final") {
      await appendTrace(
        trace,
        { step, type: "final", phase: "completed", finalAnswer: action.answer },
        input.onTraceStep,
      );
      return { answer: action.answer, trace };
    }

    const tool = input.tools.find((candidate) => candidate.name === action.toolName);
    if (!tool) {
      await appendTrace(
        trace,
        {
          step,
          type: "error",
          phase: "failed",
          error: `Unknown tool: ${action.toolName}`,
          modelInput,
          modelOutput,
          action,
          toolName: action.toolName,
          toolInput: action.toolInput,
        },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    const validation = tool.schema.safeParse(action.toolInput);
    if (!validation.success) {
      await appendTrace(
        trace,
        {
          step,
          type: "error",
          phase: "failed",
          error: `Invalid input for tool ${tool.name}: ${validation.error.message}`,
          modelInput,
          modelOutput,
          action,
          toolName: tool.name,
          toolInput: action.toolInput,
        },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    let toolOutput: unknown;
    const toolStartedAt = nowIso();
    const toolStartedMs = Date.now();

    await appendTrace(
      trace,
      {
        step,
        type: "tool",
        phase: "started",
        toolName: tool.name,
        toolInput: validation.data,
        startedAt: toolStartedAt,
      },
      input.onTraceStep,
    );

    try {
      toolOutput = await tool.run(validation.data);
    } catch (error) {
      await appendTrace(
        trace,
        {
          step,
          type: "error",
          phase: "failed",
          error: `Tool ${tool.name} failed: ${errorMessage(error)}`,
          modelInput,
          modelOutput,
          action,
          toolName: tool.name,
          toolInput: validation.data,
        },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    const serializedOutput = safeJsonStringify(toolOutput);
    if (!serializedOutput.ok) {
      await appendTrace(
        trace,
        {
          step,
          type: "error",
          phase: "failed",
          error: `Tool ${tool.name} output could not be serialized: ${serializedOutput.error}`,
          modelInput,
          modelOutput,
          action,
          toolName: tool.name,
          toolInput: validation.data,
        },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    await appendTrace(
      trace,
      {
        step,
        type: "tool",
        phase: "completed",
        toolName: tool.name,
        toolInput: validation.data,
        toolOutput,
        startedAt: toolStartedAt,
        completedAt: nowIso(),
        durationMs: Date.now() - toolStartedMs,
      },
      input.onTraceStep,
    );
    messages.push({ role: "assistant", content: modelOutput });
    messages.push({
      role: "user",
      content: buildObservationContent(tool.name, serializedOutput.value),
    });
    await appendTrace(
      trace,
      {
        step,
        type: "observation",
        phase: "appended",
        toolName: tool.name,
        observation: messages.at(-1)?.content ?? "",
        messages: cloneMessages(messages),
      },
      input.onTraceStep,
    );
  }

  await appendTrace(
    trace,
    {
      step: maxSteps,
      type: "error",
      phase: "failed",
      error: `Max steps reached: ${maxSteps}`,
    },
    input.onTraceStep,
  );
  return { answer: "", trace };
}
