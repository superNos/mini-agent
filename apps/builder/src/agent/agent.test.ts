import { z } from "zod";
import { describe, expect, it } from "vitest";
import type { AgentMessage, ModelProvider } from "./model";
import type { Tool } from "./tool";
import { runAgent } from "./agent";

function fakeModel(outputs: string[]): ModelProvider & { calls: AgentMessage[][] } {
  let index = 0;
  const calls: AgentMessage[][] = [];

  return {
    calls,
    async complete(messages) {
      calls.push(messages.map((message) => ({ ...message })));
      const output = outputs[index];
      index += 1;
      if (!output) throw new Error("No fake output configured");
      return output;
    },
  };
}

const echoTool: Tool<z.ZodObject<{ text: z.ZodString }>, { echoed: string }> = {
  name: "echo",
  description: "Echo text",
  schema: z.object({ text: z.string() }),
  async run(input) {
    return { echoed: input.text };
  },
};

const circularToolSchema = z.object({});

const circularTool: Tool<typeof circularToolSchema, unknown> = {
  name: "circular",
  description: "Return a circular object",
  schema: circularToolSchema,
  async run() {
    const output: { self?: unknown } = {};
    output.self = output;
    return output;
  },
};

describe("runAgent", () => {
  it("stops when the model returns final", async () => {
    const result = await runAgent({
      model: fakeModel([JSON.stringify({ type: "final", answer: "done" })]),
      tools: [],
      systemPrompt: "Return JSON.",
      userInput: "hello",
      maxSteps: 3,
    });

    expect(result.answer).toBe("done");
    expect(result.trace).toEqual([
      expect.objectContaining({
        step: 1,
        type: "model",
        phase: "started",
        modelInput: expect.arrayContaining([
          expect.objectContaining({ role: "system", content: expect.stringContaining("Return JSON.") }),
          expect.objectContaining({ role: "user", content: "hello" }),
        ]),
      }),
      expect.objectContaining({ step: 1, type: "model", phase: "completed" }),
      expect.objectContaining({
        step: 1,
        type: "action",
        phase: "parsed",
        action: { type: "final", answer: "done" },
      }),
      expect.objectContaining({ step: 1, type: "final", phase: "completed", finalAnswer: "done" }),
    ]);
  });

  it("runs a tool and records trace", async () => {
    const model = fakeModel([
      JSON.stringify({ type: "tool", toolName: "echo", toolInput: { text: "abc" } }),
      JSON.stringify({ type: "final", answer: "abc" }),
    ]);

    const result = await runAgent({
      model,
      tools: [echoTool],
      systemPrompt: "Return JSON.",
      userInput: "echo abc",
      maxSteps: 3,
    });

    expect(result.answer).toBe("abc");
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "model",
          phase: "completed",
          step: 2,
          modelInput: expect.arrayContaining([
            expect.objectContaining({
              role: "assistant",
              content: JSON.stringify({
                type: "tool",
                toolName: "echo",
                toolInput: { text: "abc" },
              }),
            }),
            expect.objectContaining({
              role: "user",
              content: expect.stringContaining('Observation from tool "echo": {"echoed":"abc"}'),
            }),
          ]),
        }),
        expect.objectContaining({
          type: "action",
          phase: "parsed",
          action: { type: "tool", toolName: "echo", toolInput: { text: "abc" } },
        }),
        expect.objectContaining({
          type: "tool",
          phase: "started",
          toolName: "echo",
          toolInput: { text: "abc" },
        }),
        expect.objectContaining({
          type: "tool",
          phase: "completed",
          toolName: "echo",
          toolOutput: { echoed: "abc" },
        }),
        expect.objectContaining({
          type: "observation",
          phase: "appended",
          toolName: "echo",
          observation: expect.stringContaining('Observation from tool "echo": {"echoed":"abc"}'),
        }),
        expect.objectContaining({ type: "final", finalAnswer: "abc" }),
      ]),
    );

    expect(model.calls).toHaveLength(2);
    const secondCall = model.calls[1];
    expect(secondCall.some((message) => (message.role as string) === "tool")).toBe(false);
    expect(secondCall).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: "assistant",
          content: JSON.stringify({
            type: "tool",
            toolName: "echo",
            toolInput: { text: "abc" },
          }),
        }),
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining('Observation from tool "echo": {"echoed":"abc"}'),
        }),
      ]),
    );
    expect(secondCall.at(-1)?.content).toContain(
      "Continue by returning JSON using the Agent protocol.",
    );
  });

  it("returns error trace for invalid JSON", async () => {
    const result = await runAgent({
      model: fakeModel(["not json"]),
      tools: [],
      systemPrompt: "Return JSON.",
      userInput: "hello",
      maxSteps: 3,
    });

    expect(result.answer).toBe("");
    expect(result.trace.at(-1)).toEqual(expect.objectContaining({ type: "error", phase: "failed" }));
  });

  it("returns error trace for unknown tools", async () => {
    const result = await runAgent({
      model: fakeModel([JSON.stringify({ type: "tool", toolName: "missing", toolInput: {} })]),
      tools: [echoTool],
      systemPrompt: "Return JSON.",
      userInput: "use missing",
      maxSteps: 3,
    });

    expect(result.trace.at(-1)).toEqual(
      expect.objectContaining({
        type: "error",
        phase: "failed",
        error: "Unknown tool: missing",
        action: { type: "tool", toolName: "missing", toolInput: {} },
      }),
    );
  });

  it("returns error trace when tool output cannot be serialized", async () => {
    const result = await runAgent({
      model: fakeModel([
        JSON.stringify({ type: "tool", toolName: "circular", toolInput: {} }),
      ]),
      tools: [circularTool],
      systemPrompt: "Return JSON.",
      userInput: "use circular",
      maxSteps: 3,
    });

    expect(result.answer).toBe("");
    expect(result.trace.at(-1)).toEqual(
      expect.objectContaining({
        type: "error",
        phase: "failed",
        toolName: "circular",
        error: expect.stringContaining("output could not be serialized"),
      }),
    );
  });
});
