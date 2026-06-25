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
