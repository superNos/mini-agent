import { describe, expect, it } from "vitest";
import { currentTimeTool } from "./current-time";

describe("currentTimeTool", () => {
  it("returns a stable time object shape", async () => {
    const result = await currentTimeTool.run({});

    expect(result.iso).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.locale).toBe("en-US");
    expect(typeof result.timezone).toBe("string");
  });
});
