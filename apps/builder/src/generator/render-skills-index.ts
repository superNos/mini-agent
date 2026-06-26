import type { Skill } from "@/agent/skill";

export function renderSkillsIndex(selectedSkills: Skill[]) {
  const entries = selectedSkills
    .map((skill) => `  ${JSON.stringify(skill.id)}: ${JSON.stringify(skill, null, 2)},`)
    .join("\n");

  return `import type { Skill } from "../agent/skill";

const skills: Record<string, Skill> = {
${entries}
};

export function getSelectedSkills(ids: readonly string[]) {
  return ids.map((id) => skills[id]).filter((skill): skill is Skill => Boolean(skill));
}
`;
}
