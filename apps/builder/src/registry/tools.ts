import type { AnyTool } from "@/agent/tool";
import type { ToolId } from "@/schemas/agent-config";
import { budgetCheckTool } from "@/tools/budget-check";
import { calculatorTool } from "@/tools/calculator";
import { currentTimeTool } from "@/tools/current-time";
import { itineraryPlannerTool } from "@/tools/itinerary-planner";
import { weatherForecastTool } from "@/tools/weather-forecast";
import type { Skill } from "@/agent/skill";

export type ToolMetadata = {
  id: ToolId;
  name: string;
  description: string;
};

export const toolRegistry: Record<ToolId, AnyTool> = {
  calculator: calculatorTool,
  "current-time": currentTimeTool,
  "weather-forecast": weatherForecastTool,
  "budget-check": budgetCheckTool,
  "itinerary-planner": itineraryPlannerTool,
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
    id: "weather-forecast",
    name: "天气预报",
    description: weatherForecastTool.description,
  },
  {
    id: "budget-check",
    name: "预算检查",
    description: budgetCheckTool.description,
  },
  {
    id: "itinerary-planner",
    name: "行程安排",
    description: itineraryPlannerTool.description,
  },
];

export function getToolsByIds(ids: ToolId[]) {
  return [...new Set(ids)].map((id) => toolRegistry[id]);
}

export function getToolIdsForSkills(skills: Skill[]): ToolId[] {
  const ids = skills.flatMap((skill) => skill.toolIds ?? []);
  return ids.filter((id): id is ToolId => id in toolRegistry);
}
