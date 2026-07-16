# 纯问答模式 Demo — 项目详解

> 本文档详细介绍 pure-qa-demo 的项目结构、架构设计、核心组件和数据流。pure-qa-demo 是一个聚焦**语音对话 / 文本问答 / 文字转语音**三种交互模式的极简数字人演示应用，无 DevTools、无 Widget 渲染、无复杂布局切换。

---

## 一、项目目录结构

```
apps/pure-qa-demo/
├── index.html                    # Vite 入口
├── package.json                  # 项目依赖 + 脚本
├── vite.config.ts                # Vite 配置（端口 3001，@ 别名）
├── tsconfig.json                 # TypeScript 配置
├── env.d.ts                      # 类型声明
├── .env                          # 环境变量（本地开发，不提交 git）
├── .env.example                  # 环境变量模板（提交 git）
│
└── src/
    ├── main.ts                   # Vue 应用入口
    ├── App.vue                   # 根组件（核心编排，~500 行）
    │
    ├── assets/
    │   └── style.css             # 全局样式
    │
    ├── components/               # 组件（4 个）
    │   ├── ConfigPanel.vue           # 右上角浮动配置面板
    │   ├── CredentialModal.vue       # 凭证输入弹窗（ModelScope/OSS 部署用）
    │   ├── ErrorToast.vue            # SDK 错误提示 Toast
    │   └── SubtitleDisplay.vue       # 字幕显示组件
    │
    ├── composables/              # 组合式函数（2 个）
    │   ├── useSDK.ts                 # SDK 生命周期 + 实例管理
    │   └── useSubtitle.ts            # 字幕状态管理
    │
    ├── config/                   # 配置文件
    │   ├── credentials.ts            # SDK 凭证 + 网关地址
    │   └── personas.ts               # 人设配置（3 种人设 + System Prompt）
    │
    ├── types/
    │   └── index.ts                  # AppMode 类型定义
    │
    └── utils/
        ├── env.ts                    # 环境变量读取（兼容运行时注入）
        └── xml.ts                    # XML 转义工具（SSML 安全）
```

**依赖关系**（外部 workspace 包）：

```
@xmov/sdk-core  ← App.vue 中 formatSdkError 使用
@xmov/asr       ← App.vue 中 useASR() 使用
@xmov/llm       ← App.vue 中 createLLMClient() 使用
```

这三个都是 monorepo workspace 依赖（`"workspace:*"`），直接指向 TS 源码，不需要 build 即可生效。

---

## 二、架构总览

### 2.1 三层架构

```
视图层（Components）        ← 用户交互、UI 渲染
    ↕ (props/emit, ref/expose)
逻辑层（Composables）       ← 状态管理、SDK 封装、字幕管理
    ↕ (window.XmovAvatar / @xmov/llm / @xmov/asr)
服务层（SDK + LLM + ASR）   ← 3D 渲染、TTS、口型、语音识别、大模型
```

### 2.2 三种交互模式

pure-qa-demo 最核心的设计是三种互斥的交互模式，通过 `ConfigPanel` 中的 `mode-tabs` 切换，由 `appMode` 驱动 `App.vue` 的 UI 展示和行为逻辑：

