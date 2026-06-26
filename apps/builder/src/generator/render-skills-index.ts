import type { SkillId } from "@/schemas/agent-config";

const exportNames: Record<SkillId, string> = {
  "arithmetic-check": "arithmeticCheckSkill",
  "time-awareness": "timeAwarenessSkill",
  "travel-planner": "travelPlannerSkill",
};

export function renderSkillsIndex(selectedSkills: SkillId[]) {
  const imports = selectedSkills
    .map((skillId) => `import { ${exportNames[skillId]} } from "./${skillId}";`)
    .join("\n");
  const entries = selectedSkills
    .map((skillId) => `  "${skillId}": ${exportNames[skillId]},`)
    .join("\n");

  return `${imports}
import type { Skill } from "../agent/skill";

const skills: Record<string, Skill> = {
${entries}
};

export function getSelectedSkills(ids: readonly string[]) {
  return ids.map((id) => skills[id]).filter((skill): skill is Skill => Boolean(skill));
}
`;
}
