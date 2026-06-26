import { z } from "zod";
import type { Tool } from "@/agent/tool";

const attractionSearchInputSchema = z.object({
  city: z.string().min(1).max(40),
  radiusMeters: z.number().int().min(500).max(30_000).optional(),
  limit: z.number().int().min(1).max(10).optional(),
  language: z.enum(["zh", "en"]).optional(),
});

const geonameResponseSchema = z.object({
  name: z.string().optional(),
  lat: z.number().optional(),
  lon: z.number().optional(),
  country: z.string().optional(),
});

const radiusPlaceSchema = z.object({
  xid: z.string().optional(),
  name: z.string().optional(),
  dist: z.number().optional(),
  rate: z.number().optional(),
  kinds: z.string().optional(),
  point: z
    .object({
      lat: z.number().optional(),
      lon: z.number().optional(),
    })
    .optional(),
});

const radiusResponseSchema = z.array(radiusPlaceSchema);

function normalizeCity(value: string) {
  return value.trim().replace(/市$/, "");
}

function openTripMapApiKey() {
  return process.env.OPENTRIPMAP_API_KEY?.trim();
}

async function fetchJson(url: URL, label: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} request failed: ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

export const attractionSearchTool: Tool<
  typeof attractionSearchInputSchema,
  {
    source: "opentripmap";
    configured: boolean;
    city: string;
    location?: {
      name?: string;
      country?: string;
      latitude: number;
      longitude: number;
    };
    places: Array<{
      xid?: string;
      name: string;
      distanceMeters?: number;
      rate?: number;
      kinds?: string[];
      latitude?: number;
      longitude?: number;
    }>;
    note: string;
  }
> = {
  name: "attraction-search",
  description: "调用 OpenTripMap 免费档接口查询目的地附近景点；需要 OPENTRIPMAP_API_KEY。",
  schema: attractionSearchInputSchema,
  async run(input) {
    const apiKey = openTripMapApiKey();
    const city = normalizeCity(input.city);
    const language = input.language ?? "zh";
    const radiusMeters = input.radiusMeters ?? 8_000;
    const limit = input.limit ?? 6;

    if (!apiKey) {
      return {
        source: "opentripmap",
        configured: false,
        city,
        places: [],
        note: "未配置 OPENTRIPMAP_API_KEY。申请 OpenTripMap 免费 Key 后写入 .env.local 即可返回真实景点数据。",
      };
    }

    const geonameUrl = new URL(`https://api.opentripmap.com/0.1/${language}/places/geoname`);
    geonameUrl.searchParams.set("name", city);
    geonameUrl.searchParams.set("apikey", apiKey);
    const geoname = geonameResponseSchema.parse(
      await fetchJson(geonameUrl, "OpenTripMap geoname"),
    );

    if (typeof geoname.lat !== "number" || typeof geoname.lon !== "number") {
      throw new Error(`OpenTripMap 未找到城市：${city}`);
    }

    const radiusUrl = new URL(`https://api.opentripmap.com/0.1/${language}/places/radius`);
    radiusUrl.searchParams.set("radius", String(radiusMeters));
    radiusUrl.searchParams.set("lon", String(geoname.lon));
    radiusUrl.searchParams.set("lat", String(geoname.lat));
    radiusUrl.searchParams.set("rate", "2");
    radiusUrl.searchParams.set("limit", String(limit));
    radiusUrl.searchParams.set("format", "json");
    radiusUrl.searchParams.set("apikey", apiKey);
    const radius = radiusResponseSchema.parse(
      await fetchJson(radiusUrl, "OpenTripMap radius"),
    );

    return {
      source: "opentripmap",
      configured: true,
      city,
      location: {
        name: geoname.name,
        country: geoname.country,
        latitude: geoname.lat,
        longitude: geoname.lon,
      },
      places: radius
        .filter((place) => place.name && place.name.trim().length > 0)
        .slice(0, limit)
        .map((place) => ({
          xid: place.xid,
          name: place.name ?? "",
          distanceMeters: place.dist === undefined ? undefined : Math.round(place.dist),
          rate: place.rate,
          kinds: place.kinds?.split(",").filter(Boolean),
          latitude: place.point?.lat,
          longitude: place.point?.lon,
        })),
      note: "景点数据来自 OpenTripMap 免费档；结果用于行程灵感，不代表营业时间或门票实时状态。",
    };
  },
};
