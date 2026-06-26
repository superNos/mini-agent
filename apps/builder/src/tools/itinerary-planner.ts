import { z } from "zod";
import type { Tool } from "@/agent/tool";

const itineraryPlannerInputSchema = z.object({
  destination: z.string().min(1).max(40),
  days: z.number().int().min(1).max(7),
  travelers: z.number().int().min(1).max(12).optional(),
  interests: z.array(z.string().min(1).max(24)).max(8).optional(),
  weatherSummary: z.string().max(300).optional(),
  budgetStatus: z.enum(["within-budget", "tight", "over-budget"]).optional(),
});

const DEFAULT_INTERESTS = ["城市漫步", "本地美食", "轻松打卡"];

function normalizeCity(value: string) {
  return value.trim().replace(/市$/, "");
}

function buildPace(status?: "within-budget" | "tight" | "over-budget") {
  if (status === "over-budget") return "压缩付费项目，优先选择免费街区和公园";
  if (status === "tight") return "控制节奏和付费项目，预留机动预算";
  return "节奏适中，保留临时调整空间";
}

function pickInterest(interests: string[], index: number) {
  return interests[index % interests.length];
}

export const itineraryPlannerTool: Tool<
  typeof itineraryPlannerInputSchema,
  {
    destination: string;
    days: number;
    travelers?: number;
    pace: string;
    assumptions: string[];
    plan: Array<{
      day: number;
      theme: string;
      morning: string;
      afternoon: string;
      evening: string;
      note: string;
    }>;
  }
> = {
  name: "itinerary-planner",
  description: "根据目的地、天数、天气摘要和预算状态生成结构化旅行日程。",
  schema: itineraryPlannerInputSchema,
  async run(input) {
    const destination = normalizeCity(input.destination);
    const interests = input.interests?.length ? input.interests : DEFAULT_INTERESTS;
    const pace = buildPace(input.budgetStatus);
    const rainy = input.weatherSummary?.includes("雨") ?? false;
    const hot = input.weatherSummary?.includes("高温") ?? false;

    return {
      destination,
      days: input.days,
      travelers: input.travelers,
      pace,
      assumptions: [
        "行程用于演示 Agent 工具编排，不包含实时门票、营业时间和交通班次。",
        rainy ? "天气摘要包含降雨，优先安排室内或可替换项目。" : "天气未显示明显降雨风险，适合安排户外漫步。",
        hot ? "天气可能偏热，午后安排应减少暴晒。" : "未检测到明显高温提示。",
      ],
      plan: Array.from({ length: input.days }, (_, index) => {
        const day = index + 1;
        const interest = pickInterest(interests, index);
        return {
          day,
          theme: `${destination}${day === 1 ? "初到适应" : `${interest}主题`}日`,
          morning:
            day === 1
              ? `抵达${destination}后办理入住或寄存行李，选择附近街区熟悉环境。`
              : `围绕「${interest}」安排半日核心项目，控制单点停留时间。`,
          afternoon: rainy
            ? "安排博物馆、展馆、商场或咖啡馆等室内项目，保留雨天备选。"
            : `安排${destination}代表性街区或公园，结合拍照和短距离步行。`,
          evening:
            input.budgetStatus === "over-budget"
              ? "选择平价本地餐食，减少夜间付费项目。"
              : "安排本地晚餐和轻量夜游，避免日程过满。",
          note: `${pace}。当天结束后根据体力、天气和预算再微调下一天。`,
        };
      }),
    };
  },
};
