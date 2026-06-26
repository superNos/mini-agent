import { z } from "zod";
import type { Skill } from "./skill";
import type { AnyTool } from "./tool";

export const toolActionSchema = z.object({
  type: z.literal("tool"),
  toolName: z.string().min(1),
  toolInput: z.unknown(),
});

export const finalActionSchema = z.object({
  type: z.literal("final"),
  answer: z.string(),
});

export const modelActionSchema = z.discriminatedUnion("type", [
  toolActionSchema,
  finalActionSchema,
]);

export type ModelAction = z.infer<typeof modelActionSchema>;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function toolInputExample(toolName: string) {
  if (toolName === "calculator") return '{"expression":"1 + 2"}';
  if (toolName === "current-time") return "{}";
  return "Use a JSON object matching this tool's input schema.";
}

function buildSkillsSection(skills: Skill[]) {
  if (skills.length === 0) return "";

  return [
    "Selected skills:",
    ...skills.map((skill) =>
      [`- ${skill.name}: ${skill.description}`, `  Guidance: ${skill.systemPromptAddon}`].join(
        "\n",
      ),
    ),
    "",
  ].join("\n");
}

export function buildAgentSystemPrompt(systemPrompt: string, tools: AnyTool[], skills: Skill[] = []) {
  const toolList =
    tools.length === 0
      ? "No tools are available."
      : tools
          .map(
            (tool) =>
              `- ${tool.name}: ${tool.description}. Tool input example: ${toolInputExample(
                tool.name,
              )}`,
          )
          .join("\n");

  return [
    systemPrompt,
    "",
    buildSkillsSection(skills),
    "Return only valid JSON. Do not include markdown fences, commentary, or extra text.",
    'To use a tool, return {"type":"tool","toolName":"tool-name","toolInput":{}}.',
    'To finish, return {"type":"final","answer":"your answer"}.',
    "",
    "Available tools:",
    toolList,
  ].join("\n");
}

export function parseModelAction(modelOutput: string): ModelAction {
  let parsed: unknown;

  try {
    parsed = JSON.parse(modelOutput);
  } catch (error) {
    throw new Error(`Invalid JSON: ${errorMessage(error)}`);
  }

  const result = modelActionSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid agent action: ${result.error.message}`);
  }

  return result.data;
}
