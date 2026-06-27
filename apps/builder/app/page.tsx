"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { groupTraceSteps } from "@/agent/trace-groups";
import type { TraceCardGroup } from "@/agent/trace-groups";
import type { AgentMessage } from "@/agent/model";
import type { TraceStep } from "@/agent/trace";
import type { SkillId, ToolId } from "@/schemas/agent-config";
import {
  Activity,
  AlertCircle,
  BadgeDollarSign,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  CloudSun,
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
  CalendarDays,
  Wrench,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { collapseAllNested, JsonView } from "react-json-view-lite";

type BuilderState = {
  projectName: string;
  projectSlug: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  selectedTools: ToolId[];
  selectedSkills: SkillId[];
  userInput: string;
};

const DEFAULT_STATE: BuilderState = {
  projectName: "周末旅行计划助手",
  projectSlug: "travel-agent",
  baseUrl: "https://api.openai.com/v1",
  apiKey: "",
  model: "gpt-4.1-mini",
  systemPrompt: "你是一个小型智能体。请只返回符合协议的 JSON。",
  selectedTools: ["weather-forecast", "budget-check", "itinerary-planner"],
  selectedSkills: ["travel-planner"],
  userInput: "我周末从杭州去苏州，两个人，预算 1500 元，帮我做一个 2 天 1 晚的旅行计划。",
};

type SkillOptionId = BuilderState["selectedSkills"][number];
type TraceNodeType = TraceCardGroup["type"];
type TraceFilter = "all" | TraceNodeType;
type ResizablePanel = "config" | "trace";

type SkillOption = {
  id: SkillId;
  name: string;
  description: string;
  content: string;
  toolIds: string[];
};

type RunResult = {
  answer?: string;
  trace?: TraceStep[];
};

type RunStreamEvent =
  | {
      type: "trace";
      step: TraceStep;
    }
  | {
      type: "final";
      answer: string;
      trace: TraceStep[];
    }
  | {
      type: "error";
      error: string;
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
  Icon: LucideIcon;
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
  {
    id: "weather-forecast",
    label: "天气预报",
    description: "调用 Open-Meteo 查询真实天气",
    Icon: CloudSun,
  },
  {
    id: "budget-check",
    label: "预算检查",
    description: "汇总费用并判断预算是否充足",
    Icon: BadgeDollarSign,
  },
  {
    id: "itinerary-planner",
    label: "行程安排",
    description: "生成结构化每日旅行安排",
    Icon: CalendarDays,
  },
];

const TRACE_FILTERS: Array<{ id: TraceFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "skill", label: "技能" },
  { id: "model", label: "模型" },
  { id: "tool", label: "工具" },
  { id: "error", label: "错误" },
];

const COLLAPSED_PANEL_WIDTH = 56;
const DEFAULT_CONFIG_WIDTH = 320;
const DEFAULT_TRACE_WIDTH = 390;
const MIN_CONFIG_WIDTH = 280;
const MAX_CONFIG_WIDTH = 560;
const MIN_TRACE_WIDTH = 320;
const MAX_TRACE_WIDTH = 680;

const JSON_VIEW_STYLES = {
  container: "text-xs leading-5 text-zinc-800",
  childFieldsContainer: "m-0 list-none border-l border-zinc-200 pl-3",
  basicChildStyle: "m-0 py-0.5",
  label: "mr-1 font-semibold text-zinc-700",
  clickableLabel: "mr-1 cursor-pointer font-semibold text-zinc-700 hover:text-indigo-700",
  collapseIcon:
    "mr-1 inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-200 bg-white text-[10px] text-zinc-500 before:content-['-']",
  expandIcon:
    "mr-1 inline-flex h-4 w-4 items-center justify-center rounded border border-zinc-200 bg-white text-[10px] text-zinc-500 before:content-['+']",
  collapsedContent: "ml-1 rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-500",
  nullValue: "text-zinc-500",
  undefinedValue: "text-zinc-500",
  numberValue: "text-blue-600",
  stringValue: "text-emerald-700",
  booleanValue: "text-violet-700",
  otherValue: "text-zinc-700",
  punctuation: "text-zinc-400",
  noQuotesForStringValues: false,
  quotesForFieldNames: false,
  stringifyStringValues: true,
};

function formatJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}

function parseJson(value: string) {
  try {
    return { ok: true as const, data: JSON.parse(value) as unknown };
  } catch {
    return { ok: false as const };
  }
}

function isJsonContainer(value: unknown): value is Record<string, unknown> | unknown[] {
  return typeof value === "object" && value !== null;
}

function fieldId(name: keyof BuilderState) {
  return `builder-${name}`;
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function clampWidth(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ResizeHandle({
  side,
  label,
  testId,
  onPointerDown,
}: {
  side: "left" | "right";
  label: string;
  testId: string;
  onPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      aria-label={label}
      title={label}
      onPointerDown={onPointerDown}
      className={classNames(
        "group absolute bottom-3 top-14 z-10 hidden w-4 cursor-col-resize items-stretch justify-center rounded-md outline-none lg:flex",
        side === "right" ? "-right-3" : "-left-3",
      )}
    >
      <span className="my-2 w-1 rounded-full bg-zinc-200 transition group-hover:bg-indigo-400 group-focus-visible:bg-indigo-400" />
    </button>
  );
}

function getTraceSummary(trace: TraceStep[] | undefined) {
  const steps = groupTraceSteps(trace ?? []);
  return {
    total: steps.length,
    skill: steps.filter((step) => step.type === "skill").length,
    model: steps.filter((step) => step.type === "model").length,
    tool: steps.filter((step) => step.type === "tool").length,
    error: steps.filter((step) => step.type === "error").length,
  };
}

function stepTitle(step: TraceStep) {
  if (step.type === "skill") return `读取技能 · ${step.skills.length} 个`;
  if (step.type === "tool") return `${step.phase === "started" ? "开始调用工具" : "工具调用完成"} · ${step.toolName}`;
  if (step.type === "model") return step.phase === "started" ? "开始调用模型" : "模型调用完成";
  if (step.type === "action") return "协议解析完成";
  if (step.type === "observation") return `观察结果入队 · ${step.toolName}`;
  if (step.type === "final") return "最终回答";
  return "运行错误";
}

function traceGroupTitle(group: TraceCardGroup) {
  const step = group.primary;
  if (group.type === "skill") return stepTitle(step);
  if (group.type === "model") return group.completed ? "模型调用完成" : "开始调用模型";
  if (group.type === "tool" && step.type === "tool") {
    return `${group.completed ? "工具调用完成" : "开始调用工具"} · ${step.toolName}`;
  }
  return stepTitle(step);
}

function stepBadgeClass(type: TraceNodeType) {
  if (type === "skill") return "border-violet-200 bg-violet-50 text-violet-700";
  if (type === "tool") return "border-blue-200 bg-blue-50 text-blue-700";
  if (type === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function stepIconClass(type: TraceNodeType) {
  if (type === "skill") return "border-violet-200 bg-violet-50 text-violet-700";
  if (type === "tool") return "border-blue-200 bg-blue-50 text-blue-700";
  if (type === "error") return "border-red-200 bg-red-50 text-red-700";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function getTraceFilterCount(trace: TraceStep[] | undefined, filter: TraceFilter) {
  const steps = groupTraceSteps(trace ?? []);
  if (filter === "all") return steps.length;
  return steps.filter((step) => step.type === filter).length;
}

function RawCodeBlock({
  children,
  tone = "light",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark" | "danger";
}) {
  return (
    <pre
      className={classNames(
        "max-h-72 overflow-auto whitespace-pre-wrap rounded-md border p-3 font-mono text-xs leading-5",
        tone === "dark" && "border-zinc-800 bg-zinc-950 text-zinc-100",
        tone === "light" && "border-zinc-200 bg-white text-zinc-800",
        tone === "danger" && "border-red-200 bg-red-50 text-red-800",
      )}
    >
      {children}
    </pre>
  );
}

function JsonTreeBlock({ value }: { value: unknown }) {
  if (!isJsonContainer(value)) {
    return <RawCodeBlock>{formatJson(value)}</RawCodeBlock>;
  }

  return (
    <div className="max-h-72 overflow-auto rounded-md border border-zinc-200 bg-zinc-50/70 p-3 font-mono text-xs leading-5 text-zinc-800">
      <JsonView
        data={value}
        shouldExpandNode={collapseAllNested}
        style={JSON_VIEW_STYLES}
        clickToExpandNode
        compactTopLevel
      />
    </div>
  );
}

function ModelOutputBlock({ modelOutput }: { modelOutput: string }) {
  const parsed = parseJson(modelOutput);
  if (parsed.ok) return <JsonTreeBlock value={parsed.data} />;

  return <RawCodeBlock tone="dark">{modelOutput}</RawCodeBlock>;
}

function modelRoleClass(role: AgentMessage["role"]) {
  if (role === "system") return "border-zinc-300 bg-zinc-100 text-zinc-700";
  if (role === "assistant") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  return "border-blue-200 bg-blue-50 text-blue-700";
}

function ModelInputBlock({ messages }: { messages: AgentMessage[] }) {
  return (
    <div className="max-h-80 space-y-2 overflow-auto rounded-md border border-zinc-200 bg-zinc-50/70 p-3">
      {messages.map((message, index) => (
        <div key={`${message.role}-${index}`} className="rounded-md border border-zinc-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className={classNames(
                "inline-flex rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
                modelRoleClass(message.role),
              )}
            >
              {message.role}
            </span>
            <span className="text-[11px] text-zinc-400">message {index + 1}</span>
          </div>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-zinc-700">
            {message.content}
          </pre>
        </div>
      ))}
    </div>
  );
}

function DurationText({ durationMs }: { durationMs?: number }) {
  if (durationMs === undefined) return null;
  return <span className="text-[11px] text-zinc-400">{durationMs}ms</span>;
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
  skills,
  skillsError,
  isCollapsed,
  onToggleCollapse,
  onFieldChange,
  onToggleTool,
  onToggleSkill,
}: {
  state: BuilderState;
  skills: SkillOption[];
  skillsError: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onFieldChange: <Key extends keyof BuilderState>(field: Key, value: BuilderState[Key]) => void;
  onToggleTool: (toolId: ToolId) => void;
  onToggleSkill: (skillId: SkillOptionId) => void;
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
          <div className="space-y-2">
            {skillsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
                {skillsError}
              </div>
            ) : null}
            {skills.length === 0 && !skillsError ? (
              <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-4 text-xs leading-5 text-zinc-500">
                未发现技能包。请把包含 SKILL.md 的目录放到 src/skills/ 下。
              </div>
            ) : null}
            {skills.map((skill) => {
              const checked = state.selectedSkills.includes(skill.id);
              return (
                <label
                  key={skill.id}
                  className={classNames(
                    "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition",
                    checked
                      ? "border-cyan-200 bg-cyan-50/70"
                      : "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleSkill(skill.id)}
                    className="mt-1 h-4 w-4 rounded border-zinc-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <Layers3
                    className={classNames(
                      "mt-0.5 h-4 w-4 shrink-0",
                      checked ? "text-cyan-700" : "text-zinc-500",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-zinc-950">{skill.name}</span>
                    <span className="block text-xs leading-5 text-zinc-500">{skill.description}</span>
                    <span className="mt-2 block rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs leading-5 text-zinc-600">
                      {skill.content.split(/\r?\n/).find((line) => line.trim() && !line.startsWith("#")) ??
                        "查看 SKILL.md 获取完整说明。"}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-1">
                      <span className="inline-flex rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 font-mono text-[11px] text-zinc-500">
                        {skill.id}
                      </span>
                      {skill.toolIds.map((toolId) => (
                        <span
                          key={toolId}
                          className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 font-mono text-[11px] text-blue-700"
                        >
                          依赖 {toolId}
                        </span>
                      ))}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
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
}: {
  runResult: RunResult | null;
  runError: string;
}) {
  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950">Agent 回答</h2>
        </div>
      </div>

      <div className="min-h-64 p-4">
        <AnswerPanel runResult={runResult} runError={runError} />
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

  const answer = (runResult?.answer ?? "").trim();
  if (!answer) {
    return (
      <div className="min-h-52 rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm leading-6 text-zinc-500">
        运行 Agent 后会在这里显示最终回答。
      </div>
    );
  }

  const parsedJson = parseJson(answer);
  if (parsedJson.ok && isJsonContainer(parsedJson.data)) {
    return (
      <div className="min-h-52 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4">
        <JsonTreeBlock value={parsedJson.data} />
      </div>
    );
  }

  return <MarkdownAnswer content={answer} />;
}

type MarkdownBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "code"; content: string };

function isMarkdownBoundary(line: string) {
  const trimmed = line.trim();
  return (
    !trimmed ||
    trimmed.startsWith("```") ||
    /^#{1,4}\s+/.test(trimmed) ||
    /^[-*]\s+/.test(trimmed) ||
    /^\d+\.\s+/.test(trimmed)
  );
}

function parseMarkdownBlocks(markdown: string) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      index += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      index += 1;
      const codeLines: string[] = [];
      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({ type: "code", content: codeLines.join("\n") });
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(trimmed);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, content: heading[2] });
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^[-*]\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
        items.push(lines[index].trim().replace(/^\d+\.\s+/, ""));
        index += 1;
      }
      blocks.push({ type: "ordered-list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && !isMarkdownBoundary(lines[index])) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }
    blocks.push({ type: "paragraph", content: paragraphLines.join(" ") });
  }

  return blocks;
}

function renderInlineMarkdown(content: string) {
  const parts = content.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${part}-${index}`} className="font-semibold text-zinc-950">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`${part}-${index}`} className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.9em] text-zinc-800">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function MarkdownAnswer({ content }: { content: string }) {
  const blocks = parseMarkdownBlocks(content);
  return (
    <article className="min-h-52 space-y-4 overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-7 text-zinc-800">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const HeadingTag = `h${Math.min(block.level + 1, 4)}` as "h2" | "h3" | "h4";
          return (
            <HeadingTag key={index} className="pt-1 text-base font-semibold leading-7 text-zinc-950 first:pt-0">
              {renderInlineMarkdown(block.content)}
            </HeadingTag>
          );
        }
        if (block.type === "unordered-list") {
          return (
            <ul key={index} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }
        if (block.type === "ordered-list") {
          return (
            <ol key={index} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }
        if (block.type === "code") {
          return (
            <pre key={index} className="overflow-auto rounded-md border border-zinc-200 bg-white p-3 font-mono text-xs leading-5 text-zinc-800">
              {block.content}
            </pre>
          );
        }
        return <p key={index}>{renderInlineMarkdown(block.content)}</p>;
      })}
    </article>
  );
}

function CreateProjectDialog({
  isOpen,
  isCreating,
  createResult,
  createError,
  onClose,
}: {
  isOpen: boolean;
  isCreating: boolean;
  createResult: CreateResult | null;
  createError: string;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-dialog-title"
        className="w-full max-w-xl overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="min-w-0">
            <h2 id="create-project-dialog-title" className="text-sm font-semibold text-zinc-950">
              生成项目
            </h2>
            <p className="mt-1 text-xs text-zinc-500">把当前配置导出为可独立运行的 Next.js Agent 项目</p>
          </div>
          <IconButton label="关闭生成项目窗口" onClick={onClose} disabled={isCreating}>
            <X className="h-4 w-4" aria-hidden="true" />
          </IconButton>
        </div>

        <div className="space-y-4 p-4">
          {isCreating ? (
            <div className="rounded-md border border-indigo-200 bg-indigo-50 p-4 text-sm leading-6 text-indigo-800">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                正在生成项目
              </div>
              正在复制模板、写入配置、生成工具和 README。
            </div>
          ) : null}

          {!isCreating && createError ? (
            <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                生成失败
              </div>
              {createError}
            </div>
          ) : null}

          {!isCreating && createResult ? (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
                <div className="mb-2 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  项目已生成
                </div>
                可以进入生成目录安装依赖并启动项目。
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500">项目路径</p>
                <pre className="overflow-hidden whitespace-pre-wrap break-words rounded-md border border-zinc-200 bg-zinc-50 p-3 font-mono text-xs leading-5 text-zinc-800">
                  {createResult.relativeProjectPath ?? createResult.projectPath ?? ""}
                </pre>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-500">运行命令</p>
                <pre className="min-h-24 overflow-auto whitespace-pre-wrap break-words rounded-md border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs leading-5 text-zinc-100">
                  {(createResult.nextCommands ?? []).join("\n")}
                </pre>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-zinc-200 bg-zinc-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

function TraceDetails({ step }: { step: TraceStep }) {
  if (step.type === "skill") {
    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-500">已读取并挂载到 System Prompt</p>
          <p className="text-xs text-zinc-400">{new Date(step.loadedAt).toLocaleTimeString()}</p>
        </div>
        <div className="space-y-2">
          {step.skills.map((skill) => (
            <div key={skill.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-zinc-950">{skill.name}</p>
                <span className="rounded-md border border-zinc-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                  {skill.id}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{skill.description}</p>
              {skill.toolIds?.length ? (
                <p className="mt-2 text-xs text-zinc-500">
                  依赖工具：{skill.toolIds.join("、")}
                </p>
              ) : null}
              <div className="mt-2">
                <p className="mb-1.5 text-xs font-medium text-zinc-500">技能内容</p>
                <RawCodeBlock>{skill.content}</RawCodeBlock>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (step.type === "model") {
    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-500">
            {step.phase === "started" ? "模型请求已开始" : "模型请求已完成"}
          </p>
          <DurationText durationMs={step.phase === "completed" ? step.durationMs : undefined} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">输入 messages</p>
          <ModelInputBlock messages={step.modelInput} />
        </div>
        {step.phase === "completed" ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">输出</p>
            <ModelOutputBlock modelOutput={step.modelOutput} />
          </div>
        ) : null}
      </div>
    );
  }

  if (step.type === "action") {
    return (
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">解析结果</p>
          <JsonTreeBlock value={step.action} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">模型原始输出</p>
          <ModelOutputBlock modelOutput={step.modelOutput} />
        </div>
      </div>
    );
  }

  if (step.type === "tool") {
    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-500">
            {step.phase === "started" ? "工具调用已开始" : "工具调用已完成"}
          </p>
          <DurationText durationMs={step.phase === "completed" ? step.durationMs : undefined} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">输入</p>
          <JsonTreeBlock value={step.toolInput} />
        </div>
        {step.phase === "completed" ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">输出</p>
            <JsonTreeBlock value={step.toolOutput} />
          </div>
        ) : null}
      </div>
    );
  }

  if (step.type === "observation") {
    return (
      <div className="mt-3 space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">写回模型的 observation</p>
          <RawCodeBlock>{step.observation}</RawCodeBlock>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">下一轮 messages</p>
          <ModelInputBlock messages={step.messages} />
        </div>
      </div>
    );
  }

  if (step.type === "final") {
    return (
      <div className="mt-3">
        <RawCodeBlock>{step.finalAnswer}</RawCodeBlock>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <RawCodeBlock tone="danger">{step.error}</RawCodeBlock>
      {step.modelOutput ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">模型输出</p>
          <ModelOutputBlock modelOutput={step.modelOutput} />
        </div>
      ) : null}
      {step.modelInput ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">模型输入 messages</p>
          <ModelInputBlock messages={step.modelInput} />
        </div>
      ) : null}
      {step.toolName ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">工具</p>
          <RawCodeBlock>{step.toolName}</RawCodeBlock>
        </div>
      ) : null}
      {step.toolInput !== undefined ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">工具输入</p>
          <JsonTreeBlock value={step.toolInput} />
        </div>
      ) : null}
      {step.action ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-red-700">已解析动作</p>
          <JsonTreeBlock value={step.action} />
        </div>
      ) : null}
    </div>
  );
}

function TraceGroupDetails({ group }: { group: TraceCardGroup }) {
  if (group.type === "model" && (group.started || group.completed)) {
    const completed = group.completed?.type === "model" ? group.completed : undefined;
    const started = group.started?.type === "model" ? group.started : undefined;
    const step = completed ?? started;
    if (!step) return <TraceDetails step={group.primary} />;

    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-500">
            {completed ? "模型请求已完成" : "模型请求进行中"}
          </p>
          <DurationText durationMs={completed?.durationMs} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">输入 messages</p>
          <ModelInputBlock messages={step.modelInput} />
        </div>
        {completed ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">输出</p>
            <ModelOutputBlock modelOutput={completed.modelOutput} />
          </div>
        ) : null}
        {group.action ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">协议解析（内部）</p>
            <JsonTreeBlock value={group.action.action} />
          </div>
        ) : null}
      </div>
    );
  }

  if (group.type === "tool" && (group.started || group.completed)) {
    const completed = group.completed?.type === "tool" ? group.completed : undefined;
    const started = group.started?.type === "tool" ? group.started : undefined;
    const step = completed ?? started;
    if (!step) return <TraceDetails step={group.primary} />;

    return (
      <div className="mt-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-zinc-500">
            {completed ? "工具调用已完成" : "工具调用进行中"}
          </p>
          <DurationText durationMs={completed?.durationMs} />
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500">输入</p>
          <JsonTreeBlock value={step.toolInput} />
        </div>
        {completed ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">输出</p>
            <JsonTreeBlock value={completed.toolOutput} />
          </div>
        ) : null}
        {group.observation ? (
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500">写回模型的 observation（内部）</p>
            <RawCodeBlock>{group.observation.observation}</RawCodeBlock>
          </div>
        ) : null}
      </div>
    );
  }

  return <TraceDetails step={group.primary} />;
}

function groupPhaseLabel(group: TraceCardGroup) {
  if ((group.type === "model" || group.type === "tool") && group.completed) return "completed";
  return group.primary.phase;
}

function groupStepLabel(group: TraceCardGroup) {
  if (group.type === "skill") return "准备阶段";
  return `第 ${group.step} 步`;
}

function TraceCard({ group }: { group: TraceCardGroup }) {
  const [isOpen, setIsOpen] = useState(false);
  const isError = group.type === "error";
  const Icon =
    group.type === "tool"
      ? Wrench
      : group.type === "skill"
        ? Layers3
        : isError
          ? AlertCircle
          : BrainCircuit;

  return (
    <article className="relative pl-8">
      <span className="absolute left-[11px] top-8 h-[calc(100%-16px)] w-px bg-zinc-200" aria-hidden="true" />
      <span
        className={classNames(
          "absolute left-0 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full border",
          stepIconClass(group.type),
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
              <span className="text-xs font-medium text-zinc-500">{groupStepLabel(group)}</span>
              <span className={classNames("rounded-md border px-1.5 py-0.5 text-[11px] font-medium", stepBadgeClass(group.type))}>
                {group.type}
              </span>
              <span className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500">
                {groupPhaseLabel(group)}
              </span>
            </span>
            <span className="block truncate text-sm font-semibold text-zinc-950">{traceGroupTitle(group)}</span>
          </span>
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-500">
            {isOpen ? "收起" : "详情"}
          </span>
        </button>
        {isOpen ? <TraceGroupDetails group={group} /> : null}
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
  const [activeFilter, setActiveFilter] = useState<TraceFilter>("all");
  const summary = getTraceSummary(trace);
  const hasError = summary.error > 0;
  const traceGroups = groupTraceSteps(trace ?? []);
  const filteredTrace =
    activeFilter === "all" ? traceGroups : traceGroups.filter((group) => group.type === activeFilter);

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
        <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="轨迹过滤">
          {TRACE_FILTERS.map((filter) => {
            const count = getTraceFilterCount(trace, filter.id);
            const isActive = activeFilter === filter.id;
            const isDanger = filter.id === "error" && count > 0;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveFilter(filter.id)}
                className={classNames(
                  "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs font-medium transition",
                  isActive && !isDanger && "border-indigo-200 bg-indigo-50 text-indigo-700",
                  isActive && isDanger && "border-red-200 bg-red-50 text-red-700",
                  !isActive && "border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 hover:bg-white hover:text-zinc-950",
                )}
              >
                {count} {filter.label}
              </button>
            );
          })}
        </div>

        {filteredTrace.length ? (
          <div className="space-y-4">
            {filteredTrace.map((group) => (
              <TraceCard key={group.key} group={group} />
            ))}
          </div>
        ) : trace?.length ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm leading-6 text-zinc-600">
            当前过滤条件下没有轨迹。
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-sm leading-6 text-zinc-600">
            运行 Agent 后会记录读取技能、调用模型和调用工具。
          </div>
        )}
      </div>
    </aside>
  );
}

export default function BuilderPage() {
  const [state, setState] = useState<BuilderState>(DEFAULT_STATE);
  const [skills, setSkills] = useState<SkillOption[]>([]);
  const [skillsError, setSkillsError] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createResult, setCreateResult] = useState<CreateResult | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isConfigCollapsed, setIsConfigCollapsed] = useState(false);
  const [isTraceCollapsed, setIsTraceCollapsed] = useState(false);
  const [configWidth, setConfigWidth] = useState(DEFAULT_CONFIG_WIDTH);
  const [traceWidth, setTraceWidth] = useState(DEFAULT_TRACE_WIDTH);
  const [resizingPanel, setResizingPanel] = useState<ResizablePanel | null>(null);

  const traceSummary = getTraceSummary(runResult?.trace);
  const runStatus = runError
    ? "danger"
    : isRunning
      ? "active"
      : runResult
        ? "success"
      : "neutral";

  useEffect(() => {
    let isMounted = true;

    async function loadSkills() {
      try {
        const response = await fetch("/api/skills");
        const data = (await response.json()) as { skills?: SkillOption[]; error?: string };
        if (!response.ok) throw new Error(data.error ?? "技能加载失败");
        if (isMounted) {
          setSkills(data.skills ?? []);
          setSkillsError("");
        }
      } catch (error) {
        if (isMounted) {
          setSkillsError(error instanceof Error ? error.message : String(error));
        }
      }
    }

    void loadSkills();
    return () => {
      isMounted = false;
    };
  }, []);

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

  function toggleSkill(skillId: SkillOptionId) {
    setState((current) => {
      const selectedSkills = current.selectedSkills.includes(skillId)
        ? current.selectedSkills.filter((selectedSkill) => selectedSkill !== skillId)
        : [...current.selectedSkills, skillId];

      return { ...current, selectedSkills };
    });
  }

  async function runAgent() {
    setIsRunning(true);
    setRunError("");
    setRunResult({ answer: "", trace: [] });
    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data && typeof data === "object" && "error" in data && typeof data.error === "string"
            ? data.error
            : "运行失败",
        );
      }

      if (!response.body) {
        throw new Error("运行响应缺少流式内容");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      let trace: TraceStep[] = [];

      function applyEvent(event: RunStreamEvent) {
        if (event.type === "trace") {
          trace = [...trace, event.step];
          setRunResult({ answer, trace });
          return;
        }

        if (event.type === "final") {
          answer = event.answer;
          trace = event.trace;
          setRunResult({ answer, trace });
          return;
        }

        throw new Error(event.error);
      }

      function processLine(line: string) {
        const trimmed = line.trim();
        if (!trimmed) return;
        applyEvent(JSON.parse(trimmed) as RunStreamEvent);
      }

      for (;;) {
        const { done, value } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) processLine(line);
        }
        if (done) break;
      }

      buffer += decoder.decode();
      processLine(buffer);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsRunning(false);
    }
  }

  async function createProject() {
    setIsCreateDialogOpen(true);
    setIsCreating(true);
    setCreateError("");
    setCreateResult(null);
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

  function startResize(panel: ResizablePanel, event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;

    event.preventDefault();
    const startX = event.clientX;
    const startWidth = panel === "config" ? configWidth : traceWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    setResizingPanel(panel);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const controller = new AbortController();
    const resize = (pointerEvent: PointerEvent) => {
      const delta = pointerEvent.clientX - startX;
      if (panel === "config") {
        setConfigWidth(clampWidth(startWidth + delta, MIN_CONFIG_WIDTH, MAX_CONFIG_WIDTH));
        return;
      }
      setTraceWidth(clampWidth(startWidth - delta, MIN_TRACE_WIDTH, MAX_TRACE_WIDTH));
    };
    const stop = () => {
      setResizingPanel(null);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      controller.abort();
    };

    window.addEventListener("pointermove", resize, { signal: controller.signal });
    window.addEventListener("pointerup", stop, { once: true, signal: controller.signal });
    window.addEventListener("pointercancel", stop, { once: true, signal: controller.signal });
  }

  const layoutColumns = [
    isConfigCollapsed ? `${COLLAPSED_PANEL_WIDTH}px` : `${configWidth}px`,
    "minmax(0,1fr)",
    isTraceCollapsed ? `${COLLAPSED_PANEL_WIDTH}px` : `${traceWidth}px`,
  ].join(" ");
  const layoutStyle = { "--builder-layout-columns": layoutColumns } as CSSProperties;

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

          <div className="hidden min-w-0 flex-1 flex-wrap items-center justify-start gap-2 sm:flex lg:justify-center">
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
            <button
              type="button"
              onClick={createProject}
              disabled={isCreating}
              aria-label="生成项目"
              title="生成项目"
              className="inline-flex h-9 w-9 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-zinc-200 bg-white text-sm font-semibold text-zinc-950 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:text-zinc-400 sm:w-auto sm:px-3"
            >
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <FolderPlus className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{isCreating ? "生成中..." : "生成项目"}</span>
            </button>
          </div>
        </div>
      </header>

      <div
        data-testid="builder-layout"
        className={classNames(
          "grid grid-cols-1 gap-3 p-3 lg:grid-cols-[var(--builder-layout-columns)] lg:p-4",
          resizingPanel ? "select-none" : "transition-[grid-template-columns] duration-200",
        )}
        style={layoutStyle}
      >
        <div className="relative min-w-0">
          <ConfigSidebar
            state={state}
            skills={skills}
            skillsError={skillsError}
            isCollapsed={isConfigCollapsed}
            onToggleCollapse={() => setIsConfigCollapsed((current) => !current)}
            onFieldChange={updateField}
            onToggleTool={toggleTool}
            onToggleSkill={toggleSkill}
          />
          {!isConfigCollapsed ? (
            <ResizeHandle
              side="right"
              label="调整配置栏宽度"
              testId="config-resize-handle"
              onPointerDown={(event) => startResize("config", event)}
            />
          ) : null}
        </div>

        <div className="min-w-0 space-y-3">
          <PromptEditor state={state} isRunning={isRunning} onFieldChange={updateField} onRunAgent={runAgent} />
          <ObservationWorkspace runResult={runResult} runError={runError} />
        </div>

        <div className="relative min-w-0">
          <TraceSidebar
            trace={runResult?.trace}
            isCollapsed={isTraceCollapsed}
            isRunning={isRunning}
            onToggleCollapse={() => setIsTraceCollapsed((current) => !current)}
          />
          {!isTraceCollapsed ? (
            <ResizeHandle
              side="left"
              label="调整轨迹栏宽度"
              testId="trace-resize-handle"
              onPointerDown={(event) => startResize("trace", event)}
            />
          ) : null}
        </div>
      </div>
      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        isCreating={isCreating}
        createResult={createResult}
        createError={createError}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </main>
  );
}
