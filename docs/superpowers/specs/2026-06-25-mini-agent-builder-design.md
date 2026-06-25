# mini-agent-builder Design

## Purpose

`mini-agent-builder` is an open-source visual Agent kernel builder. It helps a user configure a model, select kernel-level tools, write a system prompt, run a small Agent in the page, inspect the full trace, and generate a standalone Next.js Web Agent project.

The product is not an Agent template marketplace and does not ship business-role presets. The generated Agent is defined by the user's system prompt, selected tools, and future skill extensions.

## Goals

- Create a complete Web Agent project quickly.
- Teach the basic Agent parts: Model, Tool, Skill, Loop, Trace.
- Generate a project that runs independently from the Builder.
- Show the full trace for every Agent run.
- Keep the Agent core small enough for learners to read.

## Non-Goals For MVP

- Login, accounts, or cloud deployment.
- RAG, long-term memory, or multi-agent collaboration.
- Web search.
- Plugin marketplace.
- Complex permissions.
- Business presets such as planner, researcher, interview coach, or support agent.
- Built-in role-like skills.

## Confirmed Product Decisions

- Use a single Next.js Builder app for the MVP.
- Generate projects into `generated/<project-slug>/`.
- Do not persist API keys.
- Do not inject real API keys into generated projects.
- Include `calculator` and `current-time` tools only.
- Keep the Skill selector, but show an empty state: no skills installed yet.
- Preserve the Skill protocol as an extension point in the generated project.
- Use a three-column workbench layout.
- Use a simple JSON model-output protocol instead of SDK-specific tool calling.

## Builder UI

The primary screen is a three-column workbench.

### Left Panel: Agent Setup

- Project name and slug.
- Model configuration:
  - `baseUrl`
  - `model`
  - `apiKey`
- Tool selector:
  - `calculator`
  - `current-time`
- Skill selector:
  - empty state for MVP
  - extension point explanation only
- `Create Project` button.

### Center Panel: Prompt And Trial Run

- System Prompt editor.
- User task input.
- `Run Agent` button.
- Final answer preview.
- Project generation result path after creation.

### Right Panel: Trace Explorer

Displays each run step:

- model output
- selected tool
- tool input
- tool output
- final answer
- errors

The main user path is:

```text
Configure -> Run -> Inspect Trace -> Generate
```

## Builder Backend

The Builder has two core APIs.

### `POST /api/agent/run`

Runs the Agent inside the Builder for trial execution.

Request fields:

- `baseUrl`
- `apiKey`
- `model`
- `systemPrompt`
- `selectedTools`
- `selectedSkills`
- `userInput`

Behavior:

- Validate the request with Zod.
- Build a model provider from request-only model settings.
- Use the API key only for this request.
- Load selected tools from the registry.
- Load selected skills from the registry, which is empty for MVP.
- Run the Agent loop with a small `maxSteps`.
- Return the final answer and trace.

Response shape:

```ts
{
  answer: string;
  trace: TraceStep[];
}
```

### `POST /api/projects/create`

Generates a standalone project.

Request fields:

- `projectName`
- `projectSlug`
- `baseUrl`
- `model`
- `systemPrompt`
- `selectedTools`
- `selectedSkills`

Behavior:

- Validate project name and slug.
- Reject unsafe slugs and path traversal.
- Reject generation when the output directory already exists.
- Copy the Agent project template.
- Write `src/agent/config.ts`.
- Copy selected tool implementations.
- Keep `src/skills/` as an empty extension point.
- Generate `.env.example`.
- Generate `README.md`.
- Return the generated path and next commands.

API keys are never written to disk.

## Shared Builder Modules

The Builder uses shared definitions so trial runs and generated projects do not drift.

```text
apps/builder/src/
  agent/
    agent.ts
    model.ts
    tool.ts
    skill.ts
    trace.ts
  generator/
    create-project.ts
    copy-template.ts
    render-config.ts
  registry/
    tools.ts
    skills.ts
  schemas/
    agent-config.ts
```

## Agent Core

The Agent core is a readable loop:

```text
user input
-> append user message
-> call model
-> parse JSON output
-> if final: stop
-> if tool call: validate tool name
-> validate tool input
-> run tool
-> append observation
-> repeat
```

