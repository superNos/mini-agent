# mini-agent-builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the MVP of `mini-agent-builder`: a visual Agent kernel builder that can run an Agent with trace in the Builder and generate a standalone Next.js Agent project.

**Architecture:** Use one Next.js Builder workspace under `apps/builder`. Builder runtime code owns the Agent core, model provider, tool contracts, schemas, registries, API routes, UI, and generator. Generated projects are written to `generated/<project-slug>/` and contain copied Agent core files, selected tools, a generated config file, a standalone chat UI, and their own `/api/agent/run`.

**Tech Stack:** Next.js `16.2.9`, React `19.2.7`, TypeScript `6.0.3`, Tailwind CSS `4.3.1`, Zod `4.4.3`, Vitest `4.1.9`, lucide-react `1.21.0`.

---

## Scope Check

This plan implements one MVP surface: the Builder app plus the standalone generated project path. It intentionally excludes web search, Agent presets, role-like built-in skills, login, deployment, RAG, long-term memory, and multi-agent features.

## File Structure

Create this structure:

```text
package.json
tsconfig.base.json
apps/
  builder/
    package.json
    eslint.config.mjs
    next.config.ts
    postcss.config.mjs
    tsconfig.json
    vitest.config.ts
    app/
      globals.css
      layout.tsx
      page.tsx
      api/
        agent/
          run/
            route.ts
        projects/
          create/
            route.ts
    src/
      smoke.test.ts
      agent/
        agent.ts
        agent.test.ts
        model.ts
        trace.ts
        tool.ts
        skill.ts
      generator/
        create-project.ts
        create-project.test.ts
        paths.ts
        render-config.ts
        render-tools-index.ts
      registry/
        tools.ts
        skills.ts
      schemas/
        agent-config.ts
      tools/
        calculator.ts
        calculator.test.ts
        current-time.ts
        current-time.test.ts
      templates/
        agent-project/
          app/
            globals.css
            layout.tsx
            page.tsx
            api/
              agent/
                run/
                  route.ts
          package.json
          eslint.config.mjs
          next.config.ts
          postcss.config.mjs
          tsconfig.json
          README.md
          .env.example
```

Responsibilities:

- `apps/builder/src/agent/*`: readable Agent kernel and provider abstraction.
- `apps/builder/src/tools/*`: built-in deterministic tools.
- `apps/builder/src/registry/*`: Builder-side selectable tool and skill registries.
- `apps/builder/src/schemas/*`: shared Zod schemas for UI, APIs, and generator.
- `apps/builder/src/generator/*`: project creation, safe paths, config rendering, selected tool index rendering.
- `apps/builder/src/templates/agent-project/*`: standalone app shell copied by the generator.
- `apps/builder/app/*`: Builder UI and API routes.

---

### Task 1: Scaffold The Next.js Workspace

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `apps/builder/package.json`
- Create: `apps/builder/eslint.config.mjs`
- Create: `apps/builder/next.config.ts`
- Create: `apps/builder/postcss.config.mjs`
- Create: `apps/builder/tsconfig.json`
- Create: `apps/builder/vitest.config.ts`
- Create: `apps/builder/app/globals.css`
- Create: `apps/builder/app/layout.tsx`
- Create: `apps/builder/app/page.tsx`
- Create: `apps/builder/src/smoke.test.ts`

- [ ] **Step 1: Create root workspace files**

Write `package.json`:

```json
{
  "name": "mini-agent-builder",
  "private": true,
  "workspaces": [
    "apps/*"
  ],
  "scripts": {
    "dev": "npm --workspace apps/builder run dev",
    "build": "npm --workspace apps/builder run build",
    "lint": "npm --workspace apps/builder run lint",
    "test": "npm --workspace apps/builder run test",
    "typecheck": "npm --workspace apps/builder run typecheck"
  },
  "engines": {
    "node": ">=22.0.0"
  }
}
```

Write `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true
  }
}
```

- [ ] **Step 2: Create Builder package files**

Write `apps/builder/package.json`:

```json
{
  "name": "@mini-agent-builder/builder",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tailwindcss/postcss": "4.3.1",
    "lucide-react": "1.21.0",
    "next": "16.2.9",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "eslint": "10.5.0",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "4.3.1",
    "typescript": "6.0.3",
    "vitest": "4.1.9"
  }
}
```

Write `apps/builder/eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "generated/**", "next-env.d.ts"]),
]);
```

Write `apps/builder/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

Write `apps/builder/postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

Write `apps/builder/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@app/*": ["./app/*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

Write `apps/builder/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
```

- [ ] **Step 3: Create minimal Builder app shell**

Write `apps/builder/app/globals.css`:

```css
@import "tailwindcss";

:root {
  color-scheme: light;
  background: #f6f7f9;
  color: #111827;
}

body {
  margin: 0;
  background: #f6f7f9;
  font-family: Arial, Helvetica, sans-serif;
}
```

Write `apps/builder/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "mini-agent-builder",
  description: "A visual Agent kernel builder",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Write `apps/builder/app/page.tsx`:

```tsx
export default function BuilderPage() {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold text-gray-950">mini-agent-builder</h1>
      <p className="mt-2 text-sm text-gray-600">
        Configure an Agent kernel, run it, inspect trace, and generate a project.
      </p>
    </main>
  );
}
```

