import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Skill } from "@/agent/skill";
import { parseSkillMarkdown } from "@/agent/skill";
import type { SkillId } from "@/schemas/agent-config";

export type SkillMetadata = {
  id: SkillId;
  name: string;
  description: string;
  content: string;
  toolIds: string[];
};

export function getDefaultSkillsRoot() {
  return path.join(process.cwd(), "src", "skills");
}

export function loadSkillsFromDirectory(skillsRoot = getDefaultSkillsRoot()): Skill[] {
  if (!existsSync(skillsRoot)) return [];

  return readdirSync(skillsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const skillPath = path.join(skillsRoot, entry.name, "SKILL.md");
      if (!existsSync(skillPath) || !statSync(skillPath).isFile()) return null;
      return parseSkillMarkdown(readFileSync(skillPath, "utf8"), entry.name);
    })
    .filter((skill): skill is Skill => Boolean(skill));
}

function createSkillRegistry(skills: Skill[]) {
  return Object.fromEntries(skills.map((skill) => [skill.id, skill])) as Record<SkillId, Skill>;
}

const loadedSkills = loadSkillsFromDirectory();

export const skillRegistry: Record<SkillId, Skill> = createSkillRegistry(loadedSkills);

export const skillMetadata: SkillMetadata[] = loadedSkills.map((skill) => ({
  id: skill.id as SkillId,
  name: skill.name,
  description: skill.description,
  content: skill.content,
  toolIds: skill.toolIds ?? [],
}));

export function getSkillsByIds(ids: SkillId[]): Skill[] {
  return ids.map((id) => skillRegistry[id]).filter((skill): skill is Skill => Boolean(skill));
}
