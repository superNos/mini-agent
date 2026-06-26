import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./create-project";
import { validateProjectOutputPath } from "./paths";

function countOccurrences(value: string, search: string) {
  return value.split(search).length - 1;
}

async function createBuilderFixture() {
  const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mini-agent-builder-"));
  const builderRoot = path.join(workspaceRoot, "apps", "builder");
  const templateRoot = path.join(builderRoot, "src", "templates", "agent-project");

  await mkdir(path.join(templateRoot, "app"), { recursive: true });
  await writeFile(path.join(templateRoot, "package.json"), "{\"name\":\"template\"}");
  await writeFile(path.join(templateRoot, "app", "page.tsx"), "export default function Page(){return null}");
  await mkdir(path.join(builderRoot, "src", "agent"), { recursive: true });
  await mkdir(path.join(builderRoot, "src", "tools"), { recursive: true });
  await writeFile(path.join(builderRoot, "src", "agent", "agent.ts"), "export const agent = true;");
  await writeFile(path.join(builderRoot, "src", "agent", "agent.test.ts"), "test(\"agent\", () => {});");
  await writeFile(path.join(builderRoot, "src", "tools", "calculator.ts"), "export const calculatorTool = {};");
  await writeFile(path.join(builderRoot, "src", "tools", "current-time.ts"), "export const currentTimeTool = {};");
  await writeFile(
    path.join(builderRoot, "src", "tools", "weather-forecast.ts"),
    "export const weatherForecastTool = {};",
  );
  await writeFile(path.join(builderRoot, "src", "tools", "budget-check.ts"), "export const budgetCheckTool = {};");
  await writeFile(
    path.join(builderRoot, "src", "tools", "itinerary-planner.ts"),
    "export const itineraryPlannerTool = {};",
  );
  await mkdir(path.join(builderRoot, "src", "skills"), { recursive: true });
  await mkdir(path.join(builderRoot, "src", "skills", "arithmetic-check"), { recursive: true });
  await writeFile(
    path.join(builderRoot, "src", "skills", "arithmetic-check", "SKILL.md"),
    [
      "---",
      "id: arithmetic-check",
      "name: 算术校验",
      "description: 遇到算术表达式时使用计算器工具验证结果",
      "tools:",
      "  - calculator",
      "---",
      "",
      "# 算术校验",
      "",
      "调用 calculator 工具验证结果。",
    ].join("\n"),
  );
  await mkdir(path.join(builderRoot, "src", "skills", "time-awareness"), { recursive: true });
  await writeFile(
    path.join(builderRoot, "src", "skills", "time-awareness", "SKILL.md"),
    [
      "---",
      "id: time-awareness",
      "name: 时间感知",
      "description: 需要当前日期或运行时间时先读取时间工具",
      "tools:",
      "  - current-time",
      "---",
      "",
      "# 时间感知",
      "",
      "调用 current-time 工具确认时间。",
    ].join("\n"),
  );
  await mkdir(path.join(builderRoot, "src", "skills", "travel-planner"), { recursive: true });
  await writeFile(
    path.join(builderRoot, "src", "skills", "travel-planner", "SKILL.md"),
    [
      "---",
      "id: travel-planner",
      "name: 旅行计划",
      "description: 把旅行需求拆成天气查询、预算评估和行程安排",
      "tools:",
      "  - weather-forecast",
      "  - budget-check",
      "  - itinerary-planner",
      "---",
      "",
      "# 旅行计划",
      "",
      "先查天气，再评估预算，最后生成行程。",
    ].join("\n"),
  );

  return {
    workspaceRoot,
    builderRoot,
    cleanup: () => rm(workspaceRoot, { recursive: true, force: true }),
  };
}

describe("validateProjectOutputPath", () => {
  it("rejects path traversal", () => {
    expect(() => validateProjectOutputPath("/repo", "../bad")).toThrow("Invalid project slug");
  });
});

