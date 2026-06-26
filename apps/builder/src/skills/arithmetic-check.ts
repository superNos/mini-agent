import type { Skill } from "@/agent/skill";

export const arithmeticCheckSkill: Skill = {
  id: "arithmetic-check",
  name: "算术校验",
  description: "遇到算术表达式时使用计算器工具验证结果",
  systemPromptAddon:
    "当用户问题包含算术表达式或明确要求计算时，优先调用 calculator 工具，不要只凭模型估算。",
  toolIds: ["calculator"],
};
