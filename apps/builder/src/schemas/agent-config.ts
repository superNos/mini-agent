import { z } from "zod";

export const toolIdSchema = z.enum([
  "calculator",
  "current-time",
  "weather-forecast",
  "budget-check",
  "itinerary-planner",
]);
export const skillIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/);

export const baseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "http:" || protocol === "https:";
    } catch {
      return false;
    }
  }, "请使用 http 或 https 地址");

const selectedSkillsSchema = z.array(skillIdSchema).default([]);

export const projectSlugSchema = z
  .string()
  .min(1, "项目标识不能为空")
  .max(64, "项目标识不能超过 64 个字符")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "请使用小写字母、数字和连字符")
  .refine((value) => !value.includes(".."), "不允许路径穿越");

export const modelConfigSchema = z.object({
  baseUrl: baseUrlSchema,
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
});

export const builderRunRequestSchema = z.object({
  baseUrl: baseUrlSchema,
  apiKey: z.string().min(1),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  selectedTools: z.array(toolIdSchema),
  selectedSkills: selectedSkillsSchema,
  userInput: z.string().min(1),
});

export const createProjectRequestSchema = z.object({
  projectName: z.string().min(1),
  projectSlug: projectSlugSchema,
  baseUrl: baseUrlSchema,
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  selectedTools: z.array(toolIdSchema),
  selectedSkills: selectedSkillsSchema,
});

export type ToolId = z.infer<typeof toolIdSchema>;
export type SkillId = z.infer<typeof skillIdSchema>;
export type BuilderRunRequest = z.infer<typeof builderRunRequestSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