```
┌──────────────────────────────────────────────────────────────────────┐
│                           App.vue (appMode)                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  模式 1: voice（语音交互）                                             │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  │ 用户语音   │ → │ ASR 识别  │ → │ LLM 生成  │ → │ SDK 播报  │       │
│  │ (麦克风)    │    │ (腾讯)    │    │ 回答文本   │    │ (TTS+3D) │       │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘       │
│                                                                      │
│  模式 2: text-qa（文本问答）                                           │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                       │
│  │ 用户输入   │ → │ LLM 生成  │ → │ SDK 播报  │                       │
│  │ 文字问题   │    │ 回答文本   │    │ (TTS+3D) │                       │
│  └──────────┘    └──────────┘    └──────────┘                       │
│                                                                      │
│  模式 3: tts（语音播报）                                               │
│  ┌──────────┐    ┌──────────┐                                       │
│  │ 用户输入   │ → │ SDK 播报  │                                       │
│  │ 任意文字   │    │ (TTS+3D) │                                       │
│  └──────────┘    └──────────┘                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**三种模式的本质区别**：

| 特性 | voice | text-qa | tts |
|-|-|-|-|
| 输入方式 | 麦克风（ASR 语音识别） | 键盘（文字输入框） | 键盘（文字输入框） |
| LLM 调用 | 需要（ASR 转写后经 LLM） | 需要（文字经 LLM 生成回答） | 不需要（文字直接播报） |
| SDK 播报 | 需要（播报 LLM 回答） | 需要（播报 LLM 回答） | 需要（播报用户输入的原文） |
| 按钮文案 | "点击开始语音对话" | 输入框 placeholder + "提问" | 输入框 placeholder + "播报" |
| 所需凭证 | SDK + LLM + ASR | SDK + LLM | SDK |

### 2.3 ASR → LLM → SDK 全链路详解

以 **voice（语音交互）** 模式为例，完整的音频→数字人播报管线如下：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                             用户语音输入                                  │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ 麦克风音频流
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  @xmov/asr (useASR)                                                     │
│  腾讯实时语音识别 WebSocket 连接                                          │
│  start(appId, secretId, secretKey)                                      │
│      ↓                                                                  │
│  WebSocket 接收识别结果                                                  │
│  onResult(text, isFinal)                                                │
│      ↓                                                                  │
│  isFinal=true → 最终识别结果                                             │
│  isFinal=false → 中间结果（实时显示在 ASR 文字浮层 asr-text-overlay）     │
│  isFinal=true 且 text 为空 → 服务端静默断开，自动重连                      │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ 最终识别文本
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  App.vue: #askLLM(text)                                                 │
│      ↓                                                                  │
│  chatWithLLM(userMessage)                                               │
│      ↓                                                                  │
│  @xmov/llm: createLLMClient({ apiKey, endpoint, model })                │
│      ↓                                                                  │
│  client.chat(text, systemPrompt)                                        │
│      ↓                                                                  │
│  DashScope OpenAI 兼容 API：POST /compatible-mode/v1/chat/completions   │
│      ↓                                                                  │
│  返回 LLM reply 文本                                                     │
│      ↓                                                                  │
│  llmThinking = false                                                    │
└──────────────────────────────────┬──────────────────────────────────────┘
                                   │ LLM 回答文本
                                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  App.vue: #speak(text)                                                  │
│      ↓                                                                  │
│  useSDK.speak(text)                                                     │
│      ↓                                                                  │
│  escapeXml(text) → 防止特殊字符破坏 SSML 结构                            │
│      ↓                                                                  │
│  sdk.speak(`<speak>${escapeXml(text)}</speak>`, true, true)             │
│      ↓                                                                  │
│  SDK 内部：TTS → 口型同步 → 3D 渲染                                     │
│      ↓                                                                  │
│  proxyWidget.subtitle_on / subtitle_off                                 │
│      ↓                                                                  │
│  subtitleText → 底部字幕栏显示                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

**关键时序点**：

1. 用户点击"点击开始语音对话" → 调用 `startCall()`
2. `useASR.start()` → 腾讯云 WebSocket 建立连接
3. ASR 持续返回中间结果 → 显示在 `asr-text-overlay` 浮层
4. ASR 返回 `isFinal=true` → 自动调用 `askLLM(text)` → 传入 LLM
5. LLM 返回回答 → 自动调用 `speak(reply)` → 数字人播报
6. 播报期间可继续说话 → ASR 最终结果触发新一轮 LLM → 自动打断当前播报（`handleInterrupt()`→ `interrupt()` + `idle()`）

---

## 三、核心组件详解

### 3.1 App.vue — 根组件

整个应用的单文件容器，全部逻辑在 `<script setup>` 中，职责：

- **模式管理**：维护 `appMode` 状态（ref），控制输入/输出 UI 切换
- **凭证管理**：支持三种部署场景的凭证配置（本地开发 / ModelScope / OSS）
- **SDK 生命周期**：通过 `useSDK('#avatar-canvas')` 管理初始化、说话、打断、销毁
- **ASR 生命周期**：通过 `@xmov/asr` 的 `useASR()` 管理语音识别启停
- **LLM 调用**：通过 `@xmov/llm` 的 `createLLMClient()` 调用大模型
- **人设切换**：维护 `selectedPersona`，LLM 调用时传入对应的 system prompt
- **试用计时**：ModelScope 部署场景下的试用倒计时逻辑

**关键数据流代码片段**：

```ts
const appMode = ref<AppMode>('voice')          // 当前模式
const selectedPersona = ref('advisor')          // 当前人设
const textInput = ref('')                       // 文本输入
const subtitleText = ref('')                    // 字幕文本（来自 SDK proxyWidget）
const llmThinking = ref(false)                  // LLM 思考中
const isCalling = ref(false)                    // 语音通话中

