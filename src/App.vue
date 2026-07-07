<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useSDK } from './composables/useSDK'
import { useASR } from '@xmov/asr'
import { createLLMClient } from '@xmov/llm'
import { formatSdkError } from '@xmov/sdk-core'
import { getPersona } from './config/personas'
import { SDK_GATEWAY, getSDKCredentials } from './config/credentials'
import { LLM_API_KEY, LLM_ENDPOINT, LLM_MODEL, ASR_APP_ID, ASR_SECRET_ID, ASR_SECRET_KEY, SDK_APP_ID, SDK_APP_SECRET } from './utils/env'
import ConfigPanel from './components/ConfigPanel.vue'
import type { AppMode } from './types'

const selectedPersona = ref('advisor')
const appMode = ref<AppMode>('voice')

// SDK 凭证（用户在配置面板手动填写）
const sdkAppId = ref(SDK_APP_ID)
const sdkAppSecret = ref(SDK_APP_SECRET)
const sdkConfigured = computed(() => !!(sdkAppId.value.trim() && sdkAppSecret.value.trim()))

// 部署模式检测
//   ModelScope: window.__ENV__ 存在，运行时注入 → 弹窗 + 试用计时
//   OSS:       生产构建，无 __ENV__        → 弹窗，无试用，ASR/LLM 读 env
//   本地:      开发服务器                     → ConfigPanel 手动输入
const isModelScopePreview = import.meta.env.VITE_MODELSCOPE_PREVIEW === 'true'
const isModelScopeMode = (typeof window !== 'undefined' && !!(window as any).__ENV__) || isModelScopePreview
const isOSSDeploy = import.meta.env.PROD && !isModelScopeMode
const showCredOnStart = isModelScopeMode || isOSSDeploy

import ErrorToast from './components/ErrorToast.vue'

// BEGIN_MODELSCOPE_CRED — 魔搭部署时移除以下代码块
import CredentialModal from './components/CredentialModal.vue'

// ====== 凭证弹窗 + 试用计时（仅魔搭有试用） ======
const needCredSetup = computed(() => !sdkConfigured.value)
const showCredModal = ref(showCredOnStart || needCredSetup.value)
const trialExpired = ref(false)
const credConnecting = ref(false)
const credError = ref('')
const TRIAL_SECONDS = isModelScopeMode ? Number((typeof window !== 'undefined' && (window as any).__ENV__?.VITE_TRIAL_SECONDS) || 300) : 0
const trialSeconds = Math.max(0, TRIAL_SECONDS)
let _trialTimer = 0

function startTrialTimer() {
  if (trialSeconds <= 0) return
  clearInterval(_trialTimer)
  _trialTimer = window.setInterval(() => {
    clearInterval(_trialTimer)
    destroy()
    trialExpired.value = true
    showCredModal.value = true
  }, trialSeconds * 1000)
}

async function onCredentialConnect(appId: string, appSecret: string) {
  credError.value = ''
  credConnecting.value = true
  sdkAppId.value = appId
  sdkAppSecret.value = appSecret
  destroy()
  const ok = await init({ appId: appId.trim(), appSecret: appSecret.trim(), gatewayServer: SDK_GATEWAY, proxyWidget: sdkProxyWidget, onMessage: showSdkError })
  credConnecting.value = false
  if (ok) {
    speak('你好，我是你的数字人助手')
    showCredModal.value = false
    if (isModelScopeMode && !trialExpired.value) startTrialTimer()
  } else {
    credError.value = '连接失败，请检查 APP ID 和 APP SECRET 是否正确'
  }
}
// END_MODELSCOPE_CRED

// LLM / ASR（运行时环境变量，兼容 ModelScope env.js 注入）
const llmApiKey = ref(LLM_API_KEY)
const llmEndpoint = ref(LLM_ENDPOINT)
const llmModel = ref(LLM_MODEL)
const asrAppId = ref(ASR_APP_ID)
const asrSecretId = ref(ASR_SECRET_ID)
const asrSecretKey = ref(ASR_SECRET_KEY)

// -- SDK --
const {
  init,
  speak,
  interrupt,
  destroy,
  isInitialized,
  isInitializing,
  downloadProgress,
  initError: sdkError,
} = useSDK('#avatar-canvas')

// ============ 错误 Toast ============
const errorToast = ref<InstanceType<typeof ErrorToast>>()
function showSdkError(data: any) {
  const msg = formatSdkError(data)
  if (msg) { console.error('[SDK Error]', data); errorToast.value?.show(msg) }
}

// -- ASR --
const asr = useASR()

const textInput = ref('')
const llmThinking = ref(false)
const isCalling = ref(false)
const subtitleText = ref('')

const llmConfigured = computed(() => !!llmApiKey.value.trim())
const asrConfigured = computed(() => !!(asrAppId.value.trim() && asrSecretId.value.trim() && asrSecretKey.value.trim()))

function showConfigHint(service: string) {
  subtitleText.value = `请先配置${service}：复制 .env.example 为 .env，填写你的 API Key`
  speak(subtitleText.value)
}

