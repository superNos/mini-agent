import { z } from "zod";
import { describe, expect, it } from "vitest";
import { buildAgentSystemPrompt, parseModelAction } from "./protocol";

describe("agent protocol", () => {
  it("parses tool actions", () => {
    expect(
      parseModelAction(
        JSON.stringify({
          type: "tool",
          toolName: "calculator",
          toolInput: { expression: "1 + 2" },
        }),
      ),
    ).toEqual({
      type: "tool",
      toolName: "calculator",
      toolInput: { expression: "1 + 2" },
    });
  });

  it("parses final actions", () => {
    expect(parseModelAction(JSON.stringify({ type: "final", answer: "done" }))).toEqual({
      type: "final",
      answer: "done",
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseModelAction("not json")).toThrow("Invalid JSON");
  });

  it("builds the protocol prompt with available tools", () => {
    const prompt = buildAgentSystemPrompt("Base prompt", [
      {
        name: "demo",
        description: "Demo tool",
        schema: z.object({}),
        async run() {
          return {};
        },
      },
    ]);

    expect(prompt).toContain("Base prompt");
    expect(prompt).toContain('To use a tool, return {"type":"tool"');
    expect(prompt).toContain("- demo: Demo tool.");
  });

  it("builds the protocol prompt with selected skills", () => {
    const prompt = buildAgentSystemPrompt("Base prompt", [], [
      {
        id: "demo",
        name: "演示技能",
        description: "演示 Skill 如何追加提示词",
        content: "优先解释动作选择。",
        toolIds: [],
      },
    ]);

    expect(prompt).toContain("Selected skills:");
    expect(prompt).toContain("演示技能");
    expect(prompt).toContain("优先解释动作选择。");
  });
});