// 模式切换 → 结束语音
watch(appMode, (mode) => {
  if (mode !== 'voice' && isCalling.value) endCall()
})

// SDK 销毁 → 结束语音
watch(isInitialized, (v) => {
  if (!v) endCall()
})
```

**三种部署场景的凭证策略**：

| 场景 | 检测条件 | 凭证输入方式 | 试用计时 |
|-|-|-|-|
| 本地开发 | `!isModelScopeMode && !isOSSDeploy` | ConfigPanel 表单输入 | 无 |
| ModelScope | `window.__ENV__` 存在或 `VITE_MODELSCOPE_PREVIEW=true` | CredentialModal 弹窗 | 有（`VITE_TRIAL_SECONDS`） |
| OSS 部署 | `import.meta.env.PROD && !isModelScopeMode` | CredentialModal 弹窗 | 无 |

**BEGIN_MODELSCOPE_CRED / END_MODELSCOPE_CRED 标记**：

这是一段魔搭部署时的特殊处理逻辑。魔搭部署脚本（`deploy-modelscope.cjs`）在处理 `App.vue` 时会查找并移除这两个标记之间的代码块，将凭证逻辑替换为魔搭环境注入的方式。开发者维护代码时需要注意：标记块内的代码与块外的代码是相互依赖的 —— 移除了弹窗逻辑后，还需要确保 `sdkAppId` 的初始值来自环境变量而非弹窗。

被标记块包裹的内容包括：

- `import CredentialModal` 语句
- 凭证弹窗的显隐、试用计时相关逻辑（`showCredModal`、`trialExpired`、`credConnecting`、`credError`、`TRIAL_SECONDS`、`_trialTimer`）
- `onCredentialConnect` 方法
- `onUnmounted` 中的 `clearInterval(_trialTimer)`
- 模板中的 `<CredentialModal>` 标签
- `window.__youlingUi` 的 showCredModal 方法

### 3.2 ConfigPanel.vue — 配置面板

右上角浮动面板，点击"配置"按钮展开/收起。

**组件结构**：

```
┌──────────────────────────┐
│  [●] 配置/收起             │
├──────────────────────────┤
│  模式切换                  │
│  [语音交互] [文本问答] [语音播报] │
├──────────────────────────┤
│  数字人驱动（仅本地开发）     │
│  APP ID: [___________]    │
│  APP SECRET:[___________] │
│  ▼ 如何获取凭证？           │
│  [初始化数字人] [断开]      │
├──────────────────────────┤
│  人设切换                  │
│  [下拉选择]                │
└──────────────────────────┘
```

**职责与数据流**：

- **模式切换**：三个 tab 按钮，emit `update:appMode`
- **人设切换**：下拉选择（理财顾问咨询 / 萌宠医师 / 书籍推荐官），emit `update:selectedPersona`
- **SDK 凭证编辑**（本地开发场景）：APP ID + APP SECRET 输入框；包含"如何获取凭证"帮助区域（邀请码复制、魔珐星云官网链接）
- **初始化/销毁**：初始化按钮（显示下载进度百分比）和断开连接按钮

**不受外部管理的内容**：面板自身的展开/收起状态（`configOpen` 内部 ref），邀请码复制反馈（`copied` 内部 ref）。

**状态指示器**：面板按钮左侧的小圆点颜色表示 SDK 连接状态 —— 灰色 = 未连接，蓝色闪烁 = 加载中，绿色 = 已就绪。

### 3.3 CredentialModal.vue — 凭证弹窗

ModelScope / OSS 部署场景的凭证配置入口，全屏遮罩弹窗。

**模板结构**：

```
┌────────────────────────────────────┐
│        设置参数                      │
├────────────────────────────────────┤
│ 如何获取 APP ID 和 Secret？          │
│ 1. 登录魔珐星云官网                    │
│ 2. 注册并登录                         │
│ 3. 邀请码：[code 📋]（注册时填入可获积分） │
│ 4. 在"应用管理"中创建横屏应用            │
│ 5. 复制 APP ID 和 APP SECRET          │
├────────────────────────────────────┤
│ XingYun APP ID  [_______________]   │
│ XingYun SECRET [_______________]    │
├────────────────────────────────────┤
│          [取消]    [连接数字人]        │
└────────────────────────────────────┘
```

**关键设计**：

- `visible` prop 由 `App.vue` 控制显隐（满足三种场景：起始无凭证、试用过期重新弹出、`__youlingUi.showCredModal()` 唤起）
- `onCredentialConnect` 回调中执行：`destroy()` 旧 SDK → `init()` 新凭证 → 成功则关闭弹窗 + 播报"你好" + 启动试用计时
- 连接失败时显示错误信息，保持弹窗打开，不清空已填内容
- `trialExpired` 变化时清空表单内容，防止用户直接点击连接复用过期凭证
- 表单初始值从环境变量读取：`env('VITE_APP_ID')` / `env('VITE_APP_SECRET')`

### 3.4 SubtitleDisplay.vue — 字幕显示

通过 `TransitionGroup` 展示当前正在说和已经说过的字幕行。不同于 `App.vue` 中直接展示文本的 `subtitle-bar`，这个组件接收 `useSubtitle()` 的 `lines`，展示带有状态切换动画的字幕。

**核心特性**：

- 最多展示 3 条字幕行
- 最新一行状态为 `speaking`（黑色半透明背景 + 白色文字 + 闪烁光标）
- 之前已说完的行状态为 `done`（半透明灰色文字，无背景）
- 当新一行出现时，旧行平滑下滑
- 使用 `TransitionGroup` 实现进入/离开/移动动画（`.sub-line-enter-active` / `.sub-line-leave-active` / `.sub-line-move`）

**当前使用情况**：`SubtitleDisplay` 组件已定义但 `App.vue` 模板中未实际引用。`App.vue` 通过 `subtitleText` ref 自行渲染底部字幕栏（`.subtitle-bar`），走的是 SDK `proxyWidget.subtitle_on` 回调路径，而非 `useSubtitle` composable。`useSubtitle` 和 `SubtitleDisplay` 是保留的字幕自渲染方案，未来可能替换掉 SDK 内置字幕。

### 3.5 ErrorToast.vue — 错误提示

全局错误 Toast 组件，通过 `Teleport to="body"` 渲染，支持堆叠显示。

**特性**：

- 最多保留 5 条错误记录（`slice(-4)` 取末 4 条 + 新推 1 条）
- 每条 Toast 5 秒自动消失，可点击手动关闭
- 使用 `TransitionGroup` 实现列表进入/离开动画（`.toast-enter-active` / `.toast-leave-active`）
- 通过 `defineExpose({ show })` 暴露调用方法

**调用方式**：

```ts
const errorToast = ref<InstanceType<typeof ErrorToast>>()
// SDK onMessage 回调中调用
errorToast.value?.show(formatSdkError(data))
```

---

## 四、Composables 详解

### 4.1 useSDK.ts — SDK 生命周期管理

对 `window.XmovAvatar` 的轻量封装（~87 行），不包含 lite-sdk-demo 中的 SSML 校验、行走系统、性能统计等复杂逻辑。

**对外暴露**：

```ts
const {
  isInitialized,        // Ref<boolean> — SDK 是否就绪
  isInitializing,       // Ref<boolean> — 是否正在初始化
  downloadProgress,     // Ref<number> — 资源下载进度 0-100
  initError,            // Ref<string> — 初始化错误信息
  init,                 // async (options) => Promise<boolean>
  speak,                // (text: string) => void
  interrupt,            // () => void
  destroy,              // () => void
  getSdk,               // () => SDK 实例 | null
} = useSDK('#avatar-canvas')
```

**`init()` 参数说明**：

```ts
interface InitOptions {
  appId: string
  appSecret: string
  gatewayServer: string
  proxyWidget?: Record<string, (data: any) => void>  // 订阅 SDK Widget/字幕回调
  onMessage?: (data: any) => void                      // SDK 消息回调
  onSpeakEnd?: () => void                               // 播报结束回调
}
```

**内部状态机**：

```
未初始化 → isInitializing = true → 下载资源（onDownloadProgress） → isInitialized = true
                              ↓ 初始化失败
                          initError = 错误信息