describe("createProject", () => {
  it("creates a project and omits api keys", async () => {
    const { workspaceRoot, builderRoot, cleanup } = await createBuilderFixture();

    try {
      const result = await createProject({
        workspaceRoot,
        builderRoot,
        request: {
          projectName: "My Agent",
          projectSlug: "my-agent",
          baseUrl: "https://api.example.com/v1",
          model: "test-model",
          systemPrompt: "Return JSON.",
          selectedTools: ["calculator"],
          selectedSkills: [],
        },
      });

      await expect(stat(path.join(result.projectPath, "package.json"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "agent", "agent.ts"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "tools", "calculator.ts"))).resolves.toBeTruthy();
      const config = await readFile(path.join(result.projectPath, "src", "agent", "config.ts"), "utf8");
      expect(config).toContain("My Agent");
      expect(config).not.toContain("apiKey");
    } finally {
      await cleanup();
    }
  });

  it("dedupes selected tools in generated tools index and config", async () => {
    const { workspaceRoot, builderRoot, cleanup } = await createBuilderFixture();

    try {
      const result = await createProject({
        workspaceRoot,
        builderRoot,
        request: {
          projectName: "My Agent",
          projectSlug: "my-agent",
          baseUrl: "https://api.example.com/v1",
          model: "test-model",
          systemPrompt: "Return JSON.",
          selectedTools: ["calculator", "calculator", "current-time", "calculator"],
          selectedSkills: [],
        },
      });

      const toolsIndex = await readFile(path.join(result.projectPath, "src", "tools", "index.ts"), "utf8");
      expect(countOccurrences(toolsIndex, 'import { calculatorTool } from "./calculator";')).toBe(1);
      expect(countOccurrences(toolsIndex, 'import { currentTimeTool } from "./current-time";')).toBe(1);
      expect(countOccurrences(toolsIndex, '"calculator": calculatorTool,')).toBe(1);
      expect(countOccurrences(toolsIndex, '"current-time": currentTimeTool,')).toBe(1);

      const config = await readFile(path.join(result.projectPath, "src", "agent", "config.ts"), "utf8");
      expect(config).toContain('"selectedToolIds": [\n    "calculator",\n    "current-time"\n  ]');
    } finally {
      await cleanup();
    }
  });

  it("rejects an existing output directory", async () => {
    const { workspaceRoot, builderRoot, cleanup } = await createBuilderFixture();

    try {
      await mkdir(path.join(workspaceRoot, "generated", "my-agent"), { recursive: true });

      await expect(
        createProject({
          workspaceRoot,
          builderRoot,
          request: {
            projectName: "My Agent",
            projectSlug: "my-agent",
            baseUrl: "https://api.example.com/v1",
            model: "test-model",
            systemPrompt: "Return JSON.",
            selectedTools: ["calculator"],
            selectedSkills: [],
          },
        }),
      ).rejects.toThrow("Output directory already exists");
    } finally {
      await cleanup();
    }
  });

  it("excludes agent core test files", async () => {
    const { workspaceRoot, builderRoot, cleanup } = await createBuilderFixture();

    try {
      const result = await createProject({
        workspaceRoot,
        builderRoot,
        request: {
          projectName: "My Agent",
          projectSlug: "my-agent",
          baseUrl: "https://api.example.com/v1",
          model: "test-model",
          systemPrompt: "Return JSON.",
          selectedTools: [],
          selectedSkills: [],
        },
      });

      await expect(stat(path.join(result.projectPath, "src", "agent", "agent.ts"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "agent", "agent.test.ts"))).rejects.toThrow();
    } finally {
      await cleanup();
    }
  });

  it("renders a valid tools index with no selected tools", async () => {
    const { workspaceRoot, builderRoot, cleanup } = await createBuilderFixture();

    try {
      const result = await createProject({
        workspaceRoot,
        builderRoot,
        request: {
          projectName: "My Agent",
          projectSlug: "my-agent",
          baseUrl: "https://api.example.com/v1",
          model: "test-model",
          systemPrompt: "Return JSON.",
          selectedTools: [],
          selectedSkills: [],
        },
      });

      const toolsIndex = await readFile(path.join(result.projectPath, "src", "tools", "index.ts"), "utf8");
      expect(toolsIndex).not.toContain("import {");
      expect(toolsIndex).toContain("const tools: Record<string, AnyTool> = {");
      expect(toolsIndex).toContain("export function getSelectedTools(ids: readonly string[])");
    } finally {
      await cleanup();
    }
  });

  it("copies selected skills and includes their dependent tools", async () => {
    const { workspaceRoot, builderRoot, cleanup } = await createBuilderFixture();

    try {
      const result = await createProject({
        workspaceRoot,
        builderRoot,
        request: {
          projectName: "My Agent",
          projectSlug: "my-agent",
          baseUrl: "https://api.example.com/v1",
          model: "test-model",
          systemPrompt: "Return JSON.",
          selectedTools: [],
          selectedSkills: ["arithmetic-check"],
        },
      });

      await expect(stat(path.join(result.projectPath, "src", "skills", "arithmetic-check", "SKILL.md"))).resolves.toBeTruthy();
      const skillsIndex = await readFile(path.join(result.projectPath, "src", "skills", "index.ts"), "utf8");
      expect(skillsIndex).toContain('"arithmetic-check": {');
      expect(skillsIndex).toContain('"content":');

      await expect(stat(path.join(result.projectPath, "src", "tools", "calculator.ts"))).resolves.toBeTruthy();
      const config = await readFile(path.join(result.projectPath, "src", "agent", "config.ts"), "utf8");
      expect(config).toContain('"selectedSkillIds": [\n    "arithmetic-check"\n  ]');
      expect(config).toContain('"selectedToolIds": [\n    "calculator"\n  ]');
    } finally {
      await cleanup();
    }
  });

  it("includes travel planner dependent tools", async () => {
    const { workspaceRoot, builderRoot, cleanup } = await createBuilderFixture();

    try {
      const result = await createProject({
        workspaceRoot,
        builderRoot,
        request: {
          projectName: "Travel Agent",
          projectSlug: "travel-agent",
          baseUrl: "https://api.example.com/v1",
          model: "test-model",
          systemPrompt: "Return JSON.",
          selectedTools: [],
          selectedSkills: ["travel-planner"],
        },
      });

      await expect(stat(path.join(result.projectPath, "src", "skills", "travel-planner", "SKILL.md"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "tools", "weather-forecast.ts"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "tools", "budget-check.ts"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "tools", "itinerary-planner.ts"))).resolves.toBeTruthy();

      const toolsIndex = await readFile(path.join(result.projectPath, "src", "tools", "index.ts"), "utf8");
      expect(toolsIndex).toContain('import { weatherForecastTool } from "./weather-forecast";');
      expect(toolsIndex).toContain('import { budgetCheckTool } from "./budget-check";');
      expect(toolsIndex).toContain('import { itineraryPlannerTool } from "./itinerary-planner";');

      const skillsIndex = await readFile(path.join(result.projectPath, "src", "skills", "index.ts"), "utf8");
      expect(skillsIndex).toContain('"travel-planner": {');
      expect(skillsIndex).toContain('"content":');

      const config = await readFile(path.join(result.projectPath, "src", "agent", "config.ts"), "utf8");
      expect(config).toContain('"selectedSkillIds": [\n    "travel-planner"\n  ]');
      expect(config).toContain('"weather-forecast"');
      expect(config).toContain('"budget-check"');
      expect(config).toContain('"itinerary-planner"');
    } finally {
      await cleanup();
    }
  });
});
