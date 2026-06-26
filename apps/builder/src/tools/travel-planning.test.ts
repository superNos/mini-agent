import { describe, expect, it } from "vitest";
import { budgetCheckTool } from "./budget-check";
import { cityDistanceTool } from "./city-distance";
import { hotelPriceTool } from "./hotel-price";
import { transportEstimateTool } from "./transport-estimate";

describe("travel planning tools", () => {
  it("estimates city distance from local coordinates", async () => {
    await expect(
      cityDistanceTool.run({ origin: "杭州", destination: "苏州" }),
    ).resolves.toMatchObject({
      origin: "杭州",
      destination: "苏州",
      distanceKm: 121,
      confidence: "estimate",
    });
  });

  it("estimates transport options for a group", async () => {
    const result = await transportEstimateTool.run({
      origin: "杭州",
      destination: "苏州",
      travelers: 2,
    });

    expect(result.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ mode: "高铁", totalCost: expect.any(Number) }),
        expect.objectContaining({ mode: "自驾", totalCost: expect.any(Number) }),
        expect.objectContaining({ mode: "长途车", totalCost: expect.any(Number) }),
      ]),
    );
    expect(result.recommendation).toContain("高铁");
  });

  it("estimates hotel options by city, nights, and travelers", async () => {
    const result = await hotelPriceTool.run({
      city: "苏州市",
      nights: 1,
      travelers: 2,
      level: "comfort",
    });

    expect(result).toMatchObject({
      city: "苏州",
      nights: 1,
      travelers: 2,
      rooms: 1,
      recommendedLevel: "comfort",
    });
    expect(result.options).toContainEqual(
      expect.objectContaining({
        level: "comfort",
        totalCost: 360,
      }),
    );
  });

  it("checks budget with a default buffer", async () => {
    await expect(
      budgetCheckTool.run({
        budget: 1500,
        items: [
          { name: "交通", amount: 160 },
          { name: "住宿", amount: 360 },
        ],
      }),
    ).resolves.toMatchObject({
      budget: 1500,
      subtotal: 520,
      bufferRate: 0.1,
      bufferAmount: 52,
      totalWithBuffer: 572,
      remaining: 928,
      status: "within-budget",
    });
  });

  it("rejects unsupported cities with a helpful message", async () => {
    await expect(
      cityDistanceTool.run({ origin: "火星", destination: "苏州" }),
    ).rejects.toThrow("可用城市");
  });
});