Write `apps/builder/src/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("workspace", () => {
  it("runs the initial test suite", () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 4: Install dependencies and verify scaffold**

Run:

```bash
npm install
npm run typecheck
npm run lint
npm run test
```

Expected:

```text
typecheck passes
lint passes
vitest smoke test passes
```

- [ ] **Step 5: Commit scaffold**

Run:

```bash
git add package.json package-lock.json tsconfig.base.json apps/builder
git commit -m "feat: scaffold builder workspace"
```

---

### Task 2: Add Agent Contracts, Schemas, And Built-In Tools

**Files:**
- Create: `apps/builder/src/agent/trace.ts`
- Create: `apps/builder/src/agent/tool.ts`
- Create: `apps/builder/src/agent/skill.ts`
- Create: `apps/builder/src/schemas/agent-config.ts`
- Create: `apps/builder/src/tools/calculator.ts`
- Create: `apps/builder/src/tools/calculator.test.ts`
- Create: `apps/builder/src/tools/current-time.ts`
- Create: `apps/builder/src/tools/current-time.test.ts`
- Create: `apps/builder/src/registry/tools.ts`
- Create: `apps/builder/src/registry/skills.ts`

- [ ] **Step 1: Write contract files**

Write `apps/builder/src/agent/trace.ts`:

```ts
export type TraceStepType = "model" | "tool" | "final" | "error";

export type TraceStep = {
  step: number;
  type: TraceStepType;
  modelOutput?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  finalAnswer?: string;
  error?: string;
};
```

Write `apps/builder/src/agent/tool.ts`:

```ts
import type { z } from "zod";

export type Tool<TInput extends z.ZodType = z.ZodType, TOutput = unknown> = {
  name: string;
  description: string;
  schema: TInput;
  run(input: z.infer<TInput>): Promise<TOutput>;
};

export type AnyTool = Tool<z.ZodType, unknown>;
```

Write `apps/builder/src/agent/skill.ts`:

```ts
export type Skill = {
  name: string;
  description: string;
  systemPromptAddon: string;
  toolNames?: string[];
};
```

- [ ] **Step 2: Write shared schemas**

Write `apps/builder/src/schemas/agent-config.ts`:

```ts
import { z } from "zod";

export const toolIdSchema = z.enum(["calculator", "current-time"]);

export const projectSlugSchema = z
  .string()
  .min(1, "Project slug is required")
  .max(64, "Project slug must be 64 characters or less")
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lowercase letters, numbers, and hyphens")
  .refine((value) => !value.includes(".."), "Path traversal is not allowed");

export const modelConfigSchema = z.object({
  baseUrl: z.string().url(),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
});

export const builderRunRequestSchema = z.object({
  baseUrl: z.string().url(),
  apiKey: z.string().min(1),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  selectedTools: z.array(toolIdSchema),
  selectedSkills: z.array(z.string()).default([]),
  userInput: z.string().min(1),
});

export const createProjectRequestSchema = z.object({
  projectName: z.string().min(1),
  projectSlug: projectSlugSchema,
  baseUrl: z.string().url(),
  model: z.string().min(1),
  systemPrompt: z.string().min(1),
  selectedTools: z.array(toolIdSchema),
  selectedSkills: z.array(z.string()).default([]),
});

export type ToolId = z.infer<typeof toolIdSchema>;
export type BuilderRunRequest = z.infer<typeof builderRunRequestSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
```

- [ ] **Step 3: Write failing tests for tools**

Write `apps/builder/src/tools/calculator.test.ts`:

```ts
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
});
```

Write `apps/builder/src/tools/current-time.test.ts`:

```ts
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
```

Run:

```bash
npm run test
```

Expected:

```text
FAIL because calculator.ts and current-time.ts do not exist
```

- [ ] **Step 4: Implement tools**

Write `apps/builder/src/tools/calculator.ts`:

```ts
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
```

Write `apps/builder/src/tools/current-time.ts`:

```ts
import { z } from "zod";
import type { Tool } from "@/agent/tool";

const currentTimeInputSchema = z.object({});

export const currentTimeTool: Tool<
  typeof currentTimeInputSchema,
  { iso: string; locale: string; timezone: string }
