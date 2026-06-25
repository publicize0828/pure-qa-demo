import { ref, onUnmounted } from 'vue'
import type { AsrConfig } from './types'
import { buildASRSignature } from './signature'

const PCM_BUFFER_SIZE = 4096
const SAMPLE_RATE = 16000
const MIN_FINAL_TEXT_LENGTH = 2

function startAudioCapture(stream: MediaStream, ws: WebSocket) {
  const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE })
  const source = audioCtx.createMediaStreamSource(stream)
  const processor = audioCtx.createScriptProcessor(PCM_BUFFER_SIZE, 1, 1)

  let sentCount = 0

  processor.onaudioprocess = (e) => {
    if (ws.readyState !== WebSocket.OPEN) return
    const input = e.inputBuffer.getChannelData(0)
    const pcm = new Int16Array(input.length)
    for (let i = 0; i < input.length; i++) {
      pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768))
    }
    ws.send(pcm.buffer)
    sentCount++
    if (sentCount % 100 === 0) console.log('[ASR] 已发送音频块:', sentCount)
  }

  source.connect(processor)
  // 必须连输出 onaudioprocess 才触发；gain=0 静音防啸叫
  const silentGain = audioCtx.createGain()
  silentGain.gain.value = 0
  processor.connect(silentGain)
  silentGain.connect(audioCtx.destination)
  return { audioCtx, source, processor, silentGain }
}

export function useASR() {
  const isListening = ref(false)
  const partialText = ref('')
  const finalText = ref('')
  const error = ref('')

  let ws: WebSocket | null = null
  let mediaStream: MediaStream | null = null
  let audioCtx: AudioContext | null = null
  let processor: ScriptProcessorNode | null = null
  let source: MediaStreamAudioSourceNode | null = null

  async function start(config: AsrConfig & {
    appId: string
    secretId: string
    secretKey: string
    onResult?: (text: string, isFinal: boolean) => void
  }) {
    if (isListening.value) return
    stop()

    error.value = ''
    partialText.value = ''
    finalText.value = ''

    try {
      console.log('[ASR] 请求麦克风...')
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      console.log('[ASR] 麦克风已获取')

      console.log('[ASR] 生成签名...')
      const wsUrl = await buildASRSignature(config.appId, config.secretId, config.secretKey)
      console.log('[ASR] WebSocket 连接中...')

      await new Promise<void>((resolve, reject) => {
        ws = new WebSocket(wsUrl)
        ws.binaryType = 'arraybuffer'
        ws.onopen = () => { console.log('[ASR] WebSocket 已连接'); isListening.value = true; resolve() }
        ws.onerror = (e) => { console.error('[ASR] WebSocket 错误', e); reject(new Error('ASR WebSocket 连接失败')) }
        ws.onclose = (e) => { console.log('[ASR] WebSocket 关闭', e.code, e.reason); isListening.value = false }
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data as string)
            console.log('[ASR] 收到消息', msg.code, msg.result?.slice_type, msg.result?.voice_text_str?.substring(0, 20))
            if (msg.code !== 0) { error.value = msg.message || 'ASR 识别错误'; return }
            const text = msg.result?.voice_text_str ?? ''
            const sliceType = msg.result?.slice_type ?? 0
            if (sliceType === 2) {
              finalText.value += text
              if (text.trim().length >= MIN_FINAL_TEXT_LENGTH) config.onResult?.(text, true)
            } else {
              partialText.value = text
              config.onResult?.(text, false)
            }
          } catch { console.warn('[ASR] 无法解析返回数据') }
        }
      })

      const capture = startAudioCapture(mediaStream, ws!)
      audioCtx = capture.audioCtx; source = capture.source; processor = capture.processor
    } catch (e: any) {
      error.value = e?.message ?? String(e)
      stop()
    }
  }

  function stop() {
    isListening.value = false
    if (ws) { ws.close(); ws = null }
    if (processor) { processor.disconnect(); processor = null }
    if (source) { source.disconnect(); source = null }
    if (audioCtx) { audioCtx.close(); audioCtx = null }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
  }

  onUnmounted(() => stop())

  return { isListening, partialText, finalText, error, start, stop }
}
