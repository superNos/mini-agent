import type { ToolId } from "@/schemas/agent-config";

const exportNames: Record<ToolId, string> = {
  calculator: "calculatorTool",
  "current-time": "currentTimeTool",
  "city-distance": "cityDistanceTool",
  "transport-estimate": "transportEstimateTool",
  "hotel-price": "hotelPriceTool",
  "budget-check": "budgetCheckTool",
};

export function renderToolsIndex(selectedTools: ToolId[]) {
  const imports = selectedTools
    .map((toolId) => `import { ${exportNames[toolId]} } from "./${toolId}";`)
    .join("\n");
  const entries = selectedTools
    .map((toolId) => `  "${toolId}": ${exportNames[toolId]},`)
    .join("\n");

  return `${imports}
import type { AnyTool } from "../agent/tool";

const tools: Record<string, AnyTool> = {
${entries}
};

export function getSelectedTools(ids: readonly string[]) {
  return ids.map((id) => tools[id]).filter((tool): tool is AnyTool => Boolean(tool));
}
`;
}