> = {
  name: "current-time",
  description: "Return the current runtime time as an ISO timestamp.",
  schema: currentTimeInputSchema,
  async run() {
    return {
      iso: new Date().toISOString(),
      locale: "en-US",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
  },
};
```

- [ ] **Step 5: Add registries**

Write `apps/builder/src/registry/tools.ts`:

```ts
import type { AnyTool } from "@/agent/tool";
import type { ToolId } from "@/schemas/agent-config";
import { calculatorTool } from "@/tools/calculator";
import { currentTimeTool } from "@/tools/current-time";

export const toolRegistry: Record<ToolId, AnyTool> = {
  calculator: calculatorTool,
  "current-time": currentTimeTool,
};

export function getToolsByIds(ids: ToolId[]) {
  return ids.map((id) => toolRegistry[id]);
}
```

Write `apps/builder/src/registry/skills.ts`:

```ts
import type { Skill } from "@/agent/skill";

export const skillRegistry: Record<string, Skill> = {};

export function getSkillsByIds(ids: string[]) {
  return ids.map((id) => skillRegistry[id]).filter((skill): skill is Skill => Boolean(skill));
}
```

- [ ] **Step 6: Run tests and commit**

Run:

```bash
npm run test
npm run typecheck
```

Expected:

```text
calculator tests pass
current-time tests pass
typecheck passes
```

Run:

```bash
git add apps/builder/src/agent apps/builder/src/schemas apps/builder/src/tools apps/builder/src/registry
git commit -m "feat: add agent contracts and tools"
```

---

### Task 3: Implement The Model Provider And Agent Loop

**Files:**
- Create: `apps/builder/src/agent/model.ts`
- Create: `apps/builder/src/agent/agent.ts`
- Create: `apps/builder/src/agent/agent.test.ts`

- [ ] **Step 1: Write failing Agent loop tests**

Write `apps/builder/src/agent/agent.test.ts`:

```ts
import { z } from "zod";
import { describe, expect, it } from "vitest";
import type { ModelProvider } from "./model";
import type { Tool } from "./tool";
import { runAgent } from "./agent";

function fakeModel(outputs: string[]): ModelProvider {
  let index = 0;
  return {
    async complete() {
      const output = outputs[index];
      index += 1;
      if (!output) throw new Error("No fake output configured");
      return output;
    },
  };
}

const echoTool: Tool<z.ZodObject<{ text: z.ZodString }>, { echoed: string }> = {
  name: "echo",
  description: "Echo text",
  schema: z.object({ text: z.string() }),
  async run(input) {
    return { echoed: input.text };
  },
};

describe("runAgent", () => {
  it("stops when the model returns final", async () => {
    const result = await runAgent({
      model: fakeModel([JSON.stringify({ type: "final", answer: "done" })]),
      tools: [],
      systemPrompt: "Return JSON.",
      userInput: "hello",
      maxSteps: 3,
    });

    expect(result.answer).toBe("done");
    expect(result.trace).toEqual([
      expect.objectContaining({ step: 1, type: "model" }),
      expect.objectContaining({ step: 1, type: "final", finalAnswer: "done" }),
    ]);
  });

  it("runs a tool and records trace", async () => {
    const result = await runAgent({
      model: fakeModel([
        JSON.stringify({ type: "tool", toolName: "echo", toolInput: { text: "abc" } }),
        JSON.stringify({ type: "final", answer: "abc" }),
      ]),
      tools: [echoTool],
      systemPrompt: "Return JSON.",
      userInput: "echo abc",
      maxSteps: 3,
    });

    expect(result.answer).toBe("abc");
    expect(result.trace).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "tool", toolName: "echo", toolOutput: { echoed: "abc" } }),
        expect.objectContaining({ type: "final", finalAnswer: "abc" }),
      ]),
    );
  });

  it("returns error trace for invalid JSON", async () => {
    const result = await runAgent({
      model: fakeModel(["not json"]),
      tools: [],
      systemPrompt: "Return JSON.",
      userInput: "hello",
      maxSteps: 3,
    });

    expect(result.answer).toBe("");
    expect(result.trace.at(-1)).toEqual(expect.objectContaining({ type: "error" }));
  });

  it("returns error trace for unknown tools", async () => {
    const result = await runAgent({
      model: fakeModel([JSON.stringify({ type: "tool", toolName: "missing", toolInput: {} })]),
      tools: [echoTool],
      systemPrompt: "Return JSON.",
      userInput: "use missing",
      maxSteps: 3,
    });

    expect(result.trace.at(-1)).toEqual(
      expect.objectContaining({ type: "error", error: "Unknown tool: missing" }),
    );
  });
});
```

Run:

```bash
npm run test -- agent.test.ts
```

Expected:

```text
FAIL because model.ts and agent.ts do not exist
```

- [ ] **Step 2: Implement model provider**

Write `apps/builder/src/agent/model.ts`:

```ts
export type AgentMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type ModelProvider = {
  complete(messages: AgentMessage[]): Promise<string>;
};

export type OpenAICompatibleModelOptions = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export class OpenAICompatibleModelProvider implements ModelProvider {
  constructor(private readonly options: OpenAICompatibleModelOptions) {}

  async complete(messages: AgentMessage[]) {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        model: this.options.model,
        messages,
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Provider request failed: ${response.status} ${body.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Provider response did not include message content");
    }

    return content;
  }
}
```

- [ ] **Step 3: Implement Agent loop**

Write `apps/builder/src/agent/agent.ts`:

```ts
import type { TraceStep } from "./trace";
import type { AgentMessage, ModelProvider } from "./model";
import type { AnyTool } from "./tool";

type AgentDecision =
  | { type: "tool"; toolName: string; toolInput: unknown }
  | { type: "final"; answer: string };

export type RunAgentInput = {
  model: ModelProvider;
  tools: AnyTool[];
  systemPrompt: string;
  userInput: string;
  maxSteps?: number;
};

export type RunAgentResult = {
  answer: string;
  trace: TraceStep[];
};

function describeTools(tools: AnyTool[]) {
  if (tools.length === 0) return "No tools are available.";

  return tools
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join("\n");
}

function buildSystemPrompt(systemPrompt: string, tools: AnyTool[]) {
  return `${systemPrompt}

You are running inside a small educational Agent loop.
Return only valid JSON.

Use one of these shapes:
{"type":"tool","toolName":"calculator","toolInput":{"expression":"1 + 2"}}
{"type":"final","answer":"your final answer"}

Available tools:
${describeTools(tools)}`;
}

