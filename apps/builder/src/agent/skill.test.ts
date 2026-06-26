import { describe, expect, it } from "vitest";
import { parseSkillMarkdown } from "./skill";

describe("parseSkillMarkdown", () => {
  it("parses frontmatter metadata and markdown instructions", () => {
    const skill = parseSkillMarkdown(
      [
        "---",
        "id: demo-skill",
        "name: 演示技能",
        "description: 从 SKILL.md 加载的技能",
        "tools:",
        "  - calculator",
        "  - current-time",
        "---",
        "",
        "# 演示技能",
        "",
        "先判断是否需要工具，再回答。",
      ].join("\n"),
      "fallback",
    );

    expect(skill).toEqual({
      id: "demo-skill",
      name: "演示技能",
      description: "从 SKILL.md 加载的技能",
      content: "# 演示技能\n\n先判断是否需要工具，再回答。",
      toolIds: ["calculator", "current-time"],
    });
  });

  it("uses the folder name as fallback id", () => {
    const skill = parseSkillMarkdown(
      [
        "---",
        "name: 本地技能",
        "description: 未显式声明 id",
        "---",
        "",
        "# 本地技能",
      ].join("\n"),
      "local-skill",
    );

    expect(skill.id).toBe("local-skill");
  });
});
