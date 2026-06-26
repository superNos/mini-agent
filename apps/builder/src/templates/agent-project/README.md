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
```

把你的模型密钥填在 `OPENAI_API_KEY` 后面。默认模型接口遵循 OpenAI 兼容对话协议。

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

在 `src/skills/` 中新增一个目录，并放入 `SKILL.md`。技能用于追加完整的行为说明，也可以声明依赖工具：

```text
src/skills/my-skill/
  SKILL.md
```

`SKILL.md` 的 frontmatter 示例：

```md
---
id: my-skill
name: 我的技能
description: 说明这个技能什么时候使用
tools:
  - calculator
---

# 我的技能

这里写完整的技能说明、使用条件、执行步骤和回答要求。
```

生成项目会把已选择技能解析进 `src/skills/index.ts`。如果你手动新增技能，也需要在 `src/skills/index.ts` 中注册解析后的技能对象。

当前版本默认不内置业务预设市场、角色型技能或网页搜索。这个项目保留的是智能体内核、扩展结构和本次选择的学习示例。
