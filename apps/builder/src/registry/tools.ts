import type { AnyTool } from "@/agent/tool";
import type { ToolId } from "@/schemas/agent-config";
import { calculatorTool } from "@/tools/calculator";
import { currentTimeTool } from "@/tools/current-time";

export type ToolMetadata = {
  id: ToolId;
  name: string;
  description: string;
};

export const toolRegistry: Record<ToolId, AnyTool> = {
  calculator: calculatorTool,
  "current-time": currentTimeTool,
};

export const toolMetadata: ToolMetadata[] = [
  {
    id: "calculator",
    name: "Calculator",
    description: calculatorTool.description,
  },
  {
    id: "current-time",
    name: "Current Time",
    description: currentTimeTool.description,
  },
];

export function getToolsByIds(ids: ToolId[]) {
  return ids.map((id) => toolRegistry[id]);
}
