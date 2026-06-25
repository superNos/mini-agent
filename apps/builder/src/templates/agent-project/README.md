# Generated Mini Agent

这个项目由 `mini-agent-builder` 生成，是一个可以独立运行的 Next.js Web Agent 项目。它包含 Agent 主循环、模型适配层、工具协议、Trace 记录和一个最小聊天页面。

## 运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

运行 Agent 前，在 `.env.local` 中设置：

```text
OPENAI_API_KEY=your-api-key
```

默认模型接口遵循 OpenAI-compatible chat completion 协议。

## Agent 组成

- Model：统一的 OpenAI-compatible 模型调用层。
- Tool：Agent 可以调用的类型化函数。
- Skill：复用 Prompt 和工具组合的扩展点。
- Loop：模型输出、可选工具调用、工具结果返回模型、继续循环。
- Trace：每次执行的步骤记录，方便观察和调试。

## 添加工具

在 `src/tools/` 中新增工具文件，并在 `src/tools/index.ts` 注册。工具需要包含：

- `name`
- `description`
- `schema`
- `run(input)`

## 添加 Skill

在 `src/skills/` 中新增文件，导出一个 `Skill`，再把它的 `systemPromptAddon` 合并到 Agent 配置里。

MVP 默认不内置业务预设、角色型 Skill 或 web search。这个项目保留的是 Agent 内核和扩展结构。
