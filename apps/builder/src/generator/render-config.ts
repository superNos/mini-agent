import type { CreateProjectRequest } from "@/schemas/agent-config";

export function renderAgentConfig(request: CreateProjectRequest) {
  return `export const AGENT_CONFIG = ${JSON.stringify(
    {
      projectName: request.projectName,
      projectSlug: request.projectSlug,
      baseUrl: request.baseUrl,
      model: request.model,
      systemPrompt: request.systemPrompt,
      selectedToolIds: request.selectedTools,
      selectedSkillIds: request.selectedSkills,
    },
    null,
    2,
  )} as const;

export type AgentConfig = typeof AGENT_CONFIG;
`;
}
