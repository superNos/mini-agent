import type { Skill } from "@/agent/skill";
import type { SkillId } from "@/schemas/agent-config";
import { arithmeticCheckSkill } from "@/skills/arithmetic-check";
import { timeAwarenessSkill } from "@/skills/time-awareness";

export type SkillMetadata = {
  id: SkillId;
  name: string;
  description: string;
  systemPromptAddon: string;
  toolIds: string[];
};

export const skillRegistry: Record<SkillId, Skill> = {
  "arithmetic-check": arithmeticCheckSkill,
  "time-awareness": timeAwarenessSkill,
};

export const skillMetadata: SkillMetadata[] = Object.values(skillRegistry).map((skill) => ({
  id: skill.id as SkillId,
  name: skill.name,
  description: skill.description,
  systemPromptAddon: skill.systemPromptAddon,
  toolIds: skill.toolIds ?? [],
}));

export function getSkillsByIds(ids: SkillId[]): Skill[] {
  return ids.map((id) => skillRegistry[id]);
}
