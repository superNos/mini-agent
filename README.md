# mini-agent-builder

`mini-agent-builder` 是一个可视化智能体内核创建器。用户可以在页面里配置模型接口、选择工具、编写系统提示词、试跑智能体、查看完整执行轨迹，并生成一个可以独立运行的 Next.js 智能体项目。

## 版本范围

已包含：

- OpenAI 兼容模型配置
- 系统提示词编辑器
- `calculator`、`current-time` 和旅行计划演示工具
- `arithmetic-check`、`time-awareness` 和 `travel-planner` 内核技能
- 页面试跑智能体
- 协议化 Agent Loop
- 阶段化执行轨迹可视化
- 生成项目到 `generated/<project-slug>/`

暂不包含：

- 网页搜索
- 智能体预设市场
- 内置角色型技能
- 检索增强生成
- 长期记忆
- 登录系统
- 云端部署

## 运行创建器

```bash
npm install
npm run dev
```

打开 `http://localhost:3000`。

## 生成项目

在创建器页面配置项目，点击“生成项目”。生成结果会写入：

```text
generated/<project-slug>/
```

生成后的项目是独立 Next.js 全栈项目，不依赖创建器运行。

## 智能体基本组成

- 模型：OpenAI 兼容的对话模型适配层。
- 工具：智能体可以调用的类型化函数。
- 技能：Prompt 增量和工具依赖的组合入口，当前版本只提供少量学习示例，不内置业务角色型技能。
- 协议：模型必须返回 `tool` 或 `final` JSON action。
- 循环：模型调用、协议解析、工具执行、观察结果入队、继续循环。
- 执行轨迹：每一步模型输入输出、协议解析、工具输入输出、观察结果、最终答案或错误的可视化记录。
