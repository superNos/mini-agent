import type { z } from "zod";

export type Tool<TInput extends z.ZodType = z.ZodType, TOutput = unknown> = {
  name: string;
  description: string;
  schema: TInput;
  run(input: z.infer<TInput>): Promise<TOutput>;
};

export type AnyTool = Tool<z.ZodType, unknown>;
