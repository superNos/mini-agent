# 生成的迷你智能体

这个项目由 `mini-agent-builder` 生成，是一个可以独立运行的 Next.js 智能体项目。它包含智能体主循环、模型适配层、工具协议、执行轨迹记录、本次选择的工具和技能，以及一个最小聊天页面。

## 运行项目

```bash
npm install
cp .env.example .env.local
npm run dev
```

运行智能体前，在 `.env.local` 中设置：

```text
OPENAI_API_KEY=
OPENTRIPMAP_API_KEY=
```

把你的模型密钥填在 `OPENAI_API_KEY` 后面。`OPENTRIPMAP_API_KEY` 只在生成项目包含 `attraction-search` 工具时需要，用于调用 OpenTripMap 免费档景点接口；不配置时该工具会返回配置提示。

项目不依赖高德地图 API。

## 智能体组成

- 模型：统一的 OpenAI 兼容模型调用层。
- 工具：智能体可以调用的类型化函数。
- 技能：复用提示词增量和工具依赖的扩展点。
- 协议：模型必须返回 `tool` 或 `final` JSON action。
- 循环：模型调用、协议解析、工具执行、工具结果返回模型、继续循环。
- 执行轨迹：每次执行的模型输入输出、协议解析、工具输入输出、观察结果和最终答案记录，方便观察和调试。

## 添加工具

在 `src/tools/` 中新增工具文件，并在 `src/tools/index.ts` 注册。工具需要包含：

- `name`
- `description`
- `schema`
- `run(input)`

## 添加技能

在 `src/skills/` 中新增文件，导出一个技能对象，并在 `src/skills/index.ts` 注册。技能用于追加系统提示词，也可以声明依赖工具：

- `id`
- `name`
- `description`
- `systemPromptAddon`
- `toolIds`

当前版本默认不内置业务预设市场、角色型技能或网页搜索。这个项目保留的是智能体内核、扩展结构和本次选择的学习示例。
