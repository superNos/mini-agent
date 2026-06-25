import { describe, expect, it } from "vitest";
import { calculatorTool } from "./calculator";

describe("calculatorTool", () => {
  it("evaluates supported arithmetic", async () => {
    await expect(calculatorTool.run({ expression: "2 + 3 * 4" })).resolves.toEqual({
      result: 14,
    });
  });

  it("supports parentheses", async () => {
    await expect(calculatorTool.run({ expression: "(2 + 3) * 4" })).resolves.toEqual({
      result: 20,
    });
  });

  it("rejects unsafe expressions", async () => {
    await expect(
      calculatorTool.run({ expression: "process.exit()" }),
    ).rejects.toThrow("Unsupported character");
  });

  it("rejects malformed numbers with multiple decimal points", async () => {
    await expect(calculatorTool.run({ expression: "1..2" })).rejects.toThrow("Invalid number");
  });

  it("rejects a decimal point without digits", async () => {
    await expect(calculatorTool.run({ expression: "." })).rejects.toThrow("Invalid number");
  });

  it("rejects non-finite results", async () => {
    await expect(calculatorTool.run({ expression: "2 / 0" })).rejects.toThrow(
      "Result is not finite",
    );
  });
});