function parseDecision(output: string): AgentDecision {
  const parsed = JSON.parse(output) as Partial<AgentDecision>;

  if (parsed.type === "final" && typeof parsed.answer === "string") {
    return { type: "final", answer: parsed.answer };
  }

  if (parsed.type === "tool" && typeof parsed.toolName === "string") {
    return {
      type: "tool",
      toolName: parsed.toolName,
      toolInput: parsed.toolInput ?? {},
    };
  }

  throw new Error("Model output did not match the Agent JSON protocol");
}

export async function runAgent(input: RunAgentInput): Promise<RunAgentResult> {
  const maxSteps = input.maxSteps ?? 6;
  const trace: TraceStep[] = [];
  const messages: AgentMessage[] = [
    { role: "system", content: buildSystemPrompt(input.systemPrompt, input.tools) },
    { role: "user", content: input.userInput },
  ];

  for (let step = 1; step <= maxSteps; step += 1) {
    let modelOutput = "";

    try {
      modelOutput = await input.model.complete(messages);
      trace.push({ step, type: "model", modelOutput });
    } catch (error) {
      trace.push({ step, type: "error", error: error instanceof Error ? error.message : String(error) });
      return { answer: "", trace };
    }

    let decision: AgentDecision;
    try {
      decision = parseDecision(modelOutput);
    } catch (error) {
      trace.push({ step, type: "error", modelOutput, error: error instanceof Error ? error.message : String(error) });
      return { answer: "", trace };
    }

    if (decision.type === "final") {
      trace.push({ step, type: "final", finalAnswer: decision.answer });
      return { answer: decision.answer, trace };
    }

    const tool = input.tools.find((candidate) => candidate.name === decision.toolName);
    if (!tool) {
      trace.push({ step, type: "error", toolName: decision.toolName, error: `Unknown tool: ${decision.toolName}` });
      return { answer: "", trace };
    }

    const parsedInput = tool.schema.safeParse(decision.toolInput);
    if (!parsedInput.success) {
      trace.push({
        step,
        type: "error",
        toolName: tool.name,
        toolInput: decision.toolInput,
        error: parsedInput.error.message,
      });
      return { answer: "", trace };
    }

    try {
      const toolOutput = await tool.run(parsedInput.data);
      trace.push({ step, type: "tool", toolName: tool.name, toolInput: parsedInput.data, toolOutput });
      messages.push({ role: "assistant", content: modelOutput });
      messages.push({ role: "tool", content: JSON.stringify({ toolName: tool.name, toolOutput }) });
    } catch (error) {
      trace.push({
        step,
        type: "error",
        toolName: tool.name,
        toolInput: parsedInput.data,
        error: error instanceof Error ? error.message : String(error),
      });
      return { answer: "", trace };
    }
  }

  trace.push({ step: maxSteps, type: "error", error: `Max steps reached: ${maxSteps}` });
  return { answer: "", trace };
}
```

- [ ] **Step 4: Run tests and commit**

Run:

```bash
npm run test
npm run typecheck
```

Expected:

```text
Agent loop tests pass
tool tests still pass
typecheck passes
```

Run:

```bash
git add apps/builder/src/agent
git commit -m "feat: add readable agent loop"
```

---

### Task 4: Add Builder Trial Run API

**Files:**
- Create: `apps/builder/app/api/agent/run/route.ts`
- Modify: `apps/builder/src/registry/tools.ts`

- [ ] **Step 1: Harden tool registry for API usage**

Modify `apps/builder/src/registry/tools.ts` so it exposes metadata and selected tools:

```ts
import type { AnyTool } from "@/agent/tool";
import type { ToolId } from "@/schemas/agent-config";
import { calculatorTool } from "@/tools/calculator";
import { currentTimeTool } from "@/tools/current-time";

export type ToolMetadata = {
  id: ToolId;
  name: string;
  description: string;
};

export const toolRegistry: Record<ToolId, AnyTool> = {
  calculator: calculatorTool,
  "current-time": currentTimeTool,
};

export const toolMetadata: ToolMetadata[] = [
  {
    id: "calculator",
    name: "Calculator",
    description: calculatorTool.description,
  },
  {
    id: "current-time",
    name: "Current Time",
    description: currentTimeTool.description,
  },
];

export function getToolsByIds(ids: ToolId[]) {
  return ids.map((id) => toolRegistry[id]);
}
```

- [ ] **Step 2: Add run API route**

Write `apps/builder/app/api/agent/run/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runAgent } from "@/agent/agent";
import { OpenAICompatibleModelProvider } from "@/agent/model";
import { getToolsByIds } from "@/registry/tools";
import { builderRunRequestSchema } from "@/schemas/agent-config";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = builderRunRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const model = new OpenAICompatibleModelProvider({
    baseUrl: parsed.data.baseUrl,
    apiKey: parsed.data.apiKey,
    model: parsed.data.model,
  });

  const result = await runAgent({
    model,
    tools: getToolsByIds(parsed.data.selectedTools),
    systemPrompt: parsed.data.systemPrompt,
    userInput: parsed.data.userInput,
    maxSteps: 6,
  });

  return NextResponse.json(result);
}
```

- [ ] **Step 3: Verify route type safety**

Run:

```bash
npm run typecheck
npm run build
```

Expected:

```text
typecheck passes
Next build passes
```

- [ ] **Step 4: Commit trial API**

Run:

```bash
git add apps/builder/app/api/agent/run/route.ts apps/builder/src/registry/tools.ts
git commit -m "feat: add builder trial run api"
```

---

### Task 5: Implement Project Generator

**Files:**
- Create: `apps/builder/src/generator/paths.ts`
- Create: `apps/builder/src/generator/render-config.ts`
- Create: `apps/builder/src/generator/render-tools-index.ts`
- Create: `apps/builder/src/generator/create-project.ts`
- Create: `apps/builder/src/generator/create-project.test.ts`

- [ ] **Step 1: Write generator tests**

Write `apps/builder/src/generator/create-project.test.ts`:

```ts
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createProject } from "./create-project";
import { validateProjectOutputPath } from "./paths";

