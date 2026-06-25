export type TraceStepType = "model" | "tool" | "final" | "error";

export type TraceStep =
  | {
      step: number;
      type: "model";
      modelOutput: string;
    }
  | {
      step: number;
      type: "tool";
      toolName: string;
      toolInput: unknown;
      toolOutput: unknown;
    }
  | {
      step: number;
      type: "final";
      finalAnswer: string;
    }
  | {
      step: number;
      type: "error";
      error: string;
      modelOutput?: string;
      toolName?: string;
      toolInput?: unknown;
    };