const sdkProxyWidget = {
  subtitle_on(d: any) {
    const text = d?.data?.text ?? d?.text ?? ''
    if (text) subtitleText.value = text
  },
  subtitle_off() {
    subtitleText.value = ''
  },
}

async function handleInit() {
  subtitleText.value = ''
  const ok = await init({
    appId: sdkAppId.value.trim(),
    appSecret: sdkAppSecret.value.trim(),
    gatewayServer: SDK_GATEWAY,
    proxyWidget: sdkProxyWidget,
    onMessage: showSdkError,
  })
  if (ok) {
    speak('你好，我是你的数字人助手')
  }
}

function handleDestroy() {
  destroy()
}

async function chatWithLLM(userMessage: string): Promise<string> {
  const client = createLLMClient({
    apiKey: llmApiKey.value.trim(),
    endpoint: llmEndpoint.value.trim() || undefined,
    model: llmModel.value.trim() || undefined,
  })
  const persona = getPersona(selectedPersona.value)
  const res = await client.chat(userMessage, persona?.systemPrompt)
  return res.content
}

async function askLLM(text: string) {
  if (!llmConfigured.value) { showConfigHint('LLM API Key'); return }
  llmThinking.value = true
  try {
    const reply = await chatWithLLM(text)
    speak(reply)
  } catch (e: any) {
    speak('问答失败: ' + (e.message || e))
  } finally {
    llmThinking.value = false
  }
}

async function submitText() {
  const text = textInput.value.trim()
  if (!text) return
  textInput.value = ''

  if (appMode.value === 'tts') {
    speak(text)
  } else {
    askLLM(text)
  }
}

const asrText = ref('')
let _asrTimer = 0

async function startCall() {
  if (!asrConfigured.value) { showConfigHint('ASR 语音识别凭证'); return }
  isCalling.value = true
  asrText.value = ''
  await asr.start({
    appId: asrAppId.value.trim(),
    secretId: asrSecretId.value.trim(),
    secretKey: asrSecretKey.value.trim(),
    onResult(text: string, isFinal: boolean) {
      if (isFinal && text.trim()) {
        asrText.value = text; askLLM(text.trim())
        clearTimeout(_asrTimer); _asrTimer = window.setTimeout(() => { asrText.value = '' }, 2000)
      } else if (text.length >= 2) asrText.value = text
    },
  })
}

function endCall() {
  asr.stop()
  isCalling.value = false
  asrText.value = ''
}

function handleInterrupt() {
  if (isCalling.value) endCall()
  interrupt()
}

watch(appMode, (mode) => {
  if (mode !== 'voice' && isCalling.value) endCall()
})

watch(isInitialized, (v) => {
  if (!v) { endCall() }
})

// BEGIN_MODELSCOPE_CRED
onUnmounted(() => { clearInterval(_trialTimer) })
// END_MODELSCOPE_CRED

// BEGIN_MODELSCOPE_CRED
;(window as any).__youlingUi = { showCredModal: () => { showCredModal.value = true } }
// END_MODELSCOPE_CRED
</script>

<template>
  <div class="app-root">
    <!-- BEGIN_MODELSCOPE_CRED -->
    <CredentialModal
      v-if="showCredOnStart || needCredSetup"
      :visible="showCredModal"
      :connecting="credConnecting"
      :error="credError"
      :trial-expired="trialExpired"
      :trial-seconds="trialSeconds"
      @connect="onCredentialConnect"
      @close="showCredModal = false"
    />
    <!-- END_MODELSCOPE_CRED -->
    <ErrorToast ref="errorToast" />
    <div v-if="isCalling && asrText" class="asr-text-overlay">{{ asrText }}</div>
    <!-- 全屏画布 -->
    <div id="avatar-canvas" class="canvas-fullscreen">
      <div v-if="!isInitialized" class="canvas-placeholder">
        <template v-if="isInitializing">
          <div class="init-progress">
            <div class="progress-ring">
              <svg viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" stroke-width="3" />
                <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" stroke-width="3"
                  :stroke-dasharray="`${downloadProgress * 0.94} 94`"
                  stroke-linecap="round" transform="rotate(-90 18 18)" />
              </svg>
              <span class="progress-num">{{ downloadProgress.toFixed(1) }}%</span>
            </div>
            <span class="progress-label">正在加载数字人资源...</span>
          </div>
        </template>
        <template v-else>
          <div class="init-hint">
            <span v-if="!sdkConfigured">配置数字人驱动参数后开始</span>
            <span v-else>点击右上角「初始化」连接数字人</span>
          </div>
        </template>
      </div>
    </div>

    <!-- 右上角配置 -->
    <ConfigPanel
      :is-model-scope="showCredOnStart"
      :app-mode="appMode"
      :selected-persona="selectedPersona"
      :sdk-app-id="sdkAppId"
      :sdk-app-secret="sdkAppSecret"
      :sdk-configured="sdkConfigured"
      :is-initialized="isInitialized"
      :is-initializing="isInitializing"
      :download-progress="downloadProgress"
      :sdk-error="sdkError"
      @update:app-mode="appMode = $event"
      @update:selected-persona="selectedPersona = $event"
      @update:sdk-app-id="sdkAppId = $event"
      @update:sdk-app-secret="sdkAppSecret = $event"
      @init="handleInit"
      @destroy="handleDestroy"
    />

    <!-- 底部区域：字幕 + 控制栏 -->
    <div v-if="isInitialized" class="bottom-area">
      <div v-if="subtitleText" class="subtitle-bar">
        <span class="subtitle-text">{{ subtitleText }}</span>
      </div>
      <!-- 语音交互模式 -->
      <div v-if="appMode === 'voice'" class="voice-bar">
        <button v-if="!isCalling" class="btn-call" @click="startCall">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          点击开始语音对话
        </button>
        <button v-else class="btn-call is-active" @click="endCall">
          <span class="pulse"></span>
          {{ llmThinking ? '思考中...' : '对话中 · 点击结束' }}
        </button>
      </div>
      <!-- 文本问答 / 语音播报模式 -->
      <div v-else class="input-group">
        <input v-model="textInput" type="text" :placeholder="appMode === 'text-qa' ? '输入问题后按回车...' : '输入文字后按回车...'" @keyup.enter="submitText" :disabled="llmThinking" />
        <button class="btn-primary" @click="submitText" :disabled="llmThinking">{{ llmThinking ? '...' : appMode === 'text-qa' ? '提问' : '播报' }}</button>
        <button class="btn-ghost" @click="handleInterrupt">打断</button>
      </div>
    </div>

  </div>
