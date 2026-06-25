import type { AgentMessage, ModelProvider } from "./model";
import type { AnyTool } from "./tool";
import type { TraceStep } from "./trace";

export type RunAgentInput = {
  model: ModelProvider;
  tools: AnyTool[];
  systemPrompt: string;
  userInput: string;
  maxSteps?: number;
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
      trace.push({ step, type: "error", error: errorMessage(error) });
      return { answer: "", trace };
    }

    trace.push({ step, type: "model", modelOutput });

    let action: ModelAction;
    try {
      action = parseModelAction(modelOutput);
    } catch (error) {
      trace.push({ step, type: "error", error: errorMessage(error), modelOutput });
      return { answer: "", trace };
    }

    if (action.type === "final") {
      trace.push({ step, type: "final", finalAnswer: action.answer });
      return { answer: action.answer, trace };
    }

    const tool = input.tools.find((candidate) => candidate.name === action.toolName);
    if (!tool) {
      trace.push({
        step,
        type: "error",
        error: `Unknown tool: ${action.toolName}`,
        modelOutput,
        toolName: action.toolName,
        toolInput: action.toolInput,
      });
      return { answer: "", trace };
    }

    const validation = tool.schema.safeParse(action.toolInput);
    if (!validation.success) {
      trace.push({
        step,
        type: "error",
        error: `Invalid input for tool ${tool.name}: ${validation.error.message}`,
        modelOutput,
        toolName: tool.name,
        toolInput: action.toolInput,
      });
      return { answer: "", trace };
    }

    let toolOutput: unknown;
    try {
      toolOutput = await tool.run(validation.data);
    } catch (error) {
      trace.push({
        step,
        type: "error",
        error: `Tool ${tool.name} failed: ${errorMessage(error)}`,
        modelOutput,
        toolName: tool.name,
        toolInput: validation.data,
      });
      return { answer: "", trace };
    }

    const serializedOutput = safeJsonStringify(toolOutput);
    if (!serializedOutput.ok) {
      trace.push({
        step,
        type: "error",
        error: `Tool ${tool.name} output could not be serialized: ${serializedOutput.error}`,
        modelOutput,
        toolName: tool.name,
        toolInput: validation.data,
      });
      return { answer: "", trace };
    }

    trace.push({
      step,
      type: "tool",
      toolName: tool.name,
      toolInput: validation.data,
      toolOutput,
    });
    messages.push({ role: "assistant", content: modelOutput });
    messages.push({
      role: "user",
      content: buildObservationContent(tool.name, serializedOutput.value),
    });
  }

  trace.push({
    step: maxSteps,
    type: "error",
    error: `Max steps reached: ${maxSteps}`,
  });
  return { answer: "", trace };
}