describe("validateProjectOutputPath", () => {
  it("rejects path traversal", () => {
    expect(() => validateProjectOutputPath("/repo", "../bad")).toThrow("Invalid project slug");
  });
});

describe("createProject", () => {
  it("creates a project and omits api keys", async () => {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "mini-agent-builder-"));
    const builderRoot = path.join(workspaceRoot, "apps", "builder");
    const templateRoot = path.join(builderRoot, "src", "templates", "agent-project");

    await mkdir(path.join(templateRoot, "app"), { recursive: true });
    await writeFile(path.join(templateRoot, "package.json"), "{\"name\":\"template\"}");
    await writeFile(path.join(templateRoot, "app", "page.tsx"), "export default function Page(){return null}");
    await mkdir(path.join(builderRoot, "src", "agent"), { recursive: true });
    await mkdir(path.join(builderRoot, "src", "tools"), { recursive: true });
    await writeFile(path.join(builderRoot, "src", "agent", "agent.ts"), "export const agent = true;");
    await writeFile(path.join(builderRoot, "src", "tools", "calculator.ts"), "export const calculatorTool = {};");

    try {
      const result = await createProject({
        workspaceRoot,
        builderRoot,
        request: {
          projectName: "My Agent",
          projectSlug: "my-agent",
          baseUrl: "https://api.example.com/v1",
          model: "test-model",
          systemPrompt: "Return JSON.",
          selectedTools: ["calculator"],
          selectedSkills: [],
        },
      });

      await expect(stat(path.join(result.projectPath, "package.json"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "agent", "agent.ts"))).resolves.toBeTruthy();
      await expect(stat(path.join(result.projectPath, "src", "tools", "calculator.ts"))).resolves.toBeTruthy();
      const config = await readFile(path.join(result.projectPath, "src", "agent", "config.ts"), "utf8");
      expect(config).toContain("My Agent");
      expect(config).not.toContain("apiKey");
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
```

Run:

```bash
npm run test -- create-project.test.ts
```

Expected:

```text
FAIL because generator files do not exist
```

- [ ] **Step 2: Implement path helpers**

Write `apps/builder/src/generator/paths.ts`:

```ts
import path from "node:path";
import { projectSlugSchema } from "@/schemas/agent-config";

export function getWorkspaceRoot(cwd = process.cwd()) {
  const normalized = path.normalize(cwd);
  if (path.basename(normalized) === "builder" && path.basename(path.dirname(normalized)) === "apps") {
    return path.resolve(normalized, "../..");
  }
  return normalized;
}

export function getBuilderRoot(cwd = process.cwd()) {
  const normalized = path.normalize(cwd);
  if (path.basename(normalized) === "builder") {
    return normalized;
  }
  return path.join(getWorkspaceRoot(normalized), "apps", "builder");
}

export function validateProjectOutputPath(workspaceRoot: string, projectSlug: string) {
  const parsed = projectSlugSchema.safeParse(projectSlug);
  if (!parsed.success) {
    throw new Error("Invalid project slug");
  }

  const generatedRoot = path.resolve(workspaceRoot, "generated");
  const projectPath = path.resolve(generatedRoot, parsed.data);

  if (!projectPath.startsWith(generatedRoot + path.sep)) {
    throw new Error("Invalid project path");
  }

  return { generatedRoot, projectPath };
}
```

- [ ] **Step 3: Implement render helpers**

Write `apps/builder/src/generator/render-config.ts`:

```ts
import type { CreateProjectRequest } from "@/schemas/agent-config";

export function renderAgentConfig(request: CreateProjectRequest) {
  return `export const AGENT_CONFIG = ${JSON.stringify(
    {
      projectName: request.projectName,
      projectSlug: request.projectSlug,
      baseUrl: request.baseUrl,
      model: request.model,
      systemPrompt: request.systemPrompt,
      selectedToolIds: request.selectedTools,
      selectedSkillIds: request.selectedSkills,
    },
    null,
    2,
  )} as const;

export type AgentConfig = typeof AGENT_CONFIG;
`;
}
```

Write `apps/builder/src/generator/render-tools-index.ts`:

```ts
import type { ToolId } from "@/schemas/agent-config";

const exportNames: Record<ToolId, string> = {
  calculator: "calculatorTool",
  "current-time": "currentTimeTool",
};

export function renderToolsIndex(selectedTools: ToolId[]) {
  const imports = selectedTools
    .map((toolId) => `import { ${exportNames[toolId]} } from "./${toolId}";`)
    .join("\n");
  const entries = selectedTools
    .map((toolId) => `  "${toolId}": ${exportNames[toolId]},`)
    .join("\n");

  return `${imports}
import type { AnyTool } from "../agent/tool";

const tools: Record<string, AnyTool> = {
${entries}
};

export function getSelectedTools(ids: readonly string[]) {
  return ids.map((id) => tools[id]).filter((tool): tool is AnyTool => Boolean(tool));
}
`;
}
```

- [ ] **Step 4: Implement createProject**

Write `apps/builder/src/generator/create-project.ts`:

```ts
import { cp, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CreateProjectRequest, ToolId } from "@/schemas/agent-config";
import { createProjectRequestSchema } from "@/schemas/agent-config";
import { renderAgentConfig } from "./render-config";
import { renderToolsIndex } from "./render-tools-index";
import { getBuilderRoot, getWorkspaceRoot, validateProjectOutputPath } from "./paths";

type CreateProjectInput = {
  request: CreateProjectRequest;
  workspaceRoot?: string;
  builderRoot?: string;
};

export type CreateProjectResult = {
  projectPath: string;
  relativeProjectPath: string;
  nextCommands: string[];
};

async function assertMissing(pathToCheck: string) {
  try {
    await stat(pathToCheck);
  } catch {
    return;
  }
  throw new Error("Output directory already exists");
}

async function copySelectedTools(builderRoot: string, projectPath: string, selectedTools: ToolId[]) {
  const targetToolsDir = path.join(projectPath, "src", "tools");
  await mkdir(targetToolsDir, { recursive: true });

  for (const toolId of selectedTools) {
    await cp(
      path.join(builderRoot, "src", "tools", `${toolId}.ts`),
      path.join(targetToolsDir, `${toolId}.ts`),
    );
  }

  await writeFile(path.join(targetToolsDir, "index.ts"), renderToolsIndex(selectedTools));
}

async function copyAgentCore(builderRoot: string, projectPath: string) {
  const sourceDir = path.join(builderRoot, "src", "agent");
  const targetDir = path.join(projectPath, "src", "agent");
  await mkdir(targetDir, { recursive: true });

  const entries = await readdir(sourceDir);
  for (const entry of entries) {
    if (entry.endsWith(".test.ts")) continue;
    await cp(path.join(sourceDir, entry), path.join(targetDir, entry));
  }
}

export async function createProject(input: CreateProjectInput): Promise<CreateProjectResult> {
  const parsed = createProjectRequestSchema.parse(input.request);
  const workspaceRoot = input.workspaceRoot ?? getWorkspaceRoot();
  const builderRoot = input.builderRoot ?? getBuilderRoot();
  const { generatedRoot, projectPath } = validateProjectOutputPath(workspaceRoot, parsed.projectSlug);
  const templateRoot = path.join(builderRoot, "src", "templates", "agent-project");

  await assertMissing(projectPath);
  await mkdir(generatedRoot, { recursive: true });
  await cp(templateRoot, projectPath, { recursive: true });
  await copyAgentCore(builderRoot, projectPath);
  await copySelectedTools(builderRoot, projectPath, parsed.selectedTools);
  await mkdir(path.join(projectPath, "src", "skills"), { recursive: true });
  await writeFile(path.join(projectPath, "src", "agent", "config.ts"), renderAgentConfig(parsed));

  return {
    projectPath,
    relativeProjectPath: path.relative(workspaceRoot, projectPath),
    nextCommands: [
      `cd ${path.relative(workspaceRoot, projectPath)}`,
      "npm install",
      "npm run dev",
    ],
  };
}
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm run test -- create-project.test.ts
npm run typecheck
```

Expected:

```text
generator tests pass
typecheck passes
```

Run:

```bash
git add apps/builder/src/generator
git commit -m "feat: add project generator"
```

---

### Task 6: Add Generated Project Template And Create API

**Files:**
- Create: `apps/builder/src/templates/agent-project/package.json`
- Create: `apps/builder/src/templates/agent-project/eslint.config.mjs`
- Create: `apps/builder/src/templates/agent-project/next.config.ts`
- Create: `apps/builder/src/templates/agent-project/postcss.config.mjs`
- Create: `apps/builder/src/templates/agent-project/tsconfig.json`
- Create: `apps/builder/src/templates/agent-project/.env.example`
- Create: `apps/builder/src/templates/agent-project/README.md`
- Create: `apps/builder/src/templates/agent-project/app/globals.css`
- Create: `apps/builder/src/templates/agent-project/app/layout.tsx`
- Create: `apps/builder/src/templates/agent-project/app/page.tsx`
- Create: `apps/builder/src/templates/agent-project/app/api/agent/run/route.ts`
- Create: `apps/builder/app/api/projects/create/route.ts`

- [ ] **Step 1: Add generated project package files**

Write template `package.json`:

```json
{
  "name": "generated-mini-agent",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tailwindcss/postcss": "4.3.1",
    "next": "16.2.9",
    "react": "19.2.7",
    "react-dom": "19.2.7",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "eslint": "10.5.0",
    "eslint-config-next": "16.2.9",
    "tailwindcss": "4.3.1",
    "typescript": "6.0.3"
  }
}
```

Write template `eslint.config.mjs`:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
```

Write template `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

Write template `postcss.config.mjs`:

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

Write template `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 2: Add generated project env and README**

Write `.env.example`:

```text
OPENAI_API_KEY=
```

Write `README.md`:

```md
# Generated Mini Agent

This project was generated by `mini-agent-builder`.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `OPENAI_API_KEY` in `.env.local` before running the Agent.

## Concepts

- Model: the OpenAI-compatible chat completion provider.
- Tool: a typed function the Agent can call.
- Skill: an extension point for reusable prompt/tool bundles.
- Loop: model output, optional tool call, observation, repeat.
- Trace: the visible record of every step.

## Add A Skill

Create a file in `src/skills/`, export a `Skill`, and include its prompt addon in your Agent configuration.
```

- [ ] **Step 3: Add generated project UI and route**

Write generated `app/api/agent/run/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runAgent } from "@/agent/agent";
import { OpenAICompatibleModelProvider } from "@/agent/model";
import { AGENT_CONFIG } from "@/agent/config";
import { getSelectedTools } from "@/tools";

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { input?: string } | null;
  if (!body?.input) {
    return NextResponse.json({ error: "Missing input" }, { status: 400 });
  }

  const result = await runAgent({
    model: new OpenAICompatibleModelProvider({
      baseUrl: AGENT_CONFIG.baseUrl,
      apiKey,
      model: AGENT_CONFIG.model,
    }),
    tools: getSelectedTools(AGENT_CONFIG.selectedToolIds),
    systemPrompt: AGENT_CONFIG.systemPrompt,
    userInput: body.input,
    maxSteps: 6,
  });

  return NextResponse.json(result);
}
```

Write generated `app/page.tsx` as a client component with these states:

```tsx
"use client";

import { useState } from "react";
import type { TraceStep } from "@/agent/trace";
import { AGENT_CONFIG } from "@/agent/config";

type RunResult = { answer: string; trace: TraceStep[] };

export default function GeneratedAgentPage() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function run() {
    setIsRunning(true);
    setError("");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Run failed");
      setResult(data);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : String(runError));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6 text-gray-950">
      <section className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_420px]">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h1 className="text-xl font-semibold">{AGENT_CONFIG.projectName}</h1>
          <textarea
            className="mt-4 min-h-36 w-full rounded-md border border-gray-300 p-3 text-sm"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label="Agent input"
          />
          <button
            className="mt-3 rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isRunning || !input.trim()}
            onClick={run}
          >
            {isRunning ? "Running" : "Run Agent"}
          </button>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          {result ? <p className="mt-4 whitespace-pre-wrap text-sm">{result.answer}</p> : null}
        </div>
        <aside className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Trace</h2>
          <div className="mt-3 space-y-3">
            {(result?.trace ?? []).map((step, index) => (
              <pre key={index} className="overflow-auto rounded-md bg-gray-100 p-3 text-xs">
                {JSON.stringify(step, null, 2)}
              </pre>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Add Builder create API route**

Write `apps/builder/app/api/projects/create/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createProject } from "@/generator/create-project";
import { createProjectRequestSchema } from "@/schemas/agent-config";

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = createProjectRequestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await createProject({ request: parsed.data });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    );
  }
}
```

- [ ] **Step 5: Verify template generation and commit**

Run:

```bash
npm run test
npm run typecheck
npm run build
```

Expected:

```text
tests pass
typecheck passes
Next build passes
```

Run:

```bash
git add apps/builder/src/templates apps/builder/app/api/projects/create
git commit -m "feat: add generated project template"
```

---

### Task 7: Build The Three-Column Builder UI

**Files:**
- Modify: `apps/builder/app/page.tsx`

- [ ] **Step 1: Replace the shell page with a client workbench**

Use one page component for MVP. Keep state local and do not persist API keys. The page must include:

```ts
type BuilderState = {
  projectName: string;
  projectSlug: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  selectedTools: Array<"calculator" | "current-time">;
  selectedSkills: string[];
  userInput: string;
};
```

Default state:

```ts
const DEFAULT_STATE: BuilderState = {
  projectName: "My Agent",
  projectSlug: "my-agent",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  systemPrompt: "You are a small Agent. Return only JSON that matches the protocol.",
  selectedTools: ["calculator", "current-time"],
  selectedSkills: [],
  userInput: "What is 12 * (3 + 4)?",
};
```

- [ ] **Step 2: Implement run and create handlers**

Inside `apps/builder/app/page.tsx`, add:

```ts
async function runAgent() {
  setIsRunning(true);
  setRunError("");
  try {
    const response = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(state),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Run failed");
    setRunResult(data);
  } catch (error) {
    setRunError(error instanceof Error ? error.message : String(error));
  } finally {
    setIsRunning(false);
  }
}

