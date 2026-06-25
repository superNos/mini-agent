import type { Skill } from "@/agent/skill";

export const skillRegistry: Record<string, Skill> = {};

export function getSkillsByIds(ids: string[]): Skill[] {
  if (ids.length > 0) {
    throw new Error("No skills are installed yet");
  }

  return [];
}
