"use client";

import { useState } from "react";
import { AGENT_CONFIG } from "@/agent/config";
import type { TraceStep } from "@/agent/trace";

type AgentRunResult = {
  answer: string;
  trace: TraceStep[];
};

export default function Home() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  async function run() {
    const trimmedInput = input.trim();
    if (!trimmedInput || isRunning) return;

    setIsRunning(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/agent/run", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ input: trimmedInput }),
      });
      const json = (await response.json().catch(() => null)) as
        | AgentRunResult
        | { error?: string }
        | null;

      if (!response.ok) {
        setError(json && "error" in json && json.error ? json.error : "智能体请求失败");
        return;
      }

      if (!json || !("answer" in json) || !("trace" in json)) {
        setError("智能体返回格式无效");
        return;
      }

      setResult(json);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold text-gray-950">{AGENT_CONFIG.projectName}</h1>
          <p className="mt-2 text-sm text-gray-600">
            输入任务后，智能体会使用已配置的模型和工具运行，并返回回答与执行轨迹。
          </p>
        </div>

        <textarea
          aria-label="智能体输入"
          className="min-h-32 w-full resize-y rounded-md border border-gray-300 bg-white p-3 text-sm text-gray-950 outline-none focus:border-gray-950"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="想让智能体做什么？"
        />

        <button
          className="w-fit rounded-md bg-gray-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-400"
          disabled={isRunning || !input.trim()}
          onClick={run}
          type="button"
        >
          {isRunning ? "运行中..." : "运行智能体"}
        </button>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
            错误：{error}
          </p>
        ) : null}

        {result ? (
          <div className="flex flex-col gap-3">
            <section>
              <h2 className="mb-2 text-sm font-semibold text-gray-950">回答</h2>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-950">
                {result.answer}
              </pre>
            </section>
            <section>
              <h2 className="mb-2 text-sm font-semibold text-gray-950">执行轨迹</h2>
              <pre className="overflow-auto rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-950">
                {JSON.stringify(result.trace, null, 2)}
              </pre>
            </section>
          </div>
        ) : null}
      </section>
    </main>
  );
}
