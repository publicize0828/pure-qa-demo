<script setup lang="ts">
import { ref } from 'vue'
import type { AppMode } from '../types'

defineProps<{
  appMode: AppMode
  selectedPersona: string
  sdkAppId: string
  sdkAppSecret: string
  sdkConfigured: boolean
  isInitialized: boolean
  isInitializing: boolean
  downloadProgress: number
  sdkError: string
  isModelScope: boolean
}>()

const emit = defineEmits<{
  'update:appMode': [v: AppMode]
  'update:selectedPersona': [v: string]
  'update:sdkAppId': [v: string]
  'update:sdkAppSecret': [v: string]
  init: []
  destroy: []
}>()

const configOpen = ref(false)
const copied = ref(false)

function copyInvite() {
  navigator.clipboard.writeText('JSNAHT5QFM')
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

function openCredModal() {
  const ui = (window as any).__youlingUi
  if (ui?.showCredModal) ui.showCredModal()
}
</script>

<template>
  <div class="config-float">
    <button class="config-toggle" @click="configOpen = !configOpen">
      <span class="toggle-dot" :class="{ ready: isInitialized, loading: isInitializing }"></span>
      {{ configOpen ? '收起' : '配置' }}
    </button>
    <div v-show="configOpen" class="config-body">
      <div class="cfg-section">
        <label>模式切换</label>
        <div class="mode-tabs">
          <button :class="{ active: appMode === 'voice' }" @click="emit('update:appMode', 'voice')">语音交互</button>
          <button :class="{ active: appMode === 'text-qa' }" @click="emit('update:appMode', 'text-qa')">文本问答</button>
          <button :class="{ active: appMode === 'tts' }" @click="emit('update:appMode', 'tts')">语音播报</button>
        </div>
      </div>

      <div class="cfg-divider"></div>

      <template v-if="!isModelScope">
        <div class="cfg-section">
          <label>
            数字人驱动
            <span class="tag" :class="sdkConfigured ? 'tag-ok' : 'tag-no'">{{ sdkConfigured ? '已配置' : '未配置' }}</span>
          </label>
          <input :value="sdkAppId" type="text" placeholder="APP ID" @input="emit('update:sdkAppId', ($event.target as HTMLInputElement).value)" />
          <input :value="sdkAppSecret" type="password" placeholder="APP SECRET" @input="emit('update:sdkAppSecret', ($event.target as HTMLInputElement).value)" />

          <details class="cfg-help">
            <summary>如何获取 APP ID 和 Secret？</summary>
            <p>登录 <a href="https://xingyun3d.com/?utm_campaign=github&utm_source=shequ&utm_medium=&utm_term=&utm_content=" target="_blank">魔珐星云官网</a>，注册并登录账号。</p>
            <p>邀请码：<b class="invite-code" @click="copyInvite">JSNAHT5QFM</b><span v-if="copied" class="copied-hint"> 已复制</span>（注册时填入可获 1000 积分）</p>
            <p>在「应用管理」中创建新的横屏应用，复制页面右上角的 APP ID 和 APP SECRET。</p>
          </details>
          <button v-if="isInitialized" class="btn-disconnect" @click="emit('destroy')">断开数字人</button>
        </div>
      </template>
      <template v-else>
        <div class="cfg-section">
          <label>数字人驱动</label>
          <button v-if="!isInitialized" class="btn-fill" @click="openCredModal">
            ✨ 连接数字人
          </button>
          <button v-else class="btn-disconnect" @click="emit('destroy')">断开数字人</button>
        </div>
      </template>

      <div class="cfg-divider"></div>

      <div class="cfg-section">
        <label>人设切换</label>
        <select :value="selectedPersona" @change="emit('update:selectedPersona', ($event.target as HTMLSelectElement).value)">
          <option value="advisor">理财顾问咨询</option>
          <option value="vet">萌宠医师</option>
          <option value="bookworm">书籍推荐官</option>
        </select>
      </div>

      <div v-if="!isModelScope" class="cfg-actions">
        <button v-if="!isInitialized" class="btn-init" :disabled="!sdkConfigured || isInitializing" @click="emit('init')">
          {{ isInitializing ? `加载中 ${downloadProgress.toFixed(1)}%` : '初始化数字人' }}
        </button>
        <button v-else class="btn-destroy" @click="emit('destroy')">断开连接</button>
        <p v-if="sdkError" class="init-error">{{ sdkError }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config-float {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 200;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}
.config-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border-radius: 20px;
  border: none;
  background: rgba(255,255,255,.7);
  backdrop-filter: blur(8px);
  color: #666;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all .25s;
  box-shadow: 0 2px 8px rgba(0,0,0,.06);
}
.config-toggle:hover { background: #fff; color: #333; box-shadow: 0 4px 16px rgba(0,0,0,.1); }
.toggle-dot {
  width: 5px; height: 5px; border-radius: 50%;
  background: #bbb;
  transition: all .3s;
}
.toggle-dot.ready { background: #34c759; box-shadow: 0 0 6px rgba(52,199,89,.4); }
.toggle-dot.loading { background: #007aff; animation: pulse-dot 1s ease-in-out infinite; }
@keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:.2} }

.config-body {
  width: 272px;
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  box-shadow: 0 4px 24px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.04);
}
.cfg-section { display: flex; flex-direction: column; gap: 5px; }
.cfg-section input,
.cfg-section select {
  width: 100%; padding: 8px 10px; font-size: 12px;
  border-radius: 8px; border: 1px solid #e8e8e8; background: #f9f9f9;
  transition: border-color .2s, background .2s;
}
.cfg-section input:focus,
.cfg-section select:focus { border-color: #aaa; background: #fff; box-shadow: none; }
.cfg-divider { height: 1px; background: #f0f0f0; }
.mode-tabs {
  display: flex; gap: 4px; background: #f5f5f5;
  border-radius: 8px; padding: 3px;
}
.mode-tabs button {
  flex: 1; padding: 6px 4px; border: none; background: transparent;
  border-radius: 6px; font-size: 11px; font-weight: 500; color: #999;
  cursor: pointer; transition: all .2s;
}
.mode-tabs button.active {
  background: #fff; color: #1a1a1a; box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.tag { font-size: 10px; font-weight: 500; padding: 2px 7px; border-radius: 6px; }
.tag-ok { background: #e8f8ed; color: #34c759; }
.tag-no  { background: #fef0f0; color: #ff3b30; }
.cfg-actions { display: flex; flex-direction: column; gap: 8px; }
.btn-fill {
  background: #1a1a1a; color: #fff; border: none;
  padding: 10px 16px; font-weight: 500; font-size: 13px;
  border-radius: 10px; width: 100%; cursor: pointer; transition: background .2s;
}
.btn-fill:hover { background: #000; }
.btn-init {
  background: #1a1a1a; color: #fff; border: none;
  padding: 10px 16px; font-weight: 500; font-size: 13px;
  border-radius: 10px; width: 100%; cursor: pointer; transition: background .2s;
}
.btn-init:hover:not(:disabled) { background: #000; }
.btn-init:disabled { opacity: .35; cursor: not-allowed; }
.btn-destroy {
  background: transparent; border: 1px solid #e8e8e8; color: #ff3b30;
  padding: 8px 16px; font-weight: 500; font-size: 12px;
  border-radius: 10px; width: 100%; cursor: pointer;
}
.btn-destroy:hover { background: #fef0f0; }
.btn-disconnect {
  background: transparent; border: 1px solid #ff3b30; color: #ff3b30;
  padding: 8px 16px; font-weight: 500; font-size: 12px;
  border-radius: 10px; width: 100%; cursor: pointer; margin-top: 6px;
  transition: background .2s;
}
.btn-disconnect:hover { background: #fef0f0; }
.init-error { font-size: 11px; color: #ff3b30; text-align: center; line-height: 1.4; }
.cfg-help {
  font-size: 11px; color: #999; line-height: 1.6;
  border: 1px solid #f0f0f0; border-radius: 6px; padding: 8px 10px;
}
.cfg-help summary { cursor: pointer; color: #666; font-weight: 500; }
.cfg-help p { margin-top: 4px; }
.cfg-help a { color: #3b82f6; }
.invite-code {
  background: #eff6ff; color: #2563eb; padding: 2px 6px; border-radius: 4px;
  cursor: pointer; user-select: all; transition: background .2s;
}
.invite-code:hover { background: #dbeafe; }
.copied-hint { color: #34c759; font-size: 10px; }
</style>
