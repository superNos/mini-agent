import { afterEach, describe, expect, it, vi } from "vitest";
import { weatherForecastTool } from "./weather-forecast";

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
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
});
