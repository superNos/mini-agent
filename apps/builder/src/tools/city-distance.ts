import { z } from "zod";
import type { Tool } from "@/agent/tool";

const cityDistanceInputSchema = z.object({
  origin: z.string().min(1).max(40),
  destination: z.string().min(1).max(40),
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

export const cityDistanceTool: Tool<
  typeof cityDistanceInputSchema,
  {
    origin: string;
    destination: string;
    distanceKm: number;
    method: string;
    confidence: "estimate";
    note: string;
  }
> = {
  name: "city-distance",
  description: "根据内置城市坐标估算两个城市之间的直线距离。",
  schema: cityDistanceInputSchema,
  async run(input) {
    const origin = normalizeCity(input.origin);
    const destination = normalizeCity(input.destination);
    const originCoordinate = CITY_COORDINATES[origin];
    const destinationCoordinate = CITY_COORDINATES[destination];

    if (!originCoordinate || !destinationCoordinate) {
      const availableCities = Object.keys(CITY_COORDINATES).join("、");
      throw new Error(`暂无城市坐标：${!originCoordinate ? origin : destination}。可用城市：${availableCities}`);
    }

    return {
      origin,
      destination,
      distanceKm: calculateDistanceKm(originCoordinate, destinationCoordinate),
      method: "local-coordinate-haversine",
      confidence: "estimate",
      note: "这是基于内置坐标的直线距离估算，实际交通里程通常会更长。",
    };
  },
};