```

**`buildSDKConfig()` 内部函数**：构建 SDK 初始化配置对象，将 `onSpeakEnd` 绑定到 `onSpeakStateChange`（`speak_end` 状态），将 `proxyWidget` 和 `onMessage` 直传。

**speak() 的 SSML 包裹逻辑**（最容易踩坑的点）：

```ts
function speak(text: string) {
  // 使用 escapeXml 防止特殊字符破坏 XML 结构
  sdk.value?.speak(`<speak>${escapeXml(text)}</speak>`, true, true)
}
```

`escapeXml` 转义 `&`、`<`、`>` 三个字符，确保 SDK 的 XML 解析器不会将用户/LLM 输入中的尖括号误判为 SSML 标签。如果 LLM 回答中包含 `<` 或 `>`，未转义的话 SD KTTS 会静默失败。

**destroy() 的销毁顺序**（与 SDK 强制要求一致）：

```ts
// 这个顺序不能错
sdk.interrupt('user')     // 1. 先打断播报
sdk.offlineMode()          // 2. 再下线
sdk.destroy()              // 3. 最后销毁
sdk = null                 // 4. 清空引用
isInitialized = false      // 5. 更新状态
window.__xmovSdk = null    // 6. 清空全局引用
```

### 4.2 useSubtitle.ts — 字幕状态管理

管理字幕行的显示状态，支持逐字更新的 speaking 行和已完成的 done 行。

**对外暴露**：

```ts
const {
  lines,            // Ref<SubtitleLine[]> — 所有字幕行
  visibleLines,     // ComputedRef<SubtitleLine[]> — 可见的行（取最后 3 条）
  isSpeaking,       // Ref<boolean> — 是否正在播报
  onSubtitle,       // (text: string) => void — 字幕回调
  onSpeakEnd,       // () => void — 播报结束回调
  clear,            // () => void — 清空
} = useSubtitle()
```

**SubtitleLine 类型**：

```ts
interface SubtitleLine {
  id: number
  text: string
  status: 'speaking' | 'done'
}
```

**更新策略**：

```
onSubtitle(text) 被调用时：
  1. 如果最后一行状态为 speaking → 直接更新其文本（逐字刷新效果）
  2. 否则 → 新加一行 speaking 行，上一行 speaking 标记为 done
  3. 如果总行数超过 MAX_LINES（3）→ 移除最早的行

