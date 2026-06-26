import { afterEach, describe, expect, it, vi } from "vitest";
import { attractionSearchTool } from "./attraction-search";
import { weatherForecastTool } from "./weather-forecast";

const originalOpenTripMapApiKey = process.env.OPENTRIPMAP_API_KEY;

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalOpenTripMapApiKey === undefined) {
    delete process.env.OPENTRIPMAP_API_KEY;
  } else {
    process.env.OPENTRIPMAP_API_KEY = originalOpenTripMapApiKey;
  }
});

describe("external travel tools", () => {
  it("queries Open-Meteo geocoding and forecast APIs", async () => {
    const fetchMock = vi.fn(async (url: URL | RequestInfo) => {
      const href = String(url);
      if (href.startsWith("https://geocoding-api.open-meteo.com")) {
        return jsonResponse({
          results: [
            {
              name: "苏州",
              latitude: 31.2989,
              longitude: 120.5853,
              country: "中国",
              admin1: "江苏省",
              timezone: "Asia/Shanghai",
            },
          ],
        });
      }
      if (href.startsWith("https://api.open-meteo.com")) {
        return jsonResponse({
          timezone: "Asia/Shanghai",
          daily: {
            time: ["2026-06-26", "2026-06-27"],
            weather_code: [1, 61],
            temperature_2m_max: [31.2, 29.4],
            temperature_2m_min: [24.1, 23.8],
            precipitation_probability_max: [20, 70],
          },
        });
      }
      throw new Error(`Unexpected URL: ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await weatherForecastTool.run({ city: "苏州市", forecastDays: 2 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      source: "open-meteo",
      city: "苏州",
      location: {
        name: "苏州",
        timezone: "Asia/Shanghai",
      },
      daily: [
        {
          date: "2026-06-26",
          weather: "多云",
          temperatureMaxC: 31.2,
        },
        {
          date: "2026-06-27",
          weather: "雨",
          precipitationProbabilityMax: 70,
        },
      ],
    });
  });

  it("returns a non-failing configuration hint when OpenTripMap key is missing", async () => {
    delete process.env.OPENTRIPMAP_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await attractionSearchTool.run({ city: "苏州" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      source: "opentripmap",
      configured: false,
      city: "苏州",
      places: [],
    });
    expect(result.note).toContain("OPENTRIPMAP_API_KEY");
  });

  it("queries OpenTripMap geoname and radius APIs when a free key is configured", async () => {
    process.env.OPENTRIPMAP_API_KEY = "test-key";
    const fetchMock = vi.fn(async (url: URL | RequestInfo) => {
      const href = String(url);
      if (href.includes("/places/geoname")) {
        expect(href).toContain("apikey=test-key");
        return jsonResponse({
          name: "Suzhou",
          lat: 31.2989,
          lon: 120.5853,
          country: "CN",
        });
      }
      if (href.includes("/places/radius")) {
        expect(href).toContain("apikey=test-key");
        return jsonResponse([
          {
            xid: "W123",
            name: "拙政园",
            dist: 1260.4,
            rate: 3,
            kinds: "gardens,historic",
            point: { lat: 31.324, lon: 120.627 },
          },
        ]);
      }
      throw new Error(`Unexpected URL: ${href}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await attractionSearchTool.run({
      city: "苏州",
      radiusMeters: 8000,
      limit: 6,
      language: "zh",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({
      source: "opentripmap",
      configured: true,
      city: "苏州",
      location: {
        name: "Suzhou",
        latitude: 31.2989,
        longitude: 120.5853,
      },
      places: [
        {
          xid: "W123",
          name: "拙政园",
          distanceMeters: 1260,
          kinds: ["gardens", "historic"],
        },
      ],
    });
  });
});
