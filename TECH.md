# 技术实现手册 — 纯对话 Demo

## 功能与实现

| 功能 | 技术 | 说明 |
|------|------|------|
| 语音交互 | 腾讯云 ASR Web SDK | 按住录音 → 实时识别 → LLM 回复 → 数字人播报 |
| 文本问答 | OpenAI SDK → LLM | 输入文字 → LLM 对话 → 数字人播报 |
| 语音播报 | XmovAvatar SDK | 输入文字 → 直接 TTS 播报 |
| 多角色人格 | System Prompt 切换 | 控制 LLM 回复风格和领域知识 |

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
          数字人播报
```

## 三种模式

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

// 文本问答：输入框 → LLM → SDK
async function askLLM(text: string) {
  const reply = await llm.chat(text, persona.systemPrompt)
  sdk.speak(`<speak>${reply}</speak>`, true, true)
}

// 语音播报：输入框 → 直接 SDK
function speak(text: string) {
  sdk.speak(`<speak>${text}</speak>`, true, true)
}
```

## ASR + LLM + SDK 协作

```
按住说话 → ASR 录音 → 实时转文字
    ↓
松开按钮 → 最终识别文本
    ↓
LLM.chat(text, systemPrompt) → 流式回复
    ↓
SDK.speak(`<speak>回复</speak>`) → 口型同步播报
```

## System Prompt 人格设计

```ts
const personas = {
  advisor: {
    label: '金融顾问',
    systemPrompt: '你是专业的金融顾问，用简洁专业的语言回答...',
  },
  teacher: {
    label: '老师',
    systemPrompt: '你是耐心的老师，用通俗易懂的方式解释...',
  },
}
```

## SDK 初始化

```ts
const { init, speak, destroy } = useSDK('#avatar-canvas')
await init({ appId, appSecret, gatewayServer })
speak('你好，我是你的数字人助手')
```

## 环境变量

```env
VITE_APP_ID=           # SDK 应用 ID
VITE_APP_SECRET=       # SDK 应用密钥
VITE_LLM_API_KEY=      # LLM API Key
VITE_LLM_ENDPOINT=https://dashscope.aliyuncs.com/compatible-mode/v1
VITE_LLM_MODEL=qwen3.6-flash
VITE_ASR_APP_ID=       # 腾讯云 APPID
VITE_ASR_SECRET_ID=    # 腾讯云 SecretId
VITE_ASR_SECRET_KEY=   # 腾讯云 SecretKey
```