async function createProject() {
  setIsCreating(true);
  setCreateError("");
  try {
    const { apiKey: _apiKey, userInput: _userInput, ...projectConfig } = state;
    const response = await fetch("/api/projects/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(projectConfig),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Create failed");
    setCreateResult(data);
  } catch (error) {
    setCreateError(error instanceof Error ? error.message : String(error));
  } finally {
    setIsCreating(false);
  }
}
```

- [ ] **Step 3: Implement the three panels**

Left panel requirements:

```text
Project name input
Project slug input
Base URL input
Model input
API key password input
Tool checkboxes for calculator and current-time
Skill empty state: "No skills installed yet"
Create Project button with FolderPlus icon
```

Center panel requirements:

```text
System Prompt textarea
User Input textarea
Run Agent button with Play icon
Answer panel
Generation result panel with relativeProjectPath and nextCommands
```

Right panel requirements:

```text
Trace heading
Empty state before first run
One stable card per TraceStep
Error steps styled in red
Tool steps styled in blue or neutral
JSON details in pre blocks
```

Use `lucide-react` icons:

```ts
import { FolderPlus, Play, Wrench, Clock3, BrainCircuit } from "lucide-react";
```

- [ ] **Step 4: Verify UI behavior**

Run:

```bash
npm run typecheck
npm run build
npm run dev
```

Open:

```text
http://localhost:3000
```

Manual checks:

```text
Page shows three columns on desktop
Skill selector shows "No skills installed yet"
API key input is type password
Create Project request omits apiKey and userInput
Run Agent request includes apiKey and userInput
Trace empty state appears before first run
Buttons have disabled states while requests are running
```

- [ ] **Step 5: Commit Builder UI**

Run:

```bash
git add apps/builder/app/page.tsx
git commit -m "feat: build agent builder workbench"
```

---

### Task 8: Final Verification, Generated Project Smoke Test, And Docs

**Files:**
- Modify: `README.md`
- Modify: `apps/builder/src/templates/agent-project/README.md`

- [ ] **Step 1: Add root README**

Write `README.md`:

```md
# mini-agent-builder

