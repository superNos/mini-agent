# mini-agent-builder 设计文档

## 项目定位

`mini-agent-builder` 是一个开源的可视化 Agent 内核创建工具。它帮助用户配置模型、选择内核级工具、编写 System Prompt、在页面中试跑一个小型 Agent、查看完整 Trace，并生成一个可以独立运行的 Next.js Web Agent 项目。

这个产品不是 Agent 模板市场，也不内置业务角色预设。生成出来的 Agent 由用户自己的 System Prompt、选择的工具，以及未来扩展的 Skill 决定。

## 目标

- 快速创建一个完整 Web Agent 项目。
- 帮用户理解 Agent 的基本组成：Model、Tool、Skill、Loop、Trace。
- 生成的项目可以脱离 Builder 独立运行。
- 每次 Agent 执行都能展示完整 Trace。
- Agent Core 足够小，学习者可以直接读懂。

## MVP 不做什么

- 登录、账号系统或云端部署。
- RAG、长期记忆或多 Agent 协作。
- Web search。
- 插件市场。
- 复杂权限系统。
- 业务预设，例如 planner、researcher、interview coach、support agent。
- 内置角色型 Skill。

## 已确认的产品决策

- MVP 使用一个单独的 Next.js Builder 应用。
- 项目生成到 `generated/<project-slug>/`。
- 不持久化 API key。
- 不把真实 API key 注入生成项目。
- 只内置 `calculator` 和 `current-time` 两个工具。
- 保留 Skill selector，但展示空状态：当前没有安装 Skill。
- 在生成项目中保留 Skill 协议，作为扩展点。
- Builder 页面使用三栏工作台布局。
- 使用简单 JSON 模型输出协议，不依赖特定 SDK 的 tool calling。

## Builder UI

主页面是三栏工作台。

### 左侧面板：Agent Setup

- 项目名称和 slug。
- 模型配置：
  - `baseUrl`
  - `model`
  - `apiKey`
- 工具选择：
  - `calculator`
  - `current-time`
- Skill 选择：
  - MVP 中展示空状态
  - 只说明这里是扩展点
- `Create Project` 按钮。

### 中间面板：Prompt And Trial Run

- System Prompt 编辑器。
- 用户任务输入框。
- `Run Agent` 按钮。
- 最终回答预览。
- 项目生成成功后的路径展示。

### 右侧面板：Trace Explorer

展示每次运行的执行步骤：

- model output
- selected tool
- tool input
- tool output
- final answer
- errors

主流程固定为：

```text
Configure -> Run -> Inspect Trace -> Generate
```

## Builder 后端

Builder 后端只需要两个核心 API。

### `POST /api/agent/run`

用于在 Builder 页面内试跑 Agent。

请求字段：

- `baseUrl`
- `apiKey`
- `model`
- `systemPrompt`
- `selectedTools`
- `selectedSkills`
- `userInput`

行为：

- 使用 Zod 校验请求。
- 基于本次请求中的模型配置创建 model provider。
- API key 只在本次请求中使用。
- 从 registry 加载已选择工具。
- 从 registry 加载已选择 Skill；MVP 中为空。
- 使用较小的 `maxSteps` 运行 Agent Loop。
- 返回最终回答和 trace。

响应结构：

```ts
{
  answer: string;
  trace: TraceStep[];
}
```

### `POST /api/projects/create`

用于生成一个独立项目。

请求字段：

- `projectName`
- `projectSlug`
- `baseUrl`
- `model`
- `systemPrompt`
- `selectedTools`
- `selectedSkills`

行为：

- 校验项目名称和 slug。
- 拒绝不安全 slug 和路径穿越。
- 如果输出目录已存在，则拒绝生成。
- 复制 Agent 项目模板。
- 写入 `src/agent/config.ts`。
- 复制被选择的工具实现。
- 保留 `src/skills/` 作为空扩展点。
- 生成 `.env.example`。
- 生成 `README.md`。
- 返回生成路径和下一步命令。

API key 永远不写入磁盘。

## Builder 共享模块

Builder 使用共享定义，避免页面试跑和生成项目之间出现行为漂移。

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

Agent Core 是一个可读的小循环：

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

