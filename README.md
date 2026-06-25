# mini-agent-builder

`mini-agent-builder` 是一个可视化 Agent 内核创建器。它帮助用户在页面里配置模型、选择工具、编写 System Prompt、试跑 Agent、查看完整 Trace，并生成一个可以独立运行的 Next.js Web Agent 项目。

## MVP 范围

已包含：

- OpenAI-compatible 模型配置
- System Prompt 编辑器
- `calculator` 和 `current-time` 工具
- 空的 Skill 扩展点
- Agent 页面试跑
- Trace 可视化
- 生成项目到 `generated/<project-slug>/`

暂不包含：

- web search
- Agent 预设
- 内置角色型 Skill
- RAG
- 长期记忆
- 登录系统
- 云端部署

## 运行 Builder

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 生成项目

在 Builder 页面配置项目，点击 `Create Project`。生成结果会写入：

```text
generated/<project-slug>/
```

生成后的项目是独立 Next.js 全栈项目，不依赖 Builder 运行。

## Agent 基本组成

- Model：OpenAI-compatible chat completion 模型适配层。
- Tool：Agent 可以调用的类型化函数。
- Skill：可扩展的 Prompt 和工具组合入口，MVP 默认不内置业务 Skill。
- Loop：模型输出、可选工具调用、工具观察结果、继续循环。
- Trace：每一步模型输出、工具输入输出、最终答案或错误的可视化记录。
