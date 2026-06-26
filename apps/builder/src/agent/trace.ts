import type { AgentMessage } from "./model";
import type { ModelAction } from "./protocol";
import type { Skill } from "./skill";

export type TraceStepType =
  | "skill"
  | "model"
  | "action"
  | "tool"
  | "observation"
  | "final"
  | "error";

export type TraceStep =
  | {
      step: number;
      type: "skill";
      phase: "loaded";
      loadedAt: string;
      skills: Skill[];
    }
  | {
      step: number;
      type: "model";
      phase: "started";
      startedAt: string;
      modelInput: AgentMessage[];
    }
  | {
      step: number;
      type: "model";
      phase: "completed";
      startedAt: string;
      completedAt: string;
      durationMs: number;
      modelInput: AgentMessage[];
      modelOutput: string;
    }
  | {
      step: number;
      type: "action";
      phase: "parsed";
      action: ModelAction;
      modelOutput: string;
    }
  | {
      step: number;
      type: "tool";
      phase: "started";
      toolName: string;
      toolInput: unknown;
      startedAt: string;
    }
  | {
      step: number;
      type: "tool";
      phase: "completed";
      toolName: string;
      toolInput: unknown;
      toolOutput: unknown;
      startedAt: string;
      completedAt: string;
      durationMs: number;
    }
  | {
      step: number;
      type: "observation";
      phase: "appended";
      toolName: string;
      observation: string;
      messages: AgentMessage[];
    }
  | {
      step: number;
      type: "final";
      phase: "completed";
      finalAnswer: string;
    }
  | {
      step: number;
      type: "error";
      phase: "failed";
      error: string;
      modelInput?: AgentMessage[];
      modelOutput?: string;
      action?: ModelAction;
      toolName?: string;
      toolInput?: unknown;
    };
