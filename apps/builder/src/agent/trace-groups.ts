import type { TraceStep } from "./trace";

type SkillTraceStep = Extract<TraceStep, { type: "skill" }>;
type ModelStartedTraceStep = Extract<TraceStep, { type: "model"; phase: "started" }>;
type ModelCompletedTraceStep = Extract<TraceStep, { type: "model"; phase: "completed" }>;
type ActionTraceStep = Extract<TraceStep, { type: "action" }>;
type ToolStartedTraceStep = Extract<TraceStep, { type: "tool"; phase: "started" }>;
type ToolCompletedTraceStep = Extract<TraceStep, { type: "tool"; phase: "completed" }>;
type ObservationTraceStep = Extract<TraceStep, { type: "observation" }>;
type VisibleTraceStep =
  | SkillTraceStep
  | ModelStartedTraceStep
  | ModelCompletedTraceStep
  | ToolStartedTraceStep
  | ToolCompletedTraceStep
  | Extract<TraceStep, { type: "error" }>;

export type TraceCardGroup = {
  key: string;
  step: number;
  type: VisibleTraceStep["type"];
  steps: TraceStep[];
  primary: VisibleTraceStep;
  started?: ModelStartedTraceStep | ToolStartedTraceStep;
  completed?: ModelCompletedTraceStep | ToolCompletedTraceStep;
  action?: ActionTraceStep;
  observation?: ObservationTraceStep;
};

function traceGroupKey(step: TraceStep, index: number) {
  if (step.type === "skill") return `${step.step}:skill`;
  if (step.type === "model") return `${step.step}:model`;
  if (step.type === "tool") return `${step.step}:tool:${step.toolName}`;
  return `${index}:${step.step}:${step.type}`;
}

function attachInternalStep(
  groupIndexes: Map<string, number>,
  groups: TraceCardGroup[],
  step: ActionTraceStep | ObservationTraceStep,
) {
  const key =
    step.type === "action" ? `${step.step}:model` : `${step.step}:tool:${step.toolName}`;
  const groupIndex = groupIndexes.get(key);
  if (groupIndex === undefined) return;

  const group = groups[groupIndex];
  group.steps.push(step);
  if (step.type === "action") {
    group.action = step;
    return;
  }
  group.observation = step;
}

export function groupTraceSteps(steps: TraceStep[]) {
  const groups: TraceCardGroup[] = [];
  const groupIndexes = new Map<string, number>();

  steps.forEach((step, index) => {
    if (step.type === "action" || step.type === "observation") {
      attachInternalStep(groupIndexes, groups, step);
      return;
    }

    if (step.type === "final") return;

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
