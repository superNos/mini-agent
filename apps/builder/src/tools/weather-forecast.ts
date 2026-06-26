import { z } from "zod";
import type { Tool } from "@/agent/tool";

const weatherForecastInputSchema = z.object({
  city: z.string().min(1).max(40),
  forecastDays: z.number().int().min(1).max(7).optional(),
});

const geocodingResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        country: z.string().optional(),
        admin1: z.string().optional(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

const forecastResponseSchema = z.object({
  timezone: z.string().optional(),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number()),
    temperature_2m_max: z.array(z.number()),
    temperature_2m_min: z.array(z.number()),
    precipitation_probability_max: z.array(z.number()).optional(),
  }),
});

function normalizeCity(value: string) {
  return value.trim().replace(/市$/, "");
}

function weatherLabel(code: number) {
  if (code === 0) return "晴";
  if ([1, 2, 3].includes(code)) return "多云";
  if ([45, 48].includes(code)) return "雾";
  if ([51, 53, 55, 56, 57].includes(code)) return "毛毛雨";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "雨";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "雪";
  if ([95, 96, 99].includes(code)) return "雷暴";
  return "未知天气";
}

async function fetchJson(url: URL, label: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} request failed: ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

export const weatherForecastTool: Tool<
  typeof weatherForecastInputSchema,
  {
    source: "open-meteo";
    city: string;
    location: {
      name: string;
      country?: string;
      admin1?: string;
      latitude: number;
      longitude: number;
      timezone?: string;
    };
    daily: Array<{
      date: string;
      weatherCode: number;
      weather: string;
      temperatureMaxC: number;
      temperatureMinC: number;
      precipitationProbabilityMax?: number;
    }>;
    note: string;
  }
> = {
  name: "weather-forecast",
  description: "调用 Open-Meteo 免费接口查询目的地未来天气。",
  schema: weatherForecastInputSchema,
  async run(input) {
    const city = normalizeCity(input.city);
    const forecastDays = input.forecastDays ?? 3;
    const geocodingUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
    geocodingUrl.searchParams.set("name", city);
    geocodingUrl.searchParams.set("count", "1");
    geocodingUrl.searchParams.set("language", "zh");
    geocodingUrl.searchParams.set("format", "json");

    const geocoding = geocodingResponseSchema.parse(
      await fetchJson(geocodingUrl, "Open-Meteo geocoding"),
    );
    const location = geocoding.results?.[0];
    if (!location) {
      throw new Error(`Open-Meteo 未找到城市：${city}`);
    }

    const forecastUrl = new URL("https://api.open-meteo.com/v1/forecast");
    forecastUrl.searchParams.set("latitude", String(location.latitude));
    forecastUrl.searchParams.set("longitude", String(location.longitude));
    forecastUrl.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    );
    forecastUrl.searchParams.set("timezone", "auto");
    forecastUrl.searchParams.set("forecast_days", String(forecastDays));

    const forecast = forecastResponseSchema.parse(
      await fetchJson(forecastUrl, "Open-Meteo forecast"),
    );

    return {
      source: "open-meteo",
      city,
      location: {
        name: location.name,
        country: location.country,
        admin1: location.admin1,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone: location.timezone ?? forecast.timezone,
      },
      daily: forecast.daily.time.map((date, index) => {
        const weatherCode = forecast.daily.weather_code[index] ?? -1;
        return {
          date,
          weatherCode,
          weather: weatherLabel(weatherCode),
          temperatureMaxC: forecast.daily.temperature_2m_max[index] ?? 0,
          temperatureMinC: forecast.daily.temperature_2m_min[index] ?? 0,
          precipitationProbabilityMax: forecast.daily.precipitation_probability_max?.[index],
        };
      }),
      note: "天气来自 Open-Meteo 免费接口，适合演示和轻量使用；旅行前仍应以当天官方天气为准。",
    };
  },
};
