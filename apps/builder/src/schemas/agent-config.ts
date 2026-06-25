import { z } from "zod";

export const toolIdSchema = z.enum(["calculator", "current-time"]);

export const projectSlugSchema = z
  .string()
  .min(1, "Project slug is required")
  .max(64, "Project slug must be 64 characters or less")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens")
  .refine((value) => !value.includes(".."), "Path traversal is not allowed");

export const modelConfigSchema = z.object({
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
});

export const builderRunRequestSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  selectedTools: z.array(toolIdSchema),
  selectedSkills: z.array(z.string()).default([]),
  userInput: z.string().min(1),
});

export const createProjectRequestSchema = z.object({
  projectName: z.string().min(1),
  projectSlug: projectSlugSchema,
  baseUrl: z.string().url(),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  selectedTools: z.array(toolIdSchema),
  selectedSkills: z.array(z.string()).default([]),
});

export type ToolId = z.infer<typeof toolIdSchema>;
export type BuilderRunRequest = z.infer<typeof builderRunRequestSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
