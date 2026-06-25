"use client";

import { useState } from "react";
import type { TraceStep } from "@/agent/trace";
import { BrainCircuit, Clock3, FolderPlus, Play, Wrench } from "lucide-react";

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

type ToolId = BuilderState["selectedTools"][number];

type RunResult = {
  answer?: string;
  trace?: TraceStep[];
};

type CreateResult = {
  projectPath?: string;
  relativeProjectPath?: string;
  nextCommands?: string[];
};

const TOOL_OPTIONS: Array<{
  id: ToolId;
  label: string;
  description: string;
  Icon: typeof Wrench;
}> = [
  {
    id: "calculator",
    label: "Calculator",
    description: "Evaluate arithmetic expressions",
    Icon: Wrench,
  },
  {
    id: "current-time",
    label: "Current time",
    description: "Return the current timestamp",
    Icon: Clock3,
  },
];

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function fieldId(name: keyof BuilderState) {
  return `builder-${name}`;
}

function TraceDetails({ step }: { step: TraceStep }) {
  if (step.type === "model") {
    return (
      <pre className="mt-3 overflow-auto rounded border border-slate-200 bg-slate-950 p-3 text-xs leading-5 text-slate-100">
        {step.modelOutput}
      </pre>
    );
  }

  if (step.type === "tool") {
    return (
      <div className="mt-3 space-y-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Input</p>
          <pre className="mt-1 overflow-auto rounded border border-sky-200 bg-white p-3 text-xs leading-5 text-slate-800">
            {formatJson(step.toolInput)}
          </pre>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Output</p>
          <pre className="mt-1 overflow-auto rounded border border-sky-200 bg-white p-3 text-xs leading-5 text-slate-800">
            {formatJson(step.toolOutput)}
          </pre>
        </div>
      </div>
    );
  }

  if (step.type === "final") {
    return (
      <pre className="mt-3 overflow-auto rounded border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-800">
        {step.finalAnswer}
      </pre>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <pre className="overflow-auto rounded border border-red-200 bg-white p-3 text-xs leading-5 text-red-800">
        {step.error}
      </pre>
      {step.modelOutput ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">Model output</p>
          <pre className="mt-1 overflow-auto rounded border border-red-200 bg-white p-3 text-xs leading-5 text-slate-800">
            {step.modelOutput}
          </pre>
        </div>
      ) : null}
      {step.toolName ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">Tool</p>
          <pre className="mt-1 overflow-auto rounded border border-red-200 bg-white p-3 text-xs leading-5 text-slate-800">
            {step.toolName}
          </pre>
        </div>
      ) : null}
      {step.toolInput !== undefined ? (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-red-700">Tool input</p>
          <pre className="mt-1 overflow-auto rounded border border-red-200 bg-white p-3 text-xs leading-5 text-slate-800">
            {formatJson(step.toolInput)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function TraceCard({ step }: { step: TraceStep }) {
  const tone =
    step.type === "error"
      ? "border-red-200 bg-red-50"
      : step.type === "tool"
        ? "border-sky-200 bg-sky-50"
        : "border-slate-200 bg-white";
  const label =
    step.type === "tool"
      ? `Tool: ${step.toolName}`
      : step.type.charAt(0).toUpperCase() + step.type.slice(1);

  return (
    <article className={`rounded-md border p-3 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {step.type === "tool" ? (
            <Wrench className="h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
          ) : (
            <BrainCircuit
              className={`h-4 w-4 shrink-0 ${step.type === "error" ? "text-red-700" : "text-slate-600"}`}
              aria-hidden="true"
            />
          )}
          <h3 className="truncate text-sm font-semibold text-slate-950">{label}</h3>
        </div>
        <span className="shrink-0 rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
          Step {step.step}
        </span>
      </div>
      <TraceDetails step={step} />
    </article>
  );
}

export default function BuilderPage() {
  const [state, setState] = useState<BuilderState>(DEFAULT_STATE);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);

  function updateField<Key extends keyof BuilderState>(field: Key, value: BuilderState[Key]) {
    setState((current) => ({ ...current, [field]: value }));
  }

  function toggleTool(toolId: ToolId) {
    setState((current) => {
      const selectedTools = current.selectedTools.includes(toolId)
        ? current.selectedTools.filter((selectedTool) => selectedTool !== toolId)
        : [...current.selectedTools, toolId];

      return { ...current, selectedTools };
    });
  }

  async function runAgent() {
    setIsRunning(true);
    setRunError("");
    setRunResult(null);
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
      void _apiKey;
      void _userInput;
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

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1600px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)_380px]">
        <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-5">
            <h1 className="text-lg font-semibold text-slate-950">Agent Builder</h1>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              Configure the kernel, choose tools, and generate a runnable project.
            </p>
          </div>

          <div className="space-y-4">
            <label className="block" htmlFor={fieldId("projectName")}>
              <span className="text-sm font-medium text-slate-700">Project name</span>
              <input
                id={fieldId("projectName")}
                value={state.projectName}
                onChange={(event) => updateField("projectName", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block" htmlFor={fieldId("projectSlug")}>
              <span className="text-sm font-medium text-slate-700">Project slug</span>
              <input
                id={fieldId("projectSlug")}
                value={state.projectSlug}
                onChange={(event) => updateField("projectSlug", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block" htmlFor={fieldId("baseUrl")}>
              <span className="text-sm font-medium text-slate-700">Base URL</span>
              <input
                id={fieldId("baseUrl")}
                type="url"
                value={state.baseUrl}
                onChange={(event) => updateField("baseUrl", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block" htmlFor={fieldId("model")}>
              <span className="text-sm font-medium text-slate-700">Model</span>
              <input
                id={fieldId("model")}
                value={state.model}
                onChange={(event) => updateField("model", event.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block" htmlFor={fieldId("apiKey")}>
              <span className="text-sm font-medium text-slate-700">API key</span>
              <input
                id={fieldId("apiKey")}
                type="password"
                value={state.apiKey}
                onChange={(event) => updateField("apiKey", event.target.value)}
                autoComplete="off"
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-slate-950">Tools</h2>
            <div className="mt-3 space-y-2">
              {TOOL_OPTIONS.map(({ id, label, description, Icon }) => (
                <label
                  key={id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={state.selectedTools.includes(id)}
                    onChange={() => toggleTool(id)}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-950"
                  />
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">{label}</span>
                    <span className="block text-xs leading-5 text-slate-600">{description}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-slate-950">Skills</h2>
            <div className="mt-3 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600">
              No skills installed yet
            </div>
          </section>

          <button
            type="button"
            onClick={createProject}
            disabled={isCreating}
            className="mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
            {isCreating ? "Creating..." : "Create Project"}
          </button>
        </aside>

        <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-4 xl:grid-cols-2">
            <label className="block" htmlFor={fieldId("systemPrompt")}>
              <span className="text-sm font-medium text-slate-700">System Prompt</span>
              <textarea
                id={fieldId("systemPrompt")}
                value={state.systemPrompt}
                onChange={(event) => updateField("systemPrompt", event.target.value)}
                className="mt-1 min-h-48 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block" htmlFor={fieldId("userInput")}>
              <span className="text-sm font-medium text-slate-700">User Input</span>
              <textarea
                id={fieldId("userInput")}
                value={state.userInput}
                onChange={(event) => updateField("userInput", event.target.value)}
                className="mt-1 min-h-48 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={runAgent}
              disabled={isRunning}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              <Play className="h-4 w-4" aria-hidden="true" />
              {isRunning ? "Running..." : "Run Agent"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-950">Answer</h2>
              {runError ? (
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {runError}
                </p>
              ) : (
                <pre className="mt-3 min-h-36 overflow-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800">
                  {runResult?.answer ?? "Run the agent to see an answer."}
                </pre>
              )}
            </section>

            <section className="rounded-md border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-sm font-semibold text-slate-950">Generation Result</h2>
              {createError ? (
                <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {createError}
                </p>
              ) : createResult ? (
                <div className="mt-3 space-y-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Relative project path
                    </p>
                    <pre className="mt-1 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800">
                      {createResult.relativeProjectPath ?? createResult.projectPath ?? ""}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Next commands
                    </p>
                    <pre className="mt-1 min-h-20 overflow-hidden whitespace-pre-wrap break-words rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-800">
                      {(createResult.nextCommands ?? []).join("\n")}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="mt-3 min-h-36 rounded-md border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-600">
                  Create a project to see the output path and commands.
                </p>
              )}
            </section>
          </div>
        </section>

        <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-slate-700" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-slate-950">Trace</h2>
          </div>

          {runResult?.trace?.length ? (
            <div className="mt-4 space-y-3">
              {runResult.trace.map((step) => (
                <TraceCard key={`${step.step}-${step.type}`} step={step} />
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm leading-6 text-slate-600">
              Run the agent to see trace steps.
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
