import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateProjectRequest, SkillId, ToolId } from "@/schemas/agent-config";
import { getSkillsByIds } from "@/registry/skills";
import { getToolIdsForSkills } from "@/registry/tools";
import { createProjectRequestSchema } from "@/schemas/agent-config";
import { renderAgentConfig } from "./render-config";
import { renderSkillsIndex } from "./render-skills-index";
import { renderToolsIndex } from "./render-tools-index";
import { getBuilderRoot, getWorkspaceRoot, validateProjectOutputPath } from "./paths";

type CreateProjectInput = {
  request: CreateProjectRequest;
  workspaceRoot?: string;
  builderRoot?: string;
};

export type CreateProjectResult = {
  projectPath: string;
  relativeProjectPath: string;
  nextCommands: string[];
};

async function assertMissing(pathToCheck: string) {
  try {
    await stat(pathToCheck);
  } catch {
    return;
  }
  throw new Error("Output directory already exists");
}

function dedupeToolIds(selectedTools: ToolId[]) {
  return [...new Set(selectedTools)];
}

async function copySelectedTools(builderRoot: string, projectPath: string, selectedTools: ToolId[]) {
  const targetToolsDir = path.join(projectPath, "src", "tools");
  await mkdir(targetToolsDir, { recursive: true });

  for (const toolId of selectedTools) {
    await cp(
      path.join(builderRoot, "src", "tools", `${toolId}.ts`),
      path.join(targetToolsDir, `${toolId}.ts`),
    );
  }

  await writeFile(path.join(targetToolsDir, "index.ts"), renderToolsIndex(selectedTools));
}

async function copySelectedSkills(builderRoot: string, projectPath: string, selectedSkills: SkillId[]) {
  const targetSkillsDir = path.join(projectPath, "src", "skills");
  await mkdir(targetSkillsDir, { recursive: true });

  for (const skillId of selectedSkills) {
    await cp(
      path.join(builderRoot, "src", "skills", `${skillId}.ts`),
      path.join(targetSkillsDir, `${skillId}.ts`),
    );
  }

  await writeFile(path.join(targetSkillsDir, "index.ts"), renderSkillsIndex(selectedSkills));
}

async function copyAgentCore(builderRoot: string, projectPath: string) {
  const sourceDir = path.join(builderRoot, "src", "agent");
  const targetDir = path.join(projectPath, "src", "agent");
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir);
  for (const entry of entries) {
    if (entry.endsWith(".test.ts")) continue;
    await cp(path.join(sourceDir, entry), path.join(targetDir, entry));
  }
}

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
  const parsed = createProjectRequestSchema.parse(input.request);
  const selectedSkills = [...new Set(parsed.selectedSkills)];
  const skills = getSkillsByIds(selectedSkills);
  const selectedTools = dedupeToolIds([
    ...parsed.selectedTools,
    ...getToolIdsForSkills(skills),
  ]);
  const request = { ...parsed, selectedSkills, selectedTools };
  const workspaceRoot = input.workspaceRoot ?? getWorkspaceRoot();
  const builderRoot = input.builderRoot ?? getBuilderRoot();
  const { generatedRoot, projectPath } = validateProjectOutputPath(workspaceRoot, request.projectSlug);
  const templateRoot = path.join(builderRoot, "src", "templates", "agent-project");

  await assertMissing(projectPath);
  await mkdir(generatedRoot, { recursive: true });
  await cp(templateRoot, projectPath, { recursive: true });
  await copyAgentCore(builderRoot, projectPath);
  await copySelectedTools(builderRoot, projectPath, request.selectedTools);
  await copySelectedSkills(builderRoot, projectPath, request.selectedSkills);
  await writeFile(path.join(projectPath, "src", "agent", "config.ts"), renderAgentConfig(request));

  return {
    projectPath,
    relativeProjectPath: path.relative(workspaceRoot, projectPath),
    nextCommands: [
      `cd ${path.relative(workspaceRoot, projectPath)}`,
      "npm install",
      "npm run dev",
    ],
  };
}