onSpeakEnd() 被调用时：
  1. 将当前 speaking 行标记为 done
```

**当前使用情况**：`useSubtitle` 和 `SubtitleDisplay` 是保留方案，当前 `App.vue` 走的是内置字幕路径：

```ts
// SDK proxyWidget 直接更新 subtitleText ref
const sdkProxyWidget = {
  subtitle_on(d: any) {
    const text = d?.data?.text ?? d?.text ?? ''
    if (text) subtitleText.value = text
  },
  subtitle_off() {
    subtitleText.value = ''
  },
}
```

两种字幕方案的对比：

| 方案 | 数据来源 | 渲染方式 | 已实现 |
|-|-|-|-|
| 内置字幕（当前使用） | SDK proxyWidget subtitle_on | App.vue 模板中的 `.subtitle-bar` | 是 |
| 自渲染字幕 | useSubtitle composable | SubtitleDisplay 组件（TransitionGroup） | 组件已定义，但模板未引用 |

---

## 五、配置文件说明

### 5.1 credentials.ts — 数字人凭证

```ts
export const SDK_GATEWAY = 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session'

export async function getSDKCredentials(_inviteCode: string): Promise<{ appId: string; appSecret: string }>
```

当前 `getSDKCredentials` 为占位实现，返回环境变量中的凭证。TODO 标记表明上线前需要替换为真实的魔搭 API 调用。`SDK_GATEWAY` 是固定的数字人网关地址，所有演示应用共用这个值。

### 5.2 personas.ts — 人设配置

三种人设，每种包含 `id`、`name`、`description` 和 `systemPrompt`：

| 人设 ID | 名称 | 场景 | 回复字数限制 |
|-|-|-|-|
| `advisor` | 理财顾问咨询 | 银行营业厅智能经理，解答金融问题、防诈骗 | ≤ 80 字 |
| `vet` | 萌宠医师 | 宠物健康养护专家，病症解读、食疗护理 | ≤ 300 字 |
| `bookworm` | 书籍推荐官 | 书籍筛选推荐，根据需求匹配书籍 | ≤ 300 字 |

**三个 System Prompt 的共同约束**：

1. 禁止输出 Markdown 标记符号（`**`、`*`、`#`、`-`、`>`、``` 等）
2. 尽量不使用 emoji；如果使用，emoji 后必须有标点
3. 不暴露自身使用的大模型
4. **话题独立性**：用户提出新问题时，必须直接回答新问题，不能关联上一轮场景