`mini-agent-builder` is a visual Agent kernel builder. It lets you configure a model, select tools, write a system prompt, run a small Agent, inspect trace, and generate a standalone Next.js Agent project.

## MVP Scope

Included:

- OpenAI-compatible model configuration
- System Prompt editor
- `calculator` and `current-time` tools
- Empty Skill extension point
- Agent trial run
- Trace viewer
- Project generation into `generated/<project-slug>/`

Not included:

- web search
- Agent presets
- built-in role-like skills
- RAG
- long-term memory
- login
- cloud deployment

## Run Builder

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Generate A Project

Use the Builder UI and click `Create Project`. The generated project is written to `generated/<project-slug>/`.

## Agent Concepts

- Model: OpenAI-compatible chat completion provider.
- Tool: typed function the Agent can call.
- Skill: extension point for reusable prompt/tool bundles.
- Loop: model output, optional tool call, observation, repeat.
- Trace: visible record of every step.
```

- [ ] **Step 2: Run full local checks**

Run:

```bash
npm run test
npm run typecheck
npm run lint
npm run build
```

Expected:

```text
tests pass
typecheck passes
lint passes
Next build passes
```

- [ ] **Step 3: Generate a smoke project**

Start the Builder:

```bash
npm run dev
```

Use the UI to create:

```text
projectName: Smoke Agent
projectSlug: smoke-agent
baseUrl: https://api.openai.com/v1
model: gpt-4.1-mini
systemPrompt: You are a small Agent. Return only JSON that matches the protocol.
selectedTools: calculator, current-time
selectedSkills: none
```

Expected generated path:

```text
generated/smoke-agent
```

- [ ] **Step 4: Verify generated project**

Run:

```bash
cd generated/smoke-agent
npm install
npm run typecheck
npm run build
```

Expected:

```text
generated project typecheck passes
generated project build passes
```

Check secret policy:

```bash
rg "apiKey|OPENAI_API_KEY=.+\\S" generated/smoke-agent
```

Expected:

```text
No real API key appears in generated files
.env.example may contain OPENAI_API_KEY=
```

- [ ] **Step 5: Verify generated Agent run path**

Without `.env.local`, submit a run in the generated project UI.

Expected:

```text
The API returns "Missing OPENAI_API_KEY"
The UI displays the error
```

With a real OpenAI-compatible API key available, create `.env.local`:

```text
OPENAI_API_KEY=<developer-provided-key>
```

Run:

```bash
npm run dev
```

Manual check:

```text
The generated app accepts user input
The Agent returns an answer
Trace shows model and final steps
For calculator prompts, Trace shows tool step when the model chooses calculator
```

- [ ] **Step 6: Commit docs and verification fixes**

Run:

```bash
git add README.md apps/builder/src/templates/agent-project/README.md
git commit -m "docs: add mini agent builder usage"
```

---

## Plan Self-Review

Spec coverage:

- Builder page: Task 7.
- OpenAI-compatible model config: Tasks 3, 4, 7.
- Tool selection: Tasks 2, 4, 7.
- Skill empty extension point: Tasks 2, 6, 7, 8.
- System Prompt config: Tasks 3, 4, 7.
- Trial run: Tasks 3, 4, 7.
- Trace display: Tasks 3, 7.
- One-click project generation: Tasks 5, 6, 7.
- Standalone generated project: Tasks 5, 6, 8.
- API key not persisted: Tasks 5, 6, 7, 8.
- No web-search and no presets: Tasks 2, 7, 8.

Type consistency:

- `selectedTools` uses `ToolId[]` in schemas, registry, generator, and UI.
- Trace uses the same `TraceStep` shape in Builder and generated project.
- Model provider only requires `baseUrl`, `apiKey`, and `model`.
- Generated `AGENT_CONFIG` uses `selectedToolIds`, which matches `getSelectedTools`.

Execution order:

- The project scaffold comes first.
- Core contracts and tools come before Agent loop.
- Agent loop comes before API routes.
- Generator comes before template API.
- UI comes after APIs are available.
- Final verification happens after generated project support exists.
