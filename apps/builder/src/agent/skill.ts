import type { ToolId } from "@/schemas/agent-config";

export type Skill = {
  name: string;
  description: string;
  systemPromptAddon: string;
  toolNames?: ToolId[];
};
