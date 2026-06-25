import path from "node:path";
import { projectSlugSchema } from "@/schemas/agent-config";

export function getWorkspaceRoot(cwd = process.cwd()) {
  const normalized = path.normalize(cwd);
  if (path.basename(normalized) === "builder" && path.basename(path.dirname(normalized)) === "apps") {
    return path.resolve(normalized, "../..");
  }
  return normalized;
}

export function getBuilderRoot(cwd = process.cwd()) {
  const normalized = path.normalize(cwd);
  if (path.basename(normalized) === "builder") {
    return normalized;
  }
  return path.join(getWorkspaceRoot(normalized), "apps", "builder");
}

export function validateProjectOutputPath(workspaceRoot: string, projectSlug: string) {
  const parsed = projectSlugSchema.safeParse(projectSlug);
  if (!parsed.success) {
    throw new Error("Invalid project slug");
  }

  const generatedRoot = path.resolve(workspaceRoot, "generated");
  const projectPath = path.resolve(generatedRoot, parsed.data);

  if (!projectPath.startsWith(generatedRoot + path.sep)) {
    throw new Error("Invalid project path");
  }

  return { generatedRoot, projectPath };
}
