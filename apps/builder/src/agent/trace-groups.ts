import type { TraceStep } from "./trace";

type ModelStartedTraceStep = Extract<TraceStep, { type: "model"; phase: "started" }>;
type ModelCompletedTraceStep = Extract<TraceStep, { type: "model"; phase: "completed" }>;
type ToolStartedTraceStep = Extract<TraceStep, { type: "tool"; phase: "started" }>;
type ToolCompletedTraceStep = Extract<TraceStep, { type: "tool"; phase: "completed" }>;

export type TraceCardGroup = {
  key: string;
  step: number;
  type: TraceStep["type"];
  steps: TraceStep[];
  primary: TraceStep;
  started?: ModelStartedTraceStep | ToolStartedTraceStep;
  completed?: ModelCompletedTraceStep | ToolCompletedTraceStep;
};

function traceGroupKey(step: TraceStep, index: number) {
  if (step.type === "model") return `${step.step}:model`;
  if (step.type === "tool") return `${step.step}:tool:${step.toolName}`;
  return `${index}:${step.step}:${step.type}`;
}

export function groupTraceSteps(steps: TraceStep[]) {
  const groups: TraceCardGroup[] = [];
  const groupIndexes = new Map<string, number>();

  steps.forEach((step, index) => {
    const key = traceGroupKey(step, index);
    const existingIndex = groupIndexes.get(key);

    if (existingIndex === undefined) {
      const group: TraceCardGroup = {
        key,
        step: step.step,
        type: step.type,
        steps: [step],
        primary: step,
      };

      if (step.type === "model" || step.type === "tool") {
        if (step.phase === "started") group.started = step;
        if (step.phase === "completed") {
          group.completed = step;
          group.primary = step;
        }
      }

      groupIndexes.set(key, groups.length);
      groups.push(group);
      return;
    }

    const group = groups[existingIndex];
    group.steps.push(step);
    if (step.type === "model" || step.type === "tool") {
      if (step.phase === "started") group.started = step;
      if (step.phase === "completed") {
        group.completed = step;
        group.primary = step;
      }
      return;
    }

    group.primary = step;
  });

  return groups;
}
