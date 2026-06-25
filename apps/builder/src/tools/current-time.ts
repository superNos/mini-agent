import { z } from "zod";
import type { Tool } from "@/agent/tool";

const currentTimeInputSchema = z.object({});

export const currentTimeTool: Tool<
  typeof currentTimeInputSchema,
  { iso: string; locale: string; timezone: string }
> = {
  name: "current-time",
  description: "Return the current runtime time as an ISO timestamp.",
  schema: currentTimeInputSchema,
  async run() {
    return {
      iso: new Date().toISOString(),
      locale: "en-US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  },
};
