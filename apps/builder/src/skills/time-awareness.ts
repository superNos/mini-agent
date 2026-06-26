import type { Skill } from "@/agent/skill";

export const timeAwarenessSkill: Skill = {
  id: "time-awareness",
  name: "时间感知",
  description: "遇到当前时间、今天、现在等问题时使用时间工具",
  systemPromptAddon:
    "当用户问题依赖当前时间、日期、时区或相对时间时，优先调用 current-time 工具获取运行时刻。",
  toolIds: ["current-time"],
};
