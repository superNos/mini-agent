import type { Skill } from "@/agent/skill";

export const skillRegistry: Record<string, Skill> = {};

export function getSkillsByIds(ids: string[]) {
  return ids.map((id) => skillRegistry[id]).filter((skill): skill is Skill => Boolean(skill));
}