</template>

<style scoped>
.app-root {
  height: 100vh;
  width: 100vw;
  position: relative;
  overflow: hidden;
  background: #f5f5f5;
}

/* ---- 全屏画布 ---- */
.canvas-fullscreen {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: radial-gradient(ellipse at center, #eaeaea 0%, #dcdcdc 100%);
}
.canvas-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.init-hint {
  font-size: 14px;
  color: #aaa;
  letter-spacing: .3px;
}
.init-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}
.progress-ring {
  position: relative;
  width: 72px;
  height: 72px;
}
.progress-ring svg { width: 100%; height: 100%; }
.progress-ring circle:first-child { stroke: #e0e0e0; }
.progress-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  font-variant-numeric: tabular-nums;
}
.progress-label {
  font-size: 13px;
  color: #999;
  letter-spacing: .3px;
}

/* ---- 底部区域：字幕 + 控制栏 ---- */
.bottom-area {
  position: absolute;
  bottom: 36px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 50px;
}
.subtitle-bar {
  max-width: 90vw;
  display: flex;
  justify-content: center;
}
.subtitle-text {
  padding: 6px 14px;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(6px);
  border-radius: 8px;
  font-size: 15px;
  color: #fff;
  line-height: 1.6;
  text-align: center;
}

.asr-text-overlay {
  position: absolute; bottom: 140px; left: 50%; transform: translateX(-50%);
  max-width: 85vw; padding: 12px 20px;
  background: rgba(0,0,0,.65); color: #fff;
  border-radius: 12px; font-size: 15px; line-height: 1.5;
  z-index: 250; text-align: center;
  backdrop-filter: blur(8px);
}

.input-group {
  display: flex;
  gap: 8px;
  align-items: center;
  background: rgba(255,255,255,.85);
  backdrop-filter: blur(12px);
  padding: 5px 5px 5px 16px;
  border-radius: 14px;
  box-shadow: 0 2px 16px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04);
}
.input-group input {
  width: 340px;
  padding: 9px 0;
  font-size: 14px;
  border: none;
  background: transparent;
  outline: none;
  color: #333;
}
.input-group input::placeholder { color: #bbb; }
.input-group input:focus { box-shadow: none; }

.btn-primary {
  background: #1a1a1a;
  color: #fff;
  border: none;
  padding: 9px 20px;
  font-weight: 500;
  font-size: 13px;
  border-radius: 10px;
  white-space: nowrap;
  cursor: pointer;
  transition: background .2s, transform .1s;
}
.btn-primary:hover { background: #000; }
.btn-primary:active { transform: scale(.97); }

.btn-ghost {
  background: transparent;
  border: none;
  color: #bbb;
  font-size: 12px;
  padding: 9px 12px 9px 4px;
  white-space: nowrap;
  cursor: pointer;
  transition: color .2s;
}
.btn-ghost:hover { color: #666; background: transparent; }

/* ---- 语音通话 ---- */
.voice-bar {
  display: flex;
  align-items: center;
}
.btn-call {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 32px;
  border-radius: 16px;
  border: none;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all .25s;
  background: #1a1a1a;
  color: #fff;
  box-shadow: 0 4px 20px rgba(0,0,0,.15);
}
.btn-call:hover { background: #000; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,.2); }
.btn-call.is-active {
  background: #dc2626;
  box-shadow: 0 4px 20px rgba(220,38,38,.25);
}
.btn-call.is-active:hover { background: #b91c1c; }
.pulse {
  width: 10px; height: 10px; border-radius: 50%;
  background: #fff;
  animation: pulse-ring 1.2s ease-in-out infinite;
}
@keyframes pulse-ring {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,.4); }
  50% { box-shadow: 0 0 0 12px rgba(255,255,255,0); }
}

</style>
