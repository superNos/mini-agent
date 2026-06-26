import { z } from "zod";
import type { Tool } from "@/agent/tool";

const hotelPriceInputSchema = z.object({
  city: z.string().min(1).max(40),
  nights: z.number().int().min(1).max(14),
  travelers: z.number().int().min(1).max(12),
  level: z.enum(["budget", "comfort", "boutique"]).optional(),
});

const CITY_BASE_PRICE: Record<string, number> = {
  北京: 560,
  上海: 620,
  广州: 480,
  深圳: 540,
  杭州: 420,
  苏州: 360,
  南京: 380,
  成都: 340,
  重庆: 330,
  西安: 320,
  厦门: 460,
  长沙: 330,
};

const LEVEL_FACTOR = {
  budget: 0.72,
  comfort: 1,
  boutique: 1.38,
} as const;

const LEVEL_NAME = {
  budget: "经济型",
  comfort: "舒适型",
  boutique: "精品型",
} as const;

function normalizeCity(value: string) {
  return value.trim().replace(/市$/, "");
}

function roundMoney(value: number) {
  return Math.round(value);
}

export const hotelPriceTool: Tool<
  typeof hotelPriceInputSchema,
  {
    city: string;
    nights: number;
    travelers: number;
    rooms: number;
    recommendedLevel: "budget" | "comfort" | "boutique";
    options: Array<{
      level: "budget" | "comfort" | "boutique";
      name: string;
      pricePerRoomNight: number;
      totalCost: number;
      note: string;
    }>;
  }
> = {
  name: "hotel-price",
  description: "根据内置城市房价估算住宿方案和总价。",
  schema: hotelPriceInputSchema,
  async run(input) {
    const city = normalizeCity(input.city);
    const basePrice = CITY_BASE_PRICE[city];

    if (!basePrice) {
      const availableCities = Object.keys(CITY_BASE_PRICE).join("、");
      throw new Error(`暂无住宿估算数据：${city}。可用城市：${availableCities}`);
    }

    const rooms = Math.ceil(input.travelers / 2);
    const recommendedLevel = input.level ?? "comfort";
    const options = (Object.keys(LEVEL_FACTOR) as Array<keyof typeof LEVEL_FACTOR>).map((level) => {
      const pricePerRoomNight = roundMoney(basePrice * LEVEL_FACTOR[level]);
      return {
        level,
        name: `${LEVEL_NAME[level]}酒店`,
        pricePerRoomNight,
        totalCost: pricePerRoomNight * rooms * input.nights,
        note:
          level === "budget"
            ? "控制预算优先，位置和房间面积可能需要取舍。"
            : level === "comfort"
              ? "兼顾位置、舒适度和价格，适合大多数短途旅行。"
              : "体验更好，适合作为纪念日或放松型行程。",
      };
    });

    return {
      city,
      nights: input.nights,
      travelers: input.travelers,
      rooms,
      recommendedLevel,
      options,
    };
  },
};
