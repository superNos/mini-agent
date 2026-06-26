import { describe, expect, it } from "vitest";
import { budgetCheckTool } from "./budget-check";
import { itineraryPlannerTool } from "./itinerary-planner";

describe("travel planning tools", () => {
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

  it("creates a structured itinerary from weather and budget context", async () => {
    const result = await itineraryPlannerTool.run({
      destination: "苏州市",
      days: 2,
      travelers: 2,
      interests: ["园林", "美食"],
      weatherSummary: "多云，可能有小雨",
      budgetStatus: "within-budget",
    });

    expect(result).toMatchObject({
      destination: "苏州",
      days: 2,
      travelers: 2,
      pace: "节奏适中，保留临时调整空间",
    });
    expect(result.assumptions).toEqual(
      expect.arrayContaining([expect.stringContaining("降雨")]),
    );
    expect(result.plan).toHaveLength(2);
    expect(result.plan[0]).toEqual(
      expect.objectContaining({
        day: 1,
        morning: expect.stringContaining("苏州"),
        afternoon: expect.stringContaining("室内"),
      }),
    );
  });
});