### Model Output Protocol

The model must return one of two JSON shapes.

Tool call:

```json
{
  "type": "tool",
  "toolName": "calculator",
  "toolInput": {
    "expression": "1 + 2"
  }
}
```

Final answer:

```json
{
  "type": "final",
  "answer": "The result is 3."
}
```

This keeps the MVP compatible with OpenAI-compatible chat completion providers without relying on provider-specific tool calling.

### Stop Conditions

- The model returns a final answer.
- `maxSteps` is reached.
- The model returns invalid JSON.
- The model requests an unknown tool.
- Tool input fails schema validation.
- Tool execution fails.
- Provider request fails.

## Trace

Trace exists for learning and debugging. Every important transition in the loop is recorded.

```ts
type TraceStep = {
  step: number;
  type: "model" | "tool" | "final" | "error";
  modelOutput?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  finalAnswer?: string;
  error?: string;
};
```

Errors are visible in the UI and included in the trace.

## Tools

MVP tools:

```text
calculator
current-time
```

No `web-search` tool is included in MVP.

### Calculator

Purpose:

- Demonstrate schema validation and deterministic tool execution.

Input:

```ts
{
  expression: string;
}
```

Output:

```ts
{
  result: number;
}
```

The implementation must avoid arbitrary JavaScript execution. It should support a small arithmetic expression grammar only.

### Current Time

Purpose:

- Demonstrate a tool with no user-controlled input and an external observation from runtime state.

Input:

```ts
{}
```

Output:

```ts
{
  iso: string;
  locale: string;
  timezone: string;
}
```

## Skills

Skills are a protocol and project extension point, not built-in business behavior.

MVP Builder behavior:

- Show the Skill selector.
- Display `No skills installed yet`.
- Do not include role-like skills.

Generated project behavior:

- Include `src/agent/skill.ts`.
- Include an empty `src/skills/` directory.
- Include README instructions for adding a skill.

## Template Generator

Template source:

```text
apps/builder/src/templates/agent-project/
```

Generated output:

```text
generated/<project-slug>/
```

The generated project includes:

```text
app/
  page.tsx
  api/agent/run/route.ts
src/
  agent/
    agent.ts
    model.ts
    tool.ts
    skill.ts
    trace.ts
    config.ts
  tools/
    calculator.ts
    current-time.ts
  skills/
package.json
.env.example
README.md
```

The generator writes:

- project name
- project slug
- base URL
- model
- system prompt
- selected tool IDs
- selected skill IDs, empty for MVP

The generator never writes:

- real API keys
- trial run messages
- trace history
- business Agent presets
- role-like skills

## Generated Project

The generated project is a complete Next.js app. It can be copied, committed, and run without the Builder.

Required commands:

```bash
npm install
npm run dev
```

The generated UI includes:

- a chat/task input
- final answer display
- trace display
- local API route at `/api/agent/run`

The generated API reads model credentials from environment variables.

## Error Handling

The Builder and generated project should surface clear errors for:

- missing API key
- invalid base URL
- provider request failure
- invalid JSON model output
- unknown tool
- invalid tool input
- tool execution failure
- max steps reached
- project slug validation failure
- output directory already exists
- file copy or write failure

Each Agent execution error should be represented in Trace.

## Testing Strategy

Core tests should cover:

- tool registry returns selected tools
- calculator validates input and executes supported arithmetic
- current-time returns a stable object shape
- Agent stops on final output
- Agent executes a tool call and records tool trace
- Agent returns error trace for invalid JSON
- Agent returns error trace for unknown tools
- generator creates required files
- generator omits real API keys
- project slug validation rejects unsafe paths

## MVP Acceptance Criteria

- Builder runs with `npm run dev`.
- Builder page can configure model, tools, system prompt, and user input.
- Builder trial run returns answer and trace.
- Builder trace shows model, tool, final, and error steps.
- `Create Project` generates `generated/<project-slug>/`.
- Generated project does not contain a real API key.
- Generated project can run independently with `npm install && npm run dev`.
- Generated project can execute the Agent and display trace.
- README explains Model, Tool, Skill, Loop, and Trace.

