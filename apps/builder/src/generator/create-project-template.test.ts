import { execFile } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createProject } from "./create-project";
import { getWorkspaceRoot } from "./paths";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const tscPath = require.resolve("typescript/bin/tsc");

async function expectPathExists(pathToCheck: string) {
  await expect(stat(pathToCheck)).resolves.toBeTruthy();
}

describe("createProject with real template", () => {
  it(
    "generates a self-contained project that typechecks without secrets",
    async () => {
      const repoRoot = getWorkspaceRoot();
      const tempRootParent = path.join(repoRoot, "generated");
      await mkdir(tempRootParent, { recursive: true });
      const workspaceRoot = await mkdtemp(path.join(tempRootParent, "create-project-template-"));

      try {
        const result = await createProject({
          workspaceRoot,
          request: {
            projectName: "Real Template Agent",
            projectSlug: "real-template-agent",
            baseUrl: "https://api.example.com/v1",
            model: "test-model",
            systemPrompt: "Return JSON.",
            selectedTools: ["calculator", "current-time"],
            selectedSkills: [],
          },
        });

        await expectPathExists(path.join(result.projectPath, "package.json"));
        await expectPathExists(path.join(result.projectPath, "tsconfig.json"));
        await expectPathExists(path.join(result.projectPath, "app", "page.tsx"));
        await expectPathExists(path.join(result.projectPath, "app", "api", "agent", "run", "route.ts"));
        await expectPathExists(path.join(result.projectPath, "src", "agent", "agent.ts"));
        await expectPathExists(path.join(result.projectPath, "src", "agent", "config.ts"));
        await expectPathExists(path.join(result.projectPath, "src", "tools", "calculator.ts"));
        await expectPathExists(path.join(result.projectPath, "src", "tools", "current-time.ts"));
        await expectPathExists(path.join(result.projectPath, "src", "tools", "index.ts"));
        await expectPathExists(path.join(result.projectPath, "src", "skills"));

        const envExample = await readFile(path.join(result.projectPath, ".env.example"), "utf8");
        expect(envExample.trimEnd()).toBe("OPENAI_API_KEY=");

        const config = await readFile(path.join(result.projectPath, "src", "agent", "config.ts"), "utf8");
        expect(config).toContain("Real Template Agent");
        expect(config).not.toContain("apiKey");

        const toolsIndex = await readFile(path.join(result.projectPath, "src", "tools", "index.ts"), "utf8");
        expect(toolsIndex).toContain('import { calculatorTool } from "./calculator";');
        expect(toolsIndex).toContain('import { currentTimeTool } from "./current-time";');

        const page = await readFile(path.join(result.projectPath, "app", "page.tsx"), "utf8");
        expect(page).toContain('aria-label="Agent input"');

        const runRoute = await readFile(
          path.join(result.projectPath, "app", "api", "agent", "run", "route.ts"),
          "utf8",
        );
        expect(runRoute).toContain("Input must be a non-empty string");

        await execFileAsync(
          process.execPath,
          [tscPath, "--noEmit", "--project", path.join(result.projectPath, "tsconfig.json")],
          {
            cwd: result.projectPath,
            timeout: 30_000,
          },
        );
      } finally {
        await rm(workspaceRoot, { recursive: true, force: true });
      }
    },
    30_000,
  );
});
