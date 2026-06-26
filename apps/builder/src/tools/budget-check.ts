import { z } from "zod";
import type { Tool } from "@/agent/tool";

const budgetItemSchema = z.object({
  name: z.string().min(1).max(40),
  amount: z.number().nonnegative().max(100_000),
});

const budgetCheckInputSchema = z.object({
  budget: z.number().positive().max(1_000_000),
  items: z.array(budgetItemSchema).min(1).max(20),
  bufferRate: z.number().min(0).max(0.5).optional(),
});

function roundMoney(value: number) {
  return Math.round(value);
}

export const budgetCheckTool: Tool<
  typeof budgetCheckInputSchema,
  {
    budget: number;
    subtotal: number;
    bufferRate: number;
    bufferAmount: number;
    totalWithBuffer: number;
    remaining: number;
    status: "within-budget" | "tight" | "over-budget";
    suggestions: string[];
  }
> = {
  name: "budget-check",
  description: "汇总费用项目，判断旅行预算是否充足，并给出调整建议。",
  schema: budgetCheckInputSchema,
  async run(input) {
    const subtotal = roundMoney(input.items.reduce((sum, item) => sum + item.amount, 0));
    const bufferRate = input.bufferRate ?? 0.1;
    const bufferAmount = roundMoney(subtotal * bufferRate);
    const totalWithBuffer = subtotal + bufferAmount;
    const remaining = roundMoney(input.budget - totalWithBuffer);
    const ratio = totalWithBuffer / input.budget;
    const status =
      ratio <= 0.85 ? "within-budget" : ratio <= 1 ? "tight" : "over-budget";
    const suggestions =
      status === "within-budget"
        ? ["预算充足，可以把剩余额度留给餐饮、门票或临时交通。"]
        : status === "tight"
          ? ["预算接近上限，建议提前锁定交通和住宿价格，并减少非必要消费。"]
          : [
              "当前方案超过预算，优先下调住宿档位或减少夜数。",
              "如果多人同行，可比较自驾和高铁的总成本。",
            ];

    return {
      budget: input.budget,
      subtotal,
      bufferRate,
      bufferAmount,
      totalWithBuffer,
      remaining,
      status,
      suggestions,
    };
  },
};
