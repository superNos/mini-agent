import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./create-project";
import { validateProjectOutputPath } from "./paths";

describe("validateProjectOutputPath", () => {
  it("rejects path traversal", () => {
    expect(() => validateProjectOutputPath("/repo", "../bad")).toThrow("Invalid project slug");
  });
});

describe("createProject", () => {
  it("creates a project and omits api keys", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mini-agent-builder-"));
    const builderRoot = path.join(workspaceRoot, "apps", "builder");
    const templateRoot = path.join(builderRoot, "src", "templates", "agent-project");

    await mkdir(path.join(templateRoot, "app"), { recursive: true });
    await writeFile(path.join(templateRoot, "package.json"), "{\"name\":\"template\"}");
    await writeFile(path.join(templateRoot, "app", "page.tsx"), "export default function Page(){return null}");
    await mkdir(path.join(builderRoot, "src", "agent"), { recursive: true });
    await mkdir(path.join(builderRoot, "src", "tools"), { recursive: true });
    await writeFile(path.join(builderRoot, "src", "agent", "agent.ts"), "export const agent = true;");
    await writeFile(path.join(builderRoot, "src", "tools", "calculator.ts"), "export const calculatorTool = {};");

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
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
