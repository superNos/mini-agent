import type { AgentMessage, ModelProvider } from "./model";
import type { AnyTool } from "./tool";
import type { TraceStep } from "./trace";

export type RunAgentInput = {
  model: ModelProvider;
  tools: AnyTool[];
  systemPrompt: string;
  userInput: string;
  maxSteps?: number;
  onTraceStep?: (step: TraceStep) => void | Promise<void>;
};

export type RunAgentResult = {
  answer: string;
  trace: TraceStep[];
};

type ModelAction =
  | {
      type: "final";
      answer: string;
    }
  | {
      type: "tool";
      toolName: string;
      toolInput: unknown;
    };

function buildSystemPrompt(systemPrompt: string, tools: AnyTool[]) {
  const toolList =
    tools.length === 0
      ? "No tools are available."
      : tools
          .map(
            (tool) =>
              `- ${tool.name}: ${tool.description}. Tool input example: ${toolInputExample(
                tool.name,
              )}`,
          )
          .join("\n");

  return [
    systemPrompt,
    "",
    "Return only valid JSON. Do not include markdown fences, commentary, or extra text.",
    'To use a tool, return {"type":"tool","toolName":"tool-name","toolInput":{}}.',
    'To finish, return {"type":"final","answer":"your answer"}.',
    "",
    "Available tools:",
    toolList,
  ].join("\n");
}

function toolInputExample(toolName: string) {
  if (toolName === "calculator") return '{"expression":"1 + 2"}';
  if (toolName === "current-time") return "{}";
  return "Use a JSON object matching this tool's input schema.";
}

function parseModelAction(modelOutput: string): ModelAction {
  let parsed: unknown;

  try {
    parsed = JSON.parse(modelOutput);
  } catch (error) {
    throw new Error(`Invalid JSON: ${errorMessage(error)}`);
  }

  if (!isObject(parsed) || typeof parsed.type !== "string") {
    throw new Error("Model output must be an object with a type field");
  }

  if (parsed.type === "final") {
    if (typeof parsed.answer !== "string") {
      throw new Error("Final output must include a string answer");
    }
    return { type: "final", answer: parsed.answer };
  }

  if (parsed.type === "tool") {
    if (typeof parsed.toolName !== "string") {
      throw new Error("Tool output must include a string toolName");
    }
    if (!("toolInput" in parsed)) {
      throw new Error("Tool output must include toolInput");
    }
    return {
      type: "tool",
      toolName: parsed.toolName,
      toolInput: parsed.toolInput,
    };
  }

  throw new Error(`Unsupported model output type: ${parsed.type}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
  const messages: AgentMessage[] = [
    { role: "system", content: buildSystemPrompt(input.systemPrompt, input.tools) },
    { role: "user", content: input.userInput },
  ];

  for (let step = 1; step <= maxSteps; step += 1) {
    let modelOutput: string;

    try {
      modelOutput = await input.model.complete(messages);
    } catch (error) {
      await appendTrace(trace, { step, type: "error", error: errorMessage(error) }, input.onTraceStep);
      return { answer: "", trace };
    }

    await appendTrace(trace, { step, type: "model", modelOutput }, input.onTraceStep);

    let action: ModelAction;
    try {
      action = parseModelAction(modelOutput);
    } catch (error) {
      await appendTrace(
        trace,
        { step, type: "error", error: errorMessage(error), modelOutput },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    if (action.type === "final") {
      await appendTrace(trace, { step, type: "final", finalAnswer: action.answer }, input.onTraceStep);
      return { answer: action.answer, trace };
    }

    const tool = input.tools.find((candidate) => candidate.name === action.toolName);
    if (!tool) {
      await appendTrace(
        trace,
        {
          step,
          type: "error",
          error: `Unknown tool: ${action.toolName}`,
          modelOutput,
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
          error: `Invalid input for tool ${tool.name}: ${validation.error.message}`,
          modelOutput,
          toolName: tool.name,
          toolInput: action.toolInput,
        },
        input.onTraceStep,
      );
      return { answer: "", trace };
    }

    let toolOutput: unknown;
    try {
      toolOutput = await tool.run(validation.data);
    } catch (error) {
      await appendTrace(
        trace,
        {
          step,
          type: "error",
          error: `Tool ${tool.name} failed: ${errorMessage(error)}`,
          modelOutput,
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
          error: `Tool ${tool.name} output could not be serialized: ${serializedOutput.error}`,
          modelOutput,
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
        toolName: tool.name,
        toolInput: validation.data,
        toolOutput,
      },
      input.onTraceStep,
    );
    messages.push({ role: "assistant", content: modelOutput });
    messages.push({
      role: "user",
      content: buildObservationContent(tool.name, serializedOutput.value),
    });
  }

  await appendTrace(
    trace,
    {
      step: maxSteps,
      type: "error",
      error: `Max steps reached: ${maxSteps}`,
    },
    input.onTraceStep,
  );
  return { answer: "", trace };
}
