import type { AnyTool } from "@/agent/tool";
import type { ToolId } from "@/schemas/agent-config";
import { calculatorTool } from "@/tools/calculator";
import { currentTimeTool } from "@/tools/current-time";

export const toolRegistry: Record<ToolId, AnyTool> = {
  calculator: calculatorTool,
  "current-time": currentTimeTool,
};

export function getToolsByIds(ids: ToolId[]) {
  return ids.map((id) => toolRegistry[id]);
}