### 模型输出协议

模型必须返回下面两种 JSON 之一。

工具调用：

```json
{
  "type": "tool",
  "toolName": "calculator",
  "toolInput": {
    "expression": "1 + 2"
  }
}
```

最终回答：

```json
{
  "type": "final",
  "answer": "The result is 3."
}
```

这样 MVP 可以兼容 OpenAI-compatible chat completion provider，不依赖某个 provider 专属的 tool calling 能力。

### 停止条件

- 模型返回 final answer。
- 达到 `maxSteps`。
- 模型返回无效 JSON。
- 模型请求了不存在的工具。
- 工具 input 没通过 schema 校验。
- 工具执行失败。
- provider 请求失败。

## Trace

Trace 的目标是学习和调试。Agent Loop 中每个关键转移都要被记录。

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

错误既要在 UI 中可见，也要包含在 trace 中。

## Tools

MVP 工具：

```text
calculator
current-time
```

MVP 不包含 `web-search` 工具。

### Calculator

用途：

- 展示 schema 校验和确定性工具执行。

输入：

```ts
{
  expression: string;
}
```

输出：

```ts
{
  result: number;
}
```

实现不能执行任意 JavaScript。它只应该支持一个很小的四则运算表达式语法。

### Current Time

用途：

- 展示一个不依赖用户输入、从运行时状态产生 observation 的工具。

输入：

```ts
{}
```

输出：

```ts
{
  iso: string;
  locale: string;
  timezone: string;
}
```

## Skills

Skill 是协议和项目扩展点，不是内置业务行为。

MVP Builder 行为：

- 展示 Skill selector。
- 显示 `No skills installed yet`。
- 不包含角色型 Skill。

生成项目行为：

- 包含 `src/agent/skill.ts`。
- 包含空的 `src/skills/` 目录。
- 在 README 中说明如何添加 Skill。

## Template Generator

模板源目录：

```text
apps/builder/src/templates/agent-project/
```

生成输出目录：

```text
generated/<project-slug>/
```

生成项目包含：

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

生成器会写入：

- project name
- project slug
- base URL
- model
- system prompt
- selected tool IDs
- selected skill IDs，MVP 中为空

生成器永远不会写入：

- 真实 API key
- 试跑消息
- trace 历史
- 业务 Agent preset
- 角色型 Skill

## 生成项目

生成项目是一个完整 Next.js 应用。它可以被复制、提交，并且不依赖 Builder 独立运行。

运行命令：

```bash
npm install
npm run dev
```

生成项目 UI 包含：

- chat/task 输入框
- final answer 展示
- trace 展示
- 本地 API route：`/api/agent/run`

生成项目 API 从环境变量读取模型凭证。

## 错误处理

Builder 和生成项目都应该给出清晰错误：

- 缺少 API key
- 无效 base URL
- provider 请求失败
- 模型输出不是合法 JSON
- 未知工具
- 无效工具 input
- 工具执行失败
- 达到 max steps
- project slug 校验失败
- 输出目录已存在
- 文件复制或写入失败

每个 Agent 执行错误都应该进入 Trace。

## 测试策略

核心测试覆盖：

- tool registry 能返回被选择的工具
- calculator 能校验 input 并执行支持的四则运算
- current-time 返回稳定对象结构
- Agent 遇到 final output 会停止
- Agent 能执行 tool call 并记录 tool trace
- Agent 遇到无效 JSON 会返回 error trace
- Agent 遇到未知工具会返回 error trace
- generator 能创建必要文件
- generator 不会写入真实 API key
- project slug 校验会拒绝不安全路径

## MVP 验收标准

- Builder 可以通过 `npm run dev` 启动。
- Builder 页面可以配置 model、tools、system prompt 和 user input。
- Builder 试跑会返回 answer 和 trace。
- Builder trace 能展示 model、tool、final 和 error 步骤。
- `Create Project` 可以生成 `generated/<project-slug>/`。
- 生成项目不包含真实 API key。
- 生成项目可以通过 `npm install && npm run dev` 独立运行。
- 生成项目可以执行 Agent，并展示 trace。
- README 能讲清 Model、Tool、Skill、Loop 和 Trace。

