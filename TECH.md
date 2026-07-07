# 技术实现手册 — 纯对话 Demo

> 基于魔珐有灵（XmovAvatar）SDK 的 AI 数字人纯对话交互 Demo

## 项目结构

```
pure-qa-demo/
├── index.html              # 入口 HTML，加载 CDN SDK
├── package.json            # 依赖与脚本
├── vite.config.ts          # Vite 构建配置
├── tsconfig.json           # TypeScript 配置
├── src/
│   ├── App.vue             # 主应用：模式切换 + 输入收口
│   ├── components/
│   │   ├── ConfigPanel.vue      # 右上角配置面板
│   │   ├── CredentialModal.vue  # 凭证弹窗（OSS/魔搭）
│   │   └── SubtitleDisplay.vue  # 自渲染字幕组件
│   ├── composables/
│   │   ├── useSDK.ts       # SDK 初始化与播报
│   │   ├── useSubtitle.ts  # 字幕状态管理
│   │   └── useASR.ts       # ASR 语音识别（lib/asr）
│   ├── config/
│   │   ├── credentials.ts  # SDK Gateway 常量
│   │   └── personas.ts     # 人设 System Prompt
│   ├── lib/                # 内联的共享包
│   │   ├── sdk-core/       # SDK 类型定义
│   │   ├── llm/            # LLM 客户端
│   │   └── asr/            # ASR 语音识别
│   └── utils/
│       ├── env.ts          # 环境变量读取
│       └── xml.ts          # XML 转义工具
```

## 快速开始

```bash
pnpm install
pnpm dev
pnpm build
```

## 三种交互模式

| 模式 | 说明 | 数据流 |
|------|------|--------|
| 🎤 语音交互 | 按住说话 → ASR → LLM → 数字人播报 | 麦克风 → 腾讯云 ASR → LLM → SDK.speak() |
| 💬 文本问答 | 输入文字 → LLM → 数字人播报 | 输入框 → LLM → SDK.speak() |
| 🔊 语音播报 | 输入文字 → 直接 TTS 播报 | 输入框 → SDK.speak() |

```ts
const appMode = ref<'voice' | 'text-qa' | 'tts'>('voice')

// 语音交互：ASR → LLM → SDK
async function startCall() {
  await asr.start({
    onResult(text, isFinal) {
      if (isFinal) askLLM(text)
    },
  })
}

// 文本问答：LLM → SDK
async function askLLM(text: string) {
  const reply = await llm.chat(text, persona.systemPrompt)
  speak(reply)
}

// 语音播报：直接 SDK TTS
function speak(text: string) {
  sdk.speak(`<speak>${text}</speak>`, true, true)
}
```

## 架构

```
┌──────────────┐    ┌──────────┐    ┌───────────┐
│  ConfigPanel │    │   ASR    │    │    LLM    │
│  模式/角色切换│    │ 语音识别  │    │  对话生成  │
└──────┬───────┘    └────┬─────┘    └─────┬─────┘
       │                 │                │
       └─────────┬───────┴────────────────┘
                 │
          handleInput()
          统一输入收口
                 │
          SDK.speak()
          数字人播报 + 口型同步
                 │
          SubtitleDisplay
          自渲染字幕（隐藏 SDK 内置字幕）
```

## ASR + LLM + SDK 协作

```
按住说话 → ASR 录音 → 实时转文字
    ↓
松开按钮 → 最终识别文本
    ↓
LLM.chat(text, systemPrompt) → 非流式回复
    ↓
SDK.speak(`<speak>回复</speak>`) → 口型同步播报
    ↓
onWidgetEvent('subtitle_on') → SubtitleDisplay 渲染字幕
```

## 字幕自渲染

SDK 内置字幕通过 CSS 隐藏，应用层自行渲染：

- 流式高亮：当前说话行白色高亮 + 闪烁光标
- 最多三行：旧行自动淡出
- TransitionGroup 动画：新行滑入，旧行滑出

## SDK 初始化

```ts
const { init, speak, destroy } = useSDK('#avatar-canvas')

await init({
  appId, appSecret,
  gatewayServer: 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session',
  onSubtitle: (text) => subtitle.onSubtitle(text),
  onSpeakEnd: () => subtitle.onSpeakEnd(),
})
speak('你好，我是你的数字人助手')
```

## System Prompt 人格设计

```ts
const personas = {
  advisor: {
    label: '金融顾问',
    systemPrompt: '你是专业的金融顾问，用简洁专业的语言回答用户的理财、投资、保险等问题。',
  },
  vet: {
    label: '萌宠医师',
    systemPrompt: '你是经验丰富的宠物医生，用亲切易懂的语言回答宠物健康、喂养、行为等问题。',
  },
  bookworm: {
    label: '书籍推荐官',
    systemPrompt: '你是热爱阅读的书籍推荐官，根据用户的兴趣和需求推荐合适的书籍。',
  },
}
```

## 环境变量

```env
VITE_SDK_APP_ID=
VITE_SDK_APP_SECRET=
VITE_LLM_API_KEY=
VITE_LLM_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
VITE_LLM_MODEL=qwen-flash
VITE_ASR_APP_ID=
VITE_ASR_SECRET_ID=
VITE_ASR_SECRET_KEY=
```

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 构建 | Vite 8 |
| 数字人 | XmovAvatar SDK (CDN) |
| LLM | 阿里百炼 DashScope（OpenAI 兼容协议） |
| ASR | 腾讯云实时语音识别（WebSocket） |
| 包管理 | pnpm |
