# 生成的迷你智能体

这个项目由 `mini-agent-builder` 生成，是一个可以独立运行的 Next.js 智能体项目。它包含智能体主循环、模型适配层、工具协议、执行轨迹记录和一个最小聊天页面。

## 运行项目

```bash
npm install
cp .env.example .env.local
npm run dev
```

运行智能体前，在 `.env.local` 中设置：

```text
OPENAI_API_KEY=
```

把你的密钥填在等号后面。默认模型接口遵循 OpenAI 兼容对话协议。

## 智能体组成

- 模型：统一的 OpenAI 兼容模型调用层。
- 工具：智能体可以调用的类型化函数。
- 技能：复用提示词和工具组合的扩展点。
- 循环：模型输出、可选工具调用、工具结果返回模型、继续循环。
- 执行轨迹：每次执行的步骤记录，方便观察和调试。

## 添加工具

在 `src/tools/` 中新增工具文件，并在 `src/tools/index.ts` 注册。工具需要包含：

- `name`
- `description`
- `schema`
- `run(input)`

## 添加技能

在 `src/skills/` 中新增文件，导出一个技能对象，再把它的 `systemPromptAddon` 合并到智能体配置里。

当前版本默认不内置业务预设、角色型技能或网页搜索。这个项目保留的是智能体内核和扩展结构。
