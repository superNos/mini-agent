# mini-agent-builder 后续迭代路线图

## 定位约束

`mini-agent-builder` 后续可以稍微复杂一些，但复杂度必须服务于学习 Agent 内核，而不是变成通用 Agent 框架。

核心学习对象仍然是：

- Model：模型适配层如何接收 messages 并返回内容。
- Tool：工具如何通过 schema 暴露给模型调用。
- Skill：技能如何组合 Prompt 增量和工具依赖。
- Loop：模型、协议解析、工具执行、观察结果如何循环。
- Trace：每一步输入、输出、动作、错误如何被观察。

明确不做：

- 不引入 LangChain 或 LangGraph。
- 不做多 Agent 协作。
- 不做 RAG、长期记忆、插件市场、登录系统、云端部署。
- 不默认加入 `web-search`。
- 不展示模型隐藏推理或所谓深度思考链路。
- 不堆业务角色型预设技能。

## 当前 MVP 的主要不足

1. Agent Loop 过于压缩
   现在基本是“模型输出 JSON -> 解析 -> 调工具 -> observation -> 下一轮”。这条链能跑，但用户很难看清协议解析、动作选择、工具执行、observation 入队这些关键阶段。

2. 协议没有独立出来
   `tool/final` 动作协议、JSON 解析、协议提示词都在 `agent.ts` 内部。用户想学习 Agent 协议时，需要读主循环实现。

3. Trace 还是偏日志
   当前 Trace 已经有模型输入输出和工具输入输出，但缺少阶段、耗时、状态、解析结果、observation 生成等信息。

4. Skill 还只是空扩展点
   `selectedSkills` 目前被限制为空数组，用户还不能真正理解 Skill 如何影响 system prompt 和工具集合。

5. 生成项目的学习体验弱于 Builder
   Builder 右侧 Trace 已经可视化，但生成项目仍然偏简陋，Trace 主要以 JSON 形式展示。

## 迭代原则

- 先增强内核可观察性，再增加工具数量。
- 先让协议和 Loop 清晰，再扩展 Skill。
- 每个版本都要能独立运行、独立学习、独立测试。
- Builder 与生成项目的核心能力应逐步对齐。
- 新增复杂度必须能在 Trace 中被看见。

## 建议版本规划

### v1.1：协议化 Loop 与 Trace 时间线

目标：让用户看清模型输出如何变成动作，动作如何触发工具，工具结果如何回到下一轮 messages。

建议改动：

- 新增 `apps/builder/src/agent/protocol.ts`。
- 用 Zod 定义 `tool` 和 `final` action schema。
- 从 `agent.ts` 中移出协议提示词和模型输出解析逻辑。
- 扩展 Trace 类型，记录：
  - model started / completed
  - action parsed
  - tool started / completed
  - observation appended
  - final
  - error
- Trace UI 增加阶段、状态、耗时和解析结果展示。

测试重点：

- 合法 action 解析。
- 非 JSON 输出解析失败。
- 未知工具、非法工具输入、工具异常。
- observation 是否进入下一轮 model input。
- 流式 Trace 是否按阶段逐步出现。

### v1.2：真实 Skill 机制

目标：让用户理解 Skill 不是业务角色模板，而是 Prompt 增量和工具依赖的组合。

建议改动：

- 扩展 `Skill` 类型：
  - `id`
  - `name`
  - `description`
  - `systemPromptAddon`
  - `toolIds`
- 放开 `selectedSkills` 的长度限制。
- Builder 技能选择器读取技能注册表。
- 运行时把选中 Skill 的 prompt addon 合并进 system prompt。
- 生成项目复制选中的 skill 文件并写入 config。

测试重点：

- skill prompt 是否进入 model input。
- skill 依赖工具是否被正确挂载或提示。
- 生成项目是否包含选中 skill。

### v1.3：工具开发与调试体验

目标：让用户理解 Tool 是一个带 schema 的函数，而不是神秘插件。

建议改动：

- 工具元信息增加：
  - category
  - input example
  - output example
  - display name
- Builder 工具卡支持查看 schema 和示例。
- 增加工具单独试跑入口。
- README 增加“如何新建工具”的最小示例。

测试重点：

- 工具 schema 校验错误展示。
- 工具试跑接口只允许注册表工具，不允许执行任意代码。
- 新增工具能被 Builder 选择并生成到项目。

### v1.4：生成项目 Trace 能力对齐

目标：生成项目不是简陋 demo，而是一个独立可学习的小 Agent 应用。

建议改动：

- 将 Builder 的简化 Trace Viewer 抽成可复用组件或模板片段。
- 生成项目页面展示模型输入、协议解析、工具输入输出、最终答案。
- 生成项目 API 支持流式 Trace。
- 生成项目 README 解释关键文件入口。

测试重点：

- 生成项目 `npm run typecheck` 和 `npm run build`。
- 无 API Key 或模型错误时展示清晰错误。
- Trace Viewer 能展示 model/tool/final/error。

### v1.5：最小失败恢复机制

目标：让用户看到真实 Agent 为什么需要 guardrails，但不引入框架。

建议改动：

- ModelProvider 支持 timeout、temperature、metadata。
- invalid JSON 时可选做一次 repair retry。
- 错误类型分层：
  - provider
  - protocol
  - tool
  - maxSteps
- Builder 允许配置 `maxSteps` 和 `temperature`。

测试重点：

- provider error。
- invalid JSON repair 成功和失败。
- maxSteps 停止条件。
- timeout 取消。

## 推荐下一步

优先做 v1.1。

原因：现在项目显得简单，不是因为工具太少，而是 Agent Loop 的关键阶段被压缩在代码内部。先把协议解析、动作选择、工具执行、observation 入队、下一轮 messages 构造全部显性化，项目会立刻更像一个可学习的 Agent 内核，同时仍然保持克制，不会滑向复杂框架。