**各人设独特的 System Prompt 设计**：

- **advisor**（理财顾问咨询）：包含隐私熔断机制（银行卡号/密码立即打断）、防诈骗雷达（安全账户/公检法）、比喻大师（用生活化比喻解释金融概念）；附 3 组 Few-Shot 对话示例
- **vet**（萌宠医师）：强调专业严谨 + 温柔耐心；明确服务边界（严重病症提醒就医）；只回答萌宠相关问题
- **bookworm**（书籍推荐官）：强调细致贴心 + 审美在线；要求抓重点不啰嗦；禁止回答非书籍推荐相关问题

**导出函数**：

```ts
export function getPersona(id: string): Persona | undefined {
  return personas.find(p => p.id === id)
}
```

### 5.3 env.ts — 环境变量工具

两层 fallback 读取策略：

```ts
function env(key: string, fallback = '') {
  return (typeof window !== 'undefined' && window.__ENV__?.[key])
    || import.meta.env[key]
    || fallback
}
```

- **第一优先级**：`window.__ENV__`（运行时注入，用于 ModelScope 魔搭部署场景的 `env.js`）
- **第二优先级**：`import.meta.env`（Vite 编译时注入，用于本地开发）
- **第三优先级**：`fallback` 默认值

导出的变量（全部以 `VITE_` 开头）：

| 变量名 | 用途 |
|-|-|
| `LLM_API_KEY` | LLM API Key |
| `LLM_ENDPOINT` | LLM 接口地址 |
| `LLM_MODEL` | LLM 模型名（默认 `qwen-flash`） |
| `ASR_APP_ID` | 腾讯语音识别 APP ID |
| `ASR_SECRET_ID` | 腾讯语音识别 Secret ID |
| `ASR_SECRET_KEY` | 腾讯语音识别 Secret Key |
| `SDK_APP_ID` | 魔珐星云 APP ID |
| `SDK_APP_SECRET` | 魔珐星云 APP SECRET |

### 5.4 xml.ts — XML 转义

```ts
export function escapeXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
```

为什么需要这个工具？`useSDK.speak()` 会将文本包裹在 `<speak>` SSML 标签中，如果用户输入或 LLM 返回的文本包含 `<`、`>`、`&` 等字符，未转义的话 SDK 的 XML 解析器会将其误判为 SSML 标签，导致播报静默失败。这是纯问答模式最易踩的坑之一。

### 5.5 types/index.ts — 类型定义

```ts
export type AppMode = 'tts' | 'text-qa' | 'voice'
```

整个项目只定义这一个类型。三种模式的名字被整个应用的多处代码引用（`appMode` ref 的类型约束、`ConfigPanel` 的 emit 类型、模板中的条件渲染）。

---

## 六、环境变量

### 6.1 变量列表

