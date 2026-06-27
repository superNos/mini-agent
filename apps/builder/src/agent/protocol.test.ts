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

  it("parses json wrapped in markdown fences", () => {
    expect(
      parseModelAction('```json\n{"type":"final","answer":"done"}\n```'),
    ).toEqual({
      type: "final",
      answer: "done",
    });
  });

  it("recovers malformed final json when the answer is natural language", () => {
    expect(
      parseModelAction(`{
  "type": "final",
  "answer": "## 苏州 2 天 1 晚旅行计划

- 第一天：逛博物馆。
- 第二天：轻松返程。"
}`),
    ).toEqual({
      type: "final",
      answer: "## 苏州 2 天 1 晚旅行计划\n\n- 第一天：逛博物馆。\n- 第二天：轻松返程。",
    });
  });

  it("accepts plain markdown as a final answer", () => {
    expect(parseModelAction("## 旅行计划\n\n- 上午出发\n- 下午游览")).toEqual({
      type: "final",
      answer: "## 旅行计划\n\n- 上午出发\n- 下午游览",
    });
  });

  it("rejects invalid JSON", () => {
    expect(() => parseModelAction("not json")).toThrow("Invalid JSON");
  });

  it("still rejects malformed tool actions", () => {
    expect(() =>
      parseModelAction('{"type":"tool","toolName":"calculator","toolInput":'),
    ).toThrow("Invalid JSON");
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
    expect(prompt).toContain("escape line breaks as \\n");
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
