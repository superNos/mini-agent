import { z } from "zod";

export const toolIdSchema = z.enum(["calculator", "current-time"]);

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
  }, "Use an http or https URL");

const selectedSkillsSchema = z.array(z.string()).max(0, "No skills are installed yet").default([]);

export const projectSlugSchema = z
  .string()
  .min(1, "Project slug is required")
  .max(64, "Project slug must be 64 characters or less")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens")
  .refine((value) => !value.includes(".."), "Path traversal is not allowed");

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
export type BuilderRunRequest = z.infer<typeof builderRunRequestSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
