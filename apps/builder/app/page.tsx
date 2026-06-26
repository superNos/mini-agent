"use client";

import { useState } from "react";
import type { TraceStep } from "@/agent/trace";
import {
  Activity,
  AlertCircle,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FolderPlus,
  KeyRound,
  Layers3,
  LayoutPanelLeft,
  LayoutPanelTop,
  Link2,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Settings2,
  Wrench,
} from "lucide-react";

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
  projectName: "我的智能体",
  projectSlug: "my-agent",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  systemPrompt: "你是一个小型智能体。请只返回符合协议的 JSON。",
  selectedTools: ["calculator", "current-time"],
  selectedSkills: [],
  userInput: "12 * (3 + 4) 等于多少？",
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
    label: "计算器",
    description: "计算四则运算表达式",
    Icon: Wrench,
  },
  {
    id: "current-time",
    label: "当前时间",
    description: "返回当前运行时间",
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

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function getTraceSummary(trace: TraceStep[] | undefined) {
  const steps = trace ?? [];
  return {
    total: steps.length,
    model: steps.filter((step) => step.type === "model").length,
    tool: steps.filter((step) => step.type === "tool").length,
    error: steps.filter((step) => step.type === "error").length,
    final: steps.filter((step) => step.type === "final").length,
  };
}

function stepTitle(step: TraceStep) {
  if (step.type === "tool") return `工具调用 · ${step.toolName}`;
  if (step.type === "model") return "模型输出";
  if (step.type === "final") return "最终回答";
  return "运行错误";
}

function stepBadgeClass(type: TraceStep["type"]) {
  if (type === "tool") return "border-blue-200 bg-blue-50 text-blue-700";
  if (type === "final") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function stepIconClass(type: TraceStep["type"]) {
  if (type === "tool") return "border-blue-200 bg-blue-50 text-blue-700";
  if (type === "final") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (type === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function StatusPill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "active" | "success" | "danger";
}) {
  return (
    <span
      className={classNames(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium",
        tone === "neutral" && "border-zinc-200 bg-zinc-50 text-zinc-600",
        tone === "active" && "border-indigo-200 bg-indigo-50 text-indigo-700",
        tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-700",
        tone === "danger" && "border-red-200 bg-red-50 text-red-700",
      )}
    >
      {children}
    </span>
  );
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function TextField({
  name,
  label,
  value,
  type = "text",
  onChange,
  autoComplete,
  icon,
}: {
  name: keyof BuilderState;
  label: string;
  value: string;
  type?: "text" | "url" | "password";
  onChange: (value: string) => void;
  autoComplete?: string;
  icon?: React.ReactNode;
}) {
  return (
    <label className="block" htmlFor={fieldId(name)}>
      <span className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-600">
        {icon}
        {label}
      </span>
      <input
        id={fieldId(name)}
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        className="h-9 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
    </label>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-zinc-950">{title}</h2>;
}

function ConfigSidebar({
  state,
  isCollapsed,
  isCreating,
  onToggleCollapse,
  onFieldChange,
  onToggleTool,
  onCreateProject,
}: {
  state: BuilderState;
  isCollapsed: boolean;
  isCreating: boolean;
  onToggleCollapse: () => void;
  onFieldChange: <Key extends keyof BuilderState>(field: Key, value: BuilderState[Key]) => void;
  onToggleTool: (toolId: ToolId) => void;
  onCreateProject: () => void;
}) {
  if (isCollapsed) {
    return (
      <aside className="flex min-h-[220px] flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm lg:min-h-[calc(100vh-96px)]">
        <IconButton label="展开配置" onClick={onToggleCollapse}>
          <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <div className="h-px w-full bg-zinc-200" />
        <button
          type="button"
          title="配置"
          onClick={onToggleCollapse}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
        >
          <Settings2 className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          title={`工具 ${state.selectedTools.length} 个已启用`}
          onClick={onToggleCollapse}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
        >
          <Wrench className="h-4 w-4" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-4 text-white">
            {state.selectedTools.length}
          </span>
        </button>
        <button
          type="button"
          title="技能"
          onClick={onToggleCollapse}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
        >
          <Layers3 className="h-4 w-4" aria-hidden="true" />
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-zinc-700 px-1 text-[10px] font-semibold leading-4 text-white">
            {state.selectedSkills.length}
          </span>
        </button>
        <button
          type="button"
          title="生成项目"
          onClick={onCreateProject}
          disabled={isCreating}
          className="mt-auto inline-flex h-9 w-9 items-center justify-center rounded-md bg-zinc-950 text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
        >
          {isCreating ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <FolderPlus className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </aside>
    );
  }

  return (
    <aside className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm lg:min-h-[calc(100vh-96px)]">
      <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950">智能体配置</p>
        </div>
        <IconButton label="收起配置" onClick={onToggleCollapse}>
          <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="max-h-none space-y-6 overflow-auto p-4 lg:max-h-[calc(100vh-148px)]">
        <section className="space-y-3">
          <SectionHeader title="项目" />
          <TextField
            name="projectName"
            label="项目名称"
            value={state.projectName}
            onChange={(value) => onFieldChange("projectName", value)}
            icon={<LayoutPanelTop className="h-3.5 w-3.5" aria-hidden="true" />}
          />
          <TextField
            name="projectSlug"
            label="项目标识"
            value={state.projectSlug}
            onChange={(value) => onFieldChange("projectSlug", value)}
            icon={<LayoutPanelLeft className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        </section>

        <section className="space-y-3 border-t border-zinc-200 pt-5">
          <SectionHeader title="模型连接" />
          <TextField
            name="baseUrl"
            label="接口地址"
            type="url"
            value={state.baseUrl}
            onChange={(value) => onFieldChange("baseUrl", value)}
            icon={<Link2 className="h-3.5 w-3.5" aria-hidden="true" />}
          />
          <TextField
            name="model"
            label="模型"
            value={state.model}
            onChange={(value) => onFieldChange("model", value)}
            icon={<Bot className="h-3.5 w-3.5" aria-hidden="true" />}
          />
          <TextField
            name="apiKey"
            label="API Key"
            type="password"
            value={state.apiKey}
            onChange={(value) => onFieldChange("apiKey", value)}
            autoComplete="off"
            icon={<KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
          />
        </section>

        <section className="space-y-3 border-t border-zinc-200 pt-5">
          <SectionHeader title="已注册工具" />
          <div className="space-y-2">
            {TOOL_OPTIONS.map(({ id, label, description, Icon }) => {
              const checked = state.selectedTools.includes(id);
              return (
                <label
                  key={id}
                  className={classNames(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
                    checked
                      ? "border-indigo-200 bg-indigo-50/70"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleTool(id)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Icon
                    className={classNames(
                      "mt-0.5 h-4 w-4 shrink-0",
                      checked ? "text-indigo-700" : "text-zinc-500",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-950">{label}</span>
                    <span className="block text-xs leading-5 text-zinc-500">{description}</span>
                    <span className="mt-1 inline-flex rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
                      {id}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>

        <section className="space-y-3 border-t border-zinc-200 pt-5">
          <SectionHeader title="技能" />
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-sm leading-6 text-zinc-600">
            暂无已注册技能
          </div>
        </section>

        <section className="border-t border-zinc-200 pt-5">
          <button
            type="button"
            onClick={onCreateProject}
            disabled={isCreating}
            className="inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
          >
            {isCreating ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
            )}
            {isCreating ? "生成中..." : "生成项目"}
          </button>
        </section>
      </div>
    </aside>
  );
}

function PromptEditor({
  state,
  isRunning,
  onFieldChange,
  onRunAgent,
}: {
  state: BuilderState;
  isRunning: boolean;
  onFieldChange: <Key extends keyof BuilderState>(field: Key, value: BuilderState[Key]) => void;
  onRunAgent: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">Prompt 控制台</h2>
        </div>
        <button
          type="button"
          onClick={onRunAgent}
          disabled={isRunning}
          className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {isRunning ? "运行中..." : "运行 Agent"}
        </button>
      </div>

      <div className="grid gap-0 xl:grid-cols-2">
        <label className="block border-b border-zinc-200 p-4 xl:border-b-0 xl:border-r" htmlFor={fieldId("systemPrompt")}>
          <span className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-zinc-700">System Prompt</span>
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-500">
              system
            </span>
          </span>
          <textarea
            id={fieldId("systemPrompt")}
            value={state.systemPrompt}
            onChange={(event) => onFieldChange("systemPrompt", event.target.value)}
            className="min-h-52 w-full resize-y rounded-md border border-zinc-200 bg-zinc-50/70 p-3 font-mono text-sm leading-6 text-zinc-950 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <label className="block p-4" htmlFor={fieldId("userInput")}>
          <span className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold text-zinc-700">用户输入</span>
            <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-0.5 font-mono text-[11px] text-zinc-500">
              user
            </span>
          </span>
          <textarea
            id={fieldId("userInput")}
            value={state.userInput}
            onChange={(event) => onFieldChange("userInput", event.target.value)}
            className="min-h-52 w-full resize-y rounded-md border border-zinc-200 bg-zinc-50/70 p-3 text-sm leading-6 text-zinc-950 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </label>
      </div>
    </section>
  );
}

function ObservationWorkspace({
  runResult,
  runError,
  createResult,
  createError,
  activeTab,
  onChangeTab,
}: {
  runResult: RunResult | null;
  runError: string;
  createResult: CreateResult | null;
  createError: string;
  activeTab: "answer" | "project";
  onChangeTab: (tab: "answer" | "project") => void;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">观察结果</h2>
        </div>
        <div className="inline-flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
          <button
            type="button"
            onClick={() => onChangeTab("answer")}
            className={classNames(
              "rounded px-3 py-1.5 text-xs font-medium transition",
              activeTab === "answer" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950",
            )}
          >
            回答
          </button>
          <button
            type="button"
            onClick={() => onChangeTab("project")}
            className={classNames(
              "rounded px-3 py-1.5 text-xs font-medium transition",
              activeTab === "project" ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950",
            )}
          >
            生成结果
          </button>
        </div>
      </div>

      <div className="min-h-64 p-4">
        {activeTab === "answer" ? (
          <AnswerPanel runResult={runResult} runError={runError} />
        ) : (
          <GenerationResultPanel createResult={createResult} createError={createError} />
        )}
      </div>
    </section>
  );
}

function AnswerPanel({ runResult, runError }: { runResult: RunResult | null; runError: string }) {
  if (runError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          运行失败
        </div>
        {runError}
      </div>
    );
  }

  return (
    <pre className="min-h-52 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-6 text-zinc-800">
      {runResult?.answer || "运行 Agent 后会在这里显示最终回答。"}
    </pre>
  );
}

function GenerationResultPanel({
  createResult,
  createError,
}: {
  createResult: CreateResult | null;
  createError: string;
}) {
  if (createError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
        <div className="mb-2 flex items-center gap-2 font-semibold">
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          生成失败
        </div>
        {createError}
      </div>
    );
  }

  if (!createResult) {
    return (
      <div className="min-h-52 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-600">
        创建项目后会在这里显示输出路径和后续命令。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-500">相对项目路径</p>
        <pre className="overflow-hidden whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-800">
          {createResult.relativeProjectPath ?? createResult.projectPath ?? ""}
        </pre>
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium text-zinc-500">后续命令</p>
        <pre className="min-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100">
          {(createResult.nextCommands ?? []).join("\n")}
        </pre>
      </div>
    </div>
  );
}

function TraceDetails({ step }: { step: TraceStep }) {
  if (step.type === "model") {
    return (
      <pre className="mt-3 max-h-72 overflow-auto rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100">
        {step.modelOutput}
      </pre>
    );
  }

  if (step.type === "tool") {
    return (
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">输入</p>
          <pre className="max-h-56 overflow-auto rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-800">
            {formatJson(step.toolInput)}
          </pre>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">输出</p>
          <pre className="max-h-56 overflow-auto rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-800">
            {formatJson(step.toolOutput)}
          </pre>
        </div>
      </div>
    );
  }

  if (step.type === "final") {
    return (
      <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-white p-3 text-xs leading-5 text-zinc-800">
        {step.finalAnswer}
      </pre>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <pre className="overflow-auto rounded-md border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-800">
        {step.error}
      </pre>
      {step.modelOutput ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">模型输出</p>
          <pre className="max-h-56 overflow-auto rounded-md border border-red-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-800">
            {step.modelOutput}
          </pre>
        </div>
      ) : null}
      {step.toolName ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">工具</p>
          <pre className="overflow-auto rounded-md border border-red-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-800">
            {step.toolName}
          </pre>
        </div>
      ) : null}
      {step.toolInput !== undefined ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">工具输入</p>
          <pre className="max-h-56 overflow-auto rounded-md border border-red-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-800">
            {formatJson(step.toolInput)}
          </pre>
        </div>
      ) : null}
    </div>
  );
}

function TraceCard({ step, defaultOpen }: { step: TraceStep; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const isError = step.type === "error";
  const Icon = step.type === "tool" ? Wrench : step.type === "final" ? CheckCircle2 : isError ? AlertCircle : BrainCircuit;

  return (
    <article className="relative pl-8">
      <span className="absolute left-[11px] top-8 h-[calc(100%-16px)] w-px bg-zinc-200" aria-hidden="true" />
      <span
        className={classNames(
          "absolute left-0 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border",
          stepIconClass(step.type),
        )}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm">
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="flex w-full items-start justify-between gap-3 text-left"
        >
          <span className="min-w-0">
            <span className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-500">第 {step.step} 步</span>
              <span className={classNames("rounded-md border px-1.5 py-0.5 text-[11px] font-medium", stepBadgeClass(step.type))}>
                {step.type}
              </span>
            </span>
            <span className="block truncate text-sm font-semibold text-zinc-950">{stepTitle(step)}</span>
          </span>
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-500">
            {isOpen ? "收起" : "详情"}
          </span>
        </button>
        {isOpen ? <TraceDetails step={step} /> : null}
      </div>
    </article>
  );
}

function TraceSidebar({
  trace,
  isCollapsed,
  isRunning,
  onToggleCollapse,
}: {
  trace: TraceStep[] | undefined;
  isCollapsed: boolean;
  isRunning: boolean;
  onToggleCollapse: () => void;
}) {
  const summary = getTraceSummary(trace);
  const hasError = summary.error > 0;

  if (isCollapsed) {
    return (
      <aside className="flex min-h-[160px] flex-col items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2 shadow-sm lg:min-h-[calc(100vh-96px)]">
        <IconButton label="展开轨迹" onClick={onToggleCollapse}>
          <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
        </IconButton>
        <div className="h-px w-full bg-zinc-200" />
        <button
          type="button"
          title={`运行轨迹 ${summary.total} 步`}
          onClick={onToggleCollapse}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 transition hover:bg-zinc-50 hover:text-zinc-950"
        >
          {isRunning ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Activity className="h-4 w-4" aria-hidden="true" />
          )}
          <span
            className={classNames(
              "absolute -right-0.5 -top-0.5 min-w-4 rounded-full px-1 text-[10px] font-semibold leading-4 text-white",
              hasError ? "bg-red-600" : "bg-indigo-600",
            )}
          >
            {summary.total}
          </span>
        </button>
        {hasError ? <span className="h-2 w-2 rounded-full bg-red-600" title="存在错误" /> : null}
      </aside>
    );
  }

  return (
    <aside className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm lg:min-h-[calc(100vh-96px)]">
      <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-950">运行轨迹</p>
        </div>
        <IconButton label="收起轨迹" onClick={onToggleCollapse}>
          <PanelRightClose className="h-4 w-4" aria-hidden="true" />
        </IconButton>
      </div>

      <div className="max-h-none overflow-auto p-4 lg:max-h-[calc(100vh-148px)]">
        <div className="mb-4 flex flex-wrap gap-2">
          <StatusPill tone={summary.total ? "active" : "neutral"}>{summary.total} steps</StatusPill>
          <StatusPill>{summary.model} model</StatusPill>
          <StatusPill>{summary.tool} tool</StatusPill>
          {summary.error ? <StatusPill tone="danger">{summary.error} error</StatusPill> : <StatusPill>0 error</StatusPill>}
        </div>

        {trace?.length ? (
          <div className="space-y-4">
            {trace.map((step, index) => (
              <TraceCard
                key={`${index}-${step.step}-${step.type}`}
                step={step}
                defaultOpen={step.type === "error" || index === trace.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm leading-6 text-zinc-600">
            运行 Agent 后会记录模型输出、工具调用和最终回答。
          </div>
        )}
      </div>
    </aside>
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
  const [activeTab, setActiveTab] = useState<"answer" | "project">("answer");
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  const [isTraceCollapsed, setIsTraceCollapsed] = useState(false);

  const traceSummary = getTraceSummary(runResult?.trace);
  const runStatus = runError
    ? "danger"
    : isRunning
      ? "active"
      : runResult
        ? "success"
        : "neutral";

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
    setActiveTab("answer");
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "运行失败");
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
    setCreateResult(null);
    setActiveTab("project");
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
      if (!response.ok) throw new Error(data.error ?? "生成失败");
      setCreateResult(data);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-zinc-950">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-zinc-950 text-white">
              <BrainCircuit className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-zinc-950">Mini Agent Builder</h1>
              <p className="truncate text-xs text-zinc-500">
                {state.projectName} · {state.projectSlug}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-start gap-2 lg:justify-center">
            <StatusPill tone={runStatus}>
              {isRunning ? "运行中" : runError ? "运行失败" : runResult ? "已完成" : "待运行"}
            </StatusPill>
            <StatusPill>
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="max-w-36 truncate">{state.model}</span>
            </StatusPill>
            <StatusPill>
              <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
              工具 {state.selectedTools.length}
            </StatusPill>
            <StatusPill>
              <Activity className="h-3.5 w-3.5" aria-hidden="true" />
              轨迹 {traceSummary.total}
            </StatusPill>
          </div>

          <div className="flex items-center gap-2">
            <IconButton label={isConfigCollapsed ? "展开配置" : "收起配置"} onClick={() => setIsConfigCollapsed((current) => !current)}>
              {isConfigCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </IconButton>
            <IconButton label={isTraceCollapsed ? "展开轨迹" : "收起轨迹"} onClick={() => setIsTraceCollapsed((current) => !current)}>
              {isTraceCollapsed ? (
                <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
              ) : (
                <PanelRightClose className="h-4 w-4" aria-hidden="true" />
              )}
            </IconButton>
            <button
              type="button"
              onClick={createProject}
              disabled={isCreating}
              className="hidden h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 sm:inline-flex"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
              )}
              生成项目
            </button>
            <button
              type="button"
              onClick={runAgent}
              disabled={isRunning}
              className="inline-flex h-9 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-indigo-600 px-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-indigo-300"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              运行
            </button>
          </div>
        </div>
      </header>

      <div
        className={classNames(
          "grid gap-3 p-3 transition-[grid-template-columns] duration-200 lg:p-4",
          isConfigCollapsed && isTraceCollapsed
            ? "lg:grid-cols-[56px_minmax(0,1fr)_56px]"
            : isConfigCollapsed
              ? "lg:grid-cols-[56px_minmax(0,1fr)_390px]"
              : isTraceCollapsed
                ? "lg:grid-cols-[320px_minmax(0,1fr)_56px]"
                : "lg:grid-cols-[320px_minmax(0,1fr)_390px]",
        )}
      >
        <ConfigSidebar
          state={state}
          isCollapsed={isConfigCollapsed}
          isCreating={isCreating}
          onToggleCollapse={() => setIsConfigCollapsed((current) => !current)}
          onFieldChange={updateField}
          onToggleTool={toggleTool}
          onCreateProject={createProject}
        />

        <div className="min-w-0 space-y-3">
          <PromptEditor state={state} isRunning={isRunning} onFieldChange={updateField} onRunAgent={runAgent} />
          <ObservationWorkspace
            runResult={runResult}
            runError={runError}
            createResult={createResult}
            createError={createError}
            activeTab={activeTab}
            onChangeTab={setActiveTab}
          />
        </div>

        <TraceSidebar
          trace={runResult?.trace}
          isCollapsed={isTraceCollapsed}
          isRunning={isRunning}
          onToggleCollapse={() => setIsTraceCollapsed((current) => !current)}
        />
      </div>
    </main>
  );
}
