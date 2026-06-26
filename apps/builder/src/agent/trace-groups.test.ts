import { describe, expect, it } from "vitest";
import { groupTraceSteps } from "./trace-groups";
import type { TraceStep } from "./trace";

describe("groupTraceSteps", () => {
  it("groups model and tool lifecycle events into single cards", () => {
    const trace: TraceStep[] = [
      {
        step: 1,
        type: "model",
        phase: "started",
        startedAt: "2026-06-26T00:00:00.000Z",
        modelInput: [{ role: "user", content: "plan a trip" }],
      },
      {
        step: 1,
        type: "model",
        phase: "completed",
        startedAt: "2026-06-26T00:00:00.000Z",
        completedAt: "2026-06-26T00:00:01.000Z",
        durationMs: 1000,
        modelInput: [{ role: "user", content: "plan a trip" }],
        modelOutput: "{\"type\":\"tool\",\"toolName\":\"weather-forecast\",\"toolInput\":{}}",
      },
      {
        step: 1,
        type: "action",
        phase: "parsed",
        action: { type: "tool", toolName: "weather-forecast", toolInput: { city: "Suzhou" } },
        modelOutput: "{\"type\":\"tool\",\"toolName\":\"weather-forecast\",\"toolInput\":{}}",
      },
      {
        step: 1,
        type: "tool",
        phase: "started",
        toolName: "weather-forecast",
        toolInput: { city: "Suzhou" },
        startedAt: "2026-06-26T00:00:01.000Z",
      },
      {
        step: 1,
        type: "tool",
        phase: "completed",
        toolName: "weather-forecast",
        toolInput: { city: "Suzhou" },
        toolOutput: { temperature: 28 },
        startedAt: "2026-06-26T00:00:01.000Z",
        completedAt: "2026-06-26T00:00:02.000Z",
        durationMs: 1000,
      },
      {
        step: 1,
        type: "observation",
        phase: "appended",
        toolName: "weather-forecast",
        observation: "Observation from tool",
        messages: [{ role: "user", content: "Observation from tool" }],
      },
      {
        step: 2,
        type: "final",
        phase: "completed",
        finalAnswer: "done",
      },
    ];

    const groups = groupTraceSteps(trace);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({
      key: "1:model",
      type: "model",
      primary: trace[1],
      started: trace[0],
      completed: trace[1],
      action: trace[2],
    });
    expect(groups[0].steps).toEqual([trace[0], trace[1], trace[2]]);
    expect(groups[1]).toMatchObject({
      key: "1:tool:weather-forecast",
      type: "tool",
      primary: trace[4],
      started: trace[3],
      completed: trace[4],
      observation: trace[5],
    });
    expect(groups[1].steps).toEqual([trace[3], trace[4], trace[5]]);
  });

  it("creates a visible skill group", () => {
    const trace: TraceStep[] = [
      {
        step: 0,
        type: "skill",
        phase: "loaded",
        loadedAt: "2026-06-26T00:00:00.000Z",
        skills: [
          {
            id: "travel-planner",
            name: "旅行计划",
            description: "规划旅行",
            content: "先确认城市和天数。",
            toolIds: ["weather-forecast"],
          },
        ],
      },
    ];

    const groups = groupTraceSteps(trace);

    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      key: "0:skill",
      type: "skill",
      primary: trace[0],
    });
  });

  it("keeps different tools in separate groups even when they share a loop step", () => {
    const trace: TraceStep[] = [
      {
        step: 1,
        type: "tool",
        phase: "started",
        toolName: "weather-forecast",
        toolInput: {},
        startedAt: "2026-06-26T00:00:00.000Z",
      },
      {
        step: 1,
        type: "tool",
        phase: "started",
        toolName: "budget-check",
        toolInput: {},
        startedAt: "2026-06-26T00:00:00.000Z",
      },
    ];

    const groups = groupTraceSteps(trace);

    expect(groups.map((group) => group.key)).toEqual(["1:tool:weather-forecast", "1:tool:budget-check"]);
  });
});
