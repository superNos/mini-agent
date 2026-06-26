import { z } from "zod";
import type { Tool } from "@/agent/tool";

const transportEstimateInputSchema = z.object({
  origin: z.string().min(1).max(40),
  destination: z.string().min(1).max(40),
  travelers: z.number().int().min(1).max(12),
});

type CityCoordinate = {
  latitude: number;
  longitude: number;
};

const CITY_COORDINATES: Record<string, CityCoordinate> = {
  北京: { latitude: 39.9042, longitude: 116.4074 },
  上海: { latitude: 31.2304, longitude: 121.4737 },
  广州: { latitude: 23.1291, longitude: 113.2644 },
  深圳: { latitude: 22.5431, longitude: 114.0579 },
  杭州: { latitude: 30.2741, longitude: 120.1551 },
  苏州: { latitude: 31.2989, longitude: 120.5853 },
  南京: { latitude: 32.0603, longitude: 118.7969 },
  成都: { latitude: 30.5728, longitude: 104.0668 },
  重庆: { latitude: 29.563, longitude: 106.5516 },
  西安: { latitude: 34.3416, longitude: 108.9398 },
  厦门: { latitude: 24.4798, longitude: 118.0894 },
  长沙: { latitude: 28.2282, longitude: 112.9388 },
};

function normalizeCity(value: string) {
  return value.trim().replace(/市$/, "");
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(origin: CityCoordinate, destination: CityCoordinate) {
  const earthRadiusKm = 6371;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function roundMoney(value: number) {
  return Math.round(value);
}

function roundHours(value: number) {
  return Math.round(value * 10) / 10;
}

export const transportEstimateTool: Tool<
  typeof transportEstimateInputSchema,
  {
    origin: string;
    destination: string;
    travelers: number;
    distanceKm: number;
    options: Array<{
      mode: "高铁" | "自驾" | "长途车";
      totalCost: number;
      costPerPerson?: number;
      durationHours: number;
      note: string;
    }>;
    recommendation: string;
  }
> = {
  name: "transport-estimate",
  description: "基于内置距离估算高铁、自驾和长途车的费用与耗时。",
  schema: transportEstimateInputSchema,
  async run(input) {
    const origin = normalizeCity(input.origin);
    const destination = normalizeCity(input.destination);
    const originCoordinate = CITY_COORDINATES[origin];
    const destinationCoordinate = CITY_COORDINATES[destination];

    if (!originCoordinate || !destinationCoordinate) {
      const availableCities = Object.keys(CITY_COORDINATES).join("、");
      throw new Error(`暂无交通估算数据：${!originCoordinate ? origin : destination}。可用城市：${availableCities}`);
    }

    const distanceKm = calculateDistanceKm(originCoordinate, destinationCoordinate);
    const railPerPerson = Math.max(38, roundMoney(distanceKm * 0.45 + 18));
    const busPerPerson = Math.max(35, roundMoney(distanceKm * 0.28 + 20));
    const carCount = Math.ceil(input.travelers / 4);
    const carTotal = roundMoney(carCount * (distanceKm * 1.18 + 60));

    const options = [
      {
        mode: "高铁" as const,
        totalCost: railPerPerson * input.travelers,
        costPerPerson: railPerPerson,
        durationHours: roundHours(distanceKm / 180 + 0.6),
        note: "适合时间确定、希望减少路上疲劳的行程。",
      },
      {
        mode: "自驾" as const,
        totalCost: carTotal,
        durationHours: roundHours(distanceKm / 90 + 0.5),
        note: "适合多人同行或目的地之间需要灵活移动的行程。",
      },
      {
        mode: "长途车" as const,
        totalCost: busPerPerson * input.travelers,
        costPerPerson: busPerPerson,
        durationHours: roundHours(distanceKm / 75 + 0.8),
        note: "费用较低，但舒适度和确定性通常弱于高铁。",
      },
    ];

    const recommendation =
      input.travelers >= 3 && distanceKm <= 280
        ? "多人短途可优先考虑自驾；如果不想开车，高铁是更稳妥的选择。"
        : "优先选择高铁，时间稳定且总成本可控。";

    return {
      origin,
      destination,
      travelers: input.travelers,
      distanceKm,
      options,
      recommendation,
    };
  },
};