```env
# 数字人 SDK（注册获取：https://xingyun3d.com → 应用管理 → 创建横屏应用）
VITE_SDK_APP_ID=              # 应用 ID
VITE_SDK_APP_SECRET=          # 应用密钥

# LLM 大模型（阿里百炼 DashScope）
VITE_LLM_API_KEY=             # LLM API Key
VITE_LLM_ENDPOINT=            # LLM 接口地址（默认 https://dashscope.aliyuncs.com/compatible-mode/v1）
VITE_LLM_MODEL=               # LLM 模型（默认 qwen-flash）

# ASR 语音识别（腾讯实时语音识别）
VITE_ASR_APP_ID=              # 腾讯云 App ID
VITE_ASR_SECRET_ID=           # 腾讯云 Secret ID
VITE_ASR_SECRET_KEY=          # 腾讯云 Secret Key
```

### 6.2 环境变量加载优先级

```
本地开发:  .env 文件 → Vite import.meta.env
ModelScope: 运行时 env.js → window.__ENV__（覆盖编译时变量）
OSS 部署:  构建时注入 → import.meta.env（PROD 模式）
```

### 6.3 各模式的凭证要求

| 模式 | SDK 凭证 | LLM 凭证 | ASR 凭证 |
|-|-|-|-|
| voice | 必须 | 必须 | 必须 |
| text-qa | 必须 | 必须 | 不需要 |
| tts | 必须 | 不需要 | 不需要 |

如果缺少相应凭证，系统会在字幕区域显示"请先配置 XXX"的提示文本，并通过 `speak()` 语音播报提醒。

---

## 七、部署相关

### 7.1 部署模式检测

`App.vue` 通过三个条件判断当前部署环境：

```ts
// ModelScope: 运行时 window.__ENV__ 注入
const isModelScopeMode =
  (typeof window !== 'undefined' && !!(window as any).__ENV__)
  || import.meta.env.VITE_MODELSCOPE_PREVIEW === 'true'

// OSS 部署: 生产构建且非 ModelScope
const isOSSDeploy = import.meta.env.PROD && !isModelScopeMode

// 需要显示凭证弹窗
const showCredOnStart = isModelScopeMode || isOSSDeploy
```

### 7.2 试用计时系统（仅 ModelScope）

ModelScope 部署环境下，凭证配置成功后启动试用倒计时：

```ts
const TRIAL_SECONDS = isModelScopeMode
  ? Number(window.__ENV__?.VITE_TRIAL_SECONDS || 300)
  : 0
```

试用到期时：自动销毁 SDK → 设置 `trialExpired = true` → 弹出凭证弹窗 → 清空表单内容，阻止用户用同一套凭证重新连接。

### 7.3 全局调试 API

SDK 初始化完成后：

```ts
window.__xmovSdk        // SDK 实例（控制台可直接调用 speak/interrupt 等）
window.__sdkInitialized // boolean
window.__youlingUi      // { showCredModal: () => void } — 仅包含凭证弹窗唤起
```

相比 lite-sdk-demo 的调试 API，这里的 `__youlingUi` 功能极简，只暴露了一个 `showCredModal` 方法。

---

## 八、与其他 Demo 的关键差异

| 维度 | pure-qa-demo | lite-sdk-demo |
|-|-|-|
| 交互模式 | 3 种（voice / text-qa / tts） | 无固定模式，自由调用 SDK API |
| SDK 封装 | 轻量（~87 行，纯 speak） | 重量（~480 行，含 SSML 解析/行走/Widget 代理） |
| UI 复杂度 | 极简（1 个页面，4 个组件） | 丰富（17 个组件，DevTools 浮动面板） |
| 组件通信 | 全部集中在 App.vue | 通过 provide/inject 分发 |
| 行走系统 | 无 | 有（walk_points / buildWalkConfig） |
| Widget 渲染 | 无 | 有（CustomWidgetOverlay） |
| 性能监控 | 无 | 有（PerformanceHUD / PerformancePanel） |
| 数字人布局 | 全屏固定 | 可切换主题背景 / SDK 背景 |
| 字幕实现 | 两种方案并存（内置 proxyWidget / 自渲染 useSubtitle） | useSubtitle composable + SubtitleDisplay |
| AI 助手 | 无（LLM 直接驱动数字人播报） | 有（AiAssistant 边栏对话 + Action 指令） |
| 适用场景 | 快速集成演示、垂直业务场景 | 全功能展示、开发者调试 |
