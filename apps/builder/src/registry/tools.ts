import type { AnyTool } from "@/agent/tool";
import type { ToolId } from "@/schemas/agent-config";
import { budgetCheckTool } from "@/tools/budget-check";
import { calculatorTool } from "@/tools/calculator";
import { cityDistanceTool } from "@/tools/city-distance";
import { currentTimeTool } from "@/tools/current-time";
import { hotelPriceTool } from "@/tools/hotel-price";
import { transportEstimateTool } from "@/tools/transport-estimate";
import type { Skill } from "@/agent/skill";

export type ToolMetadata = {
  id: ToolId;
  name: string;
  description: string;
};

export const toolRegistry: Record<ToolId, AnyTool> = {
  calculator: calculatorTool,
  "current-time": currentTimeTool,
  "city-distance": cityDistanceTool,
  "transport-estimate": transportEstimateTool,
  "hotel-price": hotelPriceTool,
  "budget-check": budgetCheckTool,
};

export const toolMetadata: ToolMetadata[] = [
  {
    id: "calculator",
    name: "计算器",
    description: calculatorTool.description,
  },
  {
    id: "current-time",
    name: "当前时间",
    description: currentTimeTool.description,
  },
  {
    id: "city-distance",
    name: "城市距离",
    description: cityDistanceTool.description,
  },
  {
    id: "transport-estimate",
    name: "交通估算",
    description: transportEstimateTool.description,
  },
  {
    id: "hotel-price",
    name: "住宿估算",
    description: hotelPriceTool.description,
  },
  {
    id: "budget-check",
    name: "预算检查",
    description: budgetCheckTool.description,
  },
];

export function getToolsByIds(ids: ToolId[]) {
  return [...new Set(ids)].map((id) => toolRegistry[id]);
}

export function getToolIdsForSkills(skills: Skill[]): ToolId[] {
  const ids = skills.flatMap((skill) => skill.toolIds ?? []);
  return ids.filter((id): id is ToolId => id in toolRegistry);
}
