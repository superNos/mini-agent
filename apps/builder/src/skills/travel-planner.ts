import type { Skill } from "@/agent/skill";

export const travelPlannerSkill: Skill = {
  id: "travel-planner",
  name: "旅行计划",
  description: "把旅行需求拆成距离、交通、住宿和预算检查",
  systemPromptAddon:
    "当用户要求制作旅行计划时，先明确出发地、目的地、人数、天数和预算；优先调用 city-distance、transport-estimate、hotel-price、budget-check 工具。回答时说明关键假设、推荐交通方式、住宿档位、预算是否充足，并避免编造实时票价或酒店库存。",
  toolIds: ["city-distance", "transport-estimate", "hotel-price", "budget-check"],
};
