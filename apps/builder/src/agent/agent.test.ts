import { z } from "zod";
import { describe, expect, it } from "vitest";
import type { ModelProvider } from "./model";
import type { Tool } from "./tool";
import { runAgent } from "./agent";

function fakeModel(outputs: string[]): ModelProvider {
  let index = 0;
  return {
    async complete() {
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
      expect.objectContaining({ step: 1, type: "model" }),
      expect.objectContaining({ step: 1, type: "final", finalAnswer: "done" }),
    ]);
  });

  it("runs a tool and records trace", async () => {
    const result = await runAgent({
      model: fakeModel([
        JSON.stringify({ type: "tool", toolName: "echo", toolInput: { text: "abc" } }),
        JSON.stringify({ type: "final", answer: "abc" }),
      ]),
      tools: [echoTool],
      systemPrompt: "Return JSON.",
      userInput: "echo abc",
      maxSteps: 3,
    });

    expect(result.answer).toBe("abc");
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool", toolName: "echo", toolOutput: { echoed: "abc" } }),
        expect.objectContaining({ type: "final", finalAnswer: "abc" }),
      ]),
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
    expect(result.trace.at(-1)).toEqual(expect.objectContaining({ type: "error" }));
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
      expect.objectContaining({ type: "error", error: "Unknown tool: missing" }),
    );
  });
});
