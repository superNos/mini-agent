import { z } from "zod";
import type { Tool } from "@/agent/tool";

const calculatorInputSchema = z.object({
  expression: z.string().min(1).max(120),
});

type Token = { type: "number"; value: number } | { type: "op"; value: string };

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < expression.length) {
    const char = expression[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let value = char;
      index += 1;
      while (index < expression.length && /[0-9.]/.test(expression[index])) {
        value += expression[index];
        index += 1;
      }
      if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value)) {
        throw new Error("Invalid number");
      }
      const number = Number(value);
      if (!Number.isFinite(number)) {
        throw new Error("Invalid number");
      }
      tokens.push({ type: "number", value: number });
      continue;
    }

    if ("+-*/()".includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }

    throw new Error(`Unsupported character: ${char}`);
  }

  return tokens;
}

function evaluateTokens(tokens: Token[]): number {
  let position = 0;

  function peek(value?: string) {
    const token = tokens[position];
    if (!token) return false;
    if (value === undefined) return true;
    return token.type === "op" && token.value === value;
  }

  function consume(value?: string) {
    if (!peek(value)) return false;
    position += 1;
    return true;
  }

  function parseFactor(): number {
    if (consume("+")) return parseFactor();
    if (consume("-")) return -parseFactor();

    const token = tokens[position];
    if (token?.type === "number") {
      position += 1;
      return token.value;
    }

    if (consume("(")) {
      const value = parseExpression();
      if (!consume(")")) {
        throw new Error("Missing closing parenthesis");
      }
      return value;
    }

    throw new Error("Expected number or parenthesis");
  }

  function parseTerm(): number {
    let value = parseFactor();
    while (peek("*") || peek("/")) {
      const operator = tokens[position] as { type: "op"; value: string };
      position += 1;
      const next = parseFactor();
      if (operator.value === "*") value *= next;
      if (operator.value === "/") value /= next;
    }
    return value;
  }

  function parseExpression(): number {
    let value = parseTerm();
    while (peek("+") || peek("-")) {
      const operator = tokens[position] as { type: "op"; value: string };
      position += 1;
      const next = parseTerm();
      if (operator.value === "+") value += next;
      if (operator.value === "-") value -= next;
    }
    return value;
  }

  const result = parseExpression();
  if (position !== tokens.length) {
    throw new Error("Unexpected trailing token");
  }
  if (!Number.isFinite(result)) {
    throw new Error("Result is not finite");
  }
  return result;
}

export const calculatorTool: Tool<typeof calculatorInputSchema, { result: number }> = {
  name: "calculator",
  description: "Evaluate a small arithmetic expression with +, -, *, /, and parentheses.",
  schema: calculatorInputSchema,
  async run(input) {
    return { result: evaluateTokens(tokenize(input.expression)) };
  },
};
