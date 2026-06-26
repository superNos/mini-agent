import type { Skill } from "@/agent/skill";

export const travelPlannerSkill: Skill = {
  id: "travel-planner",
  name: "旅行计划",
  description: "把旅行需求拆成天气查询、预算评估和行程安排",
  systemPromptAddon:
    "当用户要求制作旅行计划时，先明确目的地、人数、天数和预算；优先调用 weather-forecast 查询天气，调用 budget-check 评估预算，再调用 itinerary-planner 生成行程安排。回答时说明关键假设、天气影响、预算是否充足和每日安排，并避免编造实时票价、酒店库存或景点营业状态。",
  toolIds: ["weather-forecast", "budget-check", "itinerary-planner"],
};
