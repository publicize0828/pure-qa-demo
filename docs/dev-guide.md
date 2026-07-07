# 纯对话 Demo — 新手开发完全指南

> 适用人群：大学生 / 应届毕业生 / 前端初学者  
> 前置知识：HTML、CSS、JavaScript 基础，了解 Vue 3 更好但不是必须  
> 预计阅读时间：25-30 分钟

---

## 目录

1. [这是什么项目](#1-这是什么项目)
2. [5 分钟快速跑起来](#2-5-分钟快速跑起来)
3. [项目是怎么跑起来的](#3-项目是怎么跑起来的)
4. [源码逐文件讲解](#4-源码逐文件讲解)
5. [三种交互模式](#5-三种交互模式)
6. [AI 人格系统](#6-ai-人格系统)
7. [数字人怎么说话和动](#7-数字人怎么说话和动)
8. [如何修改和扩展](#8-如何修改和扩展)
9. [常见问题排查](#9-常见问题排查)

---

## 1. 这是什么项目

一个**AI 数字人纯对话**应用。用户可以和数字人自由对话，数字人能听懂你说的话并用语音回复，口型同步。

**三种使用模式**：
- 🎤 语音交互：按住说话，数字人语音回复
- 💬 文本问答：打字提问，数字人语音回复
- 🔊 语音播报：打字内容，数字人直接朗读（不经过 AI）

**可切换的 AI 人格**：金融顾问、萌宠医师、书籍推荐官

### 技术全景图

```
你的浏览器
    │
    ├─→ 魔珐 SDK (CDN)         数字人渲染 + 口型同步
    ├─→ 腾讯云 ASR (WebSocket)   语音转文字
    ├─→ 阿里百炼 LLM (HTTP)      AI 理解你说的话并生成回复
    └─→ 阿里云 OSS (CDN)         托管前端页面
```

---

## 2. 5 分钟快速跑起来

### 2.1 准备工作

- **Node.js** 18+ （[下载](https://nodejs.org)）
- **pnpm**：`npm install -g pnpm`

### 2.2 克隆代码

```bash
git clone https://github.com/publicize0828/pure-qa-demo.git
cd pure-qa-demo
pnpm install
```

### 2.3 获取凭证（免费！）

| 你需要什么 | 去哪获取 | 免费额度 |
|-----------|---------|---------|
| SDK APP ID / SECRET | [魔珐星云](https://xingyun3d.com/) 注册 → 创建横屏应用 | 注册送 1000 积分 |
| LLM API Key | [阿里百炼](https://bailian.console.aliyun.com/) | 免费额度 |
| ASR 凭证 | [腾讯云 ASR](https://console.cloud.tencent.com/asr) | 每月 5 小时免费 |

> 💡 注册魔珐星云时填邀请码 **JU6AD24X9V** 额外获得 1000 积分。

### 2.4 配置并启动

```bash
cp .env.example .env
# 编辑 .env 填入你的凭证
pnpm dev
```

打开 `http://localhost:5173`，看到数字人说"你好"就成功了。

---

## 3. 项目是怎么跑起来的

### 3.1 启动流程

```
1. 加载 index.html → CDN 拉取魔珐 SDK
2. Vue 应用启动 App.vue
3. initSDK() 连接魔珐服务器 → 下载数字人模型
4. 数字人出现，speak("你好")
5. 等待用户交互
```

### 3.2 核心数据流

```
用户输入（语音/文字）
    │
    ▼
handleInput()  ←── 统一入口
    │
    ├── 语音模式：ASR 录音 → 转文字 → askLLM(text) → speak(reply)
    ├── 文本问答：输入框文字 → askLLM(text) → speak(reply)
    └── 语音播报：输入框文字 → speak(text)（跳过 AI）
```

对比银行导办 demo 的**状态机驱动**，纯对话 demo 是**事件驱动**——用户每次输入都触发一次"提问 → AI 回复 → 播报"的循环，没有复杂的状态流转。

---

## 4. 源码逐文件讲解

### 4.1 入口文件

#### `index.html` — 加载魔珐 SDK

```html
<script src="https://media.xingyun3d.com/.../xmovAvatar@latest.js"></script>
```

这行代码从 CDN 加载魔珐 SDK，之后 `window.XmovAvatar` 全局可用。

#### `src/main.ts` — Vue 启动

```ts
import { createApp } from 'vue'
import App from './App.vue'
createApp(App).mount('#app')
```

### 4.2 主组件：`src/App.vue`

```
App.vue
├── 模板
│   ├── CredentialModal      ← 凭证弹窗
│   ├── AvatarCanvas         ← 数字人画布
│   ├── SubtitleOverlay      ← 字幕
│   ├── ConfigPanel          ← 右侧配置面板
│   └── BottomBar            ← 底部输入栏
│
└── 脚本
    ├── SDK 初始化           ← initSDK()
    ├── 模式切换             ← voice / text-qa / tts
    ├── LLM 调用             ← askLLM(text)
    └── ASR 语音识别         ← 按住说话录音
```

**核心变量**：

| 变量 | 作用 |
|------|------|
| `appMode` | 当前模式：`voice` / `text-qa` / `tts` |
| `isInitialized` | SDK 是否连接成功 |
| `isCalling` | 是否正在录音 |
| `sdkConfigured` | SDK 凭证是否已配置 |
| `llmConfigured` | LLM API Key 是否已配置 |
| `asrConfigured` | ASR 凭证是否已配置 |

**核心函数**：

| 函数 | 作用 |
|------|------|
| `handleInput(text)` | 根据当前模式处理用户输入 |
| `askLLM(text)` | 调用大模型生成回复 |
| `speak(text)` | 让数字人说话 |

### 4.3 组件详解

#### `AvatarCanvas.vue` — 数字人画布

一个 `<div id="avatar-canvas">` 容器。SDK 在里面渲染数字人，你不需要在这里写代码。

#### `ConfigPanel.vue` — 配置面板

右侧抽屉面板，包含：
- **模式切换**：语音交互 / 文本问答 / 语音播报
- **角色选择**：金融顾问 / 萌宠医师 / 书籍推荐官
- **SDK 配置**：APP ID / SECRET（本地开发用）
- **LLM 配置**：API Key / Endpoint / Model
- **ASR 配置**：APP ID / Secret ID / Secret Key

#### `CredentialModal.vue` — 凭证弹窗

与银行导办 demo 共用同一个组件。OSS / 魔搭 / 无凭证时自动弹出，引导用户注册和配置。

#### `SubtitleDisplay.vue` — 字幕组件

显示数字人说的话。SDK 内置字幕被隐藏，应用层自行渲染，支持流式高亮、多行滚动。

### 4.4 Composables

#### `useSDK.ts` — SDK 封装

```ts
// 初始化
const sdk = await init({ appId, appSecret, onSubtitle, onSpeakEnd })

// 说话
function speak(text: string) {
  sdk.speak(`<speak>${text}</speak>`, true, true)
}

// 切换布局
function changeLayout(config) { ... }

// 销毁
function destroy() { sdk.destroy() }
```

#### `useSubtitle.ts` — 字幕管理

```ts
const { subtitleRows, onSubtitle, onSpeakEnd } = useSubtitle()

// SDK 每次说新句子时触发
onSubtitle(text) → subtitleRows.push(text)

// 说完后高亮下一行
onSpeakEnd() → activeIdx++
```

#### `useASR.ts` — （位于 lib/asr/）

```ts
const { start, stop } = useASR()

await start({
  appId, secretId, secretKey,
  onResult(text, isFinal) {
    if (isFinal) askLLM(text)  // 最终结果 → 发给 AI
  }
})
```

### 4.5 配置文件

#### `credentials.ts` — SDK 网关

```ts
export const SDK_GATEWAY = 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session'
```

#### `personas.ts` — AI 人设

见 [第 6 节](#6-ai-人格系统)。

---

## 5. 三种交互模式

### 🎤 语音交互（默认模式）

```
按住按钮 → ASR 开始录音 → 实时显示识别文字
    ↓
松开按钮 → 录音停止 → 等待最终识别结果
    ↓
isFinal=true → askLLM(text) → LLM 回复 → speak(reply) → 数字人口型同步播报
```

### 💬 文本问答

```
输入文字 → 回车发送
    ↓
askLLM(text) → LLM 回复 → speak(reply) → 数字人口型同步播报
```

### 🔊 语音播报（TTS）

```
输入文字 → 回车发送
    ↓
speak(text) → 数字人直接朗读（不经过 AI）
```

> TTS 模式用的是 SDK 自带的 TTS，不需要 LLM，适合测试数字人播报效果。

---

## 6. AI 人格系统

人格定义在 `src/config/personas.ts`，通过 System Prompt 控制 AI 的行为。

```ts
export const personas = {
  advisor: {
    label: '金融顾问',
    systemPrompt: `你是专业的金融顾问，用简洁专业的语言回答理财、投资、保险等问题。`,
  },
  vet: {
    label: '萌宠医师',
    systemPrompt: `你是经验丰富的宠物医生，用亲切易懂的语言回答宠物健康、喂养、行为等问题。`,
  },
  bookworm: {
    label: '书籍推荐官',
    systemPrompt: `你是热爱阅读的书籍推荐官，根据用户的兴趣和需求推荐合适的书籍。`,
  },
}
```

**添加新人格只需三步**：

1. 在 `personas.ts` 里加一个新对象
2. 在 `ConfigPanel.vue` 的角色选择器里加一个选项
3. 在 `App.vue` 的角色切换逻辑里映射过去

---

## 7. 数字人怎么说话和动

### 说话

```ts
sdk.speak(`<speak>${text}</speak>`, true, true)
//              ↑ SSML 包裹    ↑ 打断之前  ↑ 自动播放
```

### 口型同步

魔珐 SDK 内部自动处理——TTS 合成语音的同时计算口型数据（viseme），驱动数字人嘴巴同步开合。**你不需要写任何口型代码**。

### 字幕

SDK 的 `onWidgetEvent('subtitle_on')` 事件携带字幕文本，App.vue 中监听并更新到 `SubtitleDisplay` 组件。

### 布局

数字人有两种布局预设，通过 `changeLayout()` 切换：
- **半身居中**：数字人在屏幕中央，适合纯对话
- **画中画**：数字人缩小到角落，适合需要更多屏幕空间的场景

---

## 8. 如何修改和扩展

### 8.1 添加新的 AI 人格

1. 在 `personas.ts` 中添加：
```ts
teacher: {
  label: '英语老师',
  systemPrompt: '你是耐心的英语老师，用简单英语和用户对话，纠正语法错误。',
}
```

2. 在 `ConfigPanel.vue` 的角色列表中加入 "英语老师"。

### 8.2 换 LLM 供应商

```env
# .env 改这几行
VITE_LLM_ENDPOINT=https://api.deepseek.com/v1
VITE_LLM_MODEL=deepseek-chat
VITE_LLM_API_KEY=sk-你的密钥
```

### 8.3 加一个"拍照问答"模式

1. 添加一个上传图片的按钮
2. 把图片转成 base64
3. 发给支持多模态的 LLM（如 GPT-4V 或 Qwen-VL）
4. 数字人播报回复

### 8.4 改字幕样式

编辑 `SubtitleDisplay.vue` 的 `<style scoped>` 部分，修改 CSS。

---

## 9. 常见问题排查

### Q: 数字人不出现？
1. `.env` 文件是否配置了正确的 APP ID / SECRET
2. F12 控制台看有没有 `[10003] 积分不足` 错误
3. 检查网络是否能访问 `nebula-agent.xingyun3d.com`

### Q: 说话后无回复？
1. LLM API Key 是否正确
2. 检查 `VITE_LLM_ENDPOINT` 格式：以 `/v1` 结尾
3. 确认模型名称正确（如 `qwen-flash`）

### Q: 麦克风没反应？
1. 浏览器需要 HTTPS 或 localhost
2. 检查浏览器麦克风权限
3. 确认 ASR 凭证（3 个）均已填写

### Q: 怎么调试？
1. F12 → Console 看日志
2. `window.__xmovSdk` 可直接操作 SDK
3. Network 标签看 API 请求是否成功

---

## 附录：API 速查

### SDK

```ts
sdk.speak('<speak>你好</speak>', true, true)  // 说话
sdk.interrupt('user')                           // 打断
sdk.changeLayout({...})                          // 切换布局
sdk.destroy()                                    // 销毁
```

### LLM

```ts
const client = createLLMClient({ apiKey, endpoint, model })
const reply = await client.chat(userText, systemPrompt)
```

### ASR

```ts
const { start, stop } = useASR()
await start({
  appId, secretId, secretKey,
  onResult(text, isFinal) { /* isFinal=true 时发给 LLM */ }
})
stop()  // 停止录音
```
