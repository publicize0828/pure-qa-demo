import { ref, shallowRef, onUnmounted } from 'vue'
import { escapeXml } from '../utils/xml'

const AVATAR_SCALE = 0.3
const WALK_MARGIN = 0
const WALK_SPACING = 100
const WALK_STEP_COUNT = 16 // F~U，A~E 是 SDK 预留区间，不可用

function generateWalkPoints() {
  const pts: Record<string, number> = {}
  for (let i = 0; i < WALK_STEP_COUNT; i++) {
    pts[String.fromCharCode('F'.charCodeAt(0) + i)] = WALK_MARGIN + i * WALK_SPACING
  }
  return pts
}

function buildSDKConfig(containerId: string, options: { appId: string; appSecret: string; gatewayServer: string }) {
  return {
    containerId,
    ...options,
    env: 'production' as const,
    enableLogger: false,
    config: {
      layout: {
        container: { size: [window.innerWidth, window.innerHeight] as [number, number] },
        avatar: { v_align: 'center' as const, h_align: 'middle' as const, scale: AVATAR_SCALE, offset_x: 0, offset_y: 0 },
      },
      walk_config: {
        min_x_offset: WALK_MARGIN,
        max_x_offset: WALK_MARGIN + (WALK_STEP_COUNT - 1) * WALK_SPACING,
        walk_points: generateWalkPoints(),
        init_point: WALK_MARGIN + Math.floor(WALK_STEP_COUNT / 2) * WALK_SPACING,
      },
    },
    onSpeakStateChange() {},
    onWalkStateChange() {},
    onRenderChange() {},
    onStatusChange() {},
  }
}

export function useSDK(containerId: string) {
  const sdk = shallowRef<any>(null)
  const isInitialized = ref(false)
  const isInitializing = ref(false)
  const downloadProgress = ref(0)
  const initError = ref('')

  async function init(options: { appId: string; appSecret: string; gatewayServer: string }) {
    if (isInitializing.value) return false
    isInitializing.value = true
    downloadProgress.value = 0
    initError.value = ''

    try {
      sdk.value = new (window as any).XmovAvatar(buildSDKConfig(containerId, options))

      await sdk.value.init({
        initModel: 'normal',
        onDownloadProgress(p: number) { downloadProgress.value = p },
      })

      isInitialized.value = true
      ;(window as any).__xmovSdk = sdk.value
      return true
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      initError.value = msg
      console.error('[useSDK]', msg)
      return false
    } finally {
      isInitializing.value = false
    }
  }

  function speak(text: string) {
    sdk.value?.speak(`<speak>${escapeXml(text)}</speak>`, true, true)
  }

  function interrupt() {
    sdk.value?.interrupt('user')
    sdk.value?.idle()
  }

  function destroy() {
    sdk.value?.interrupt('user')
    sdk.value?.offlineMode()
    sdk.value?.destroy()
    sdk.value = null
    isInitialized.value = false
    ;(window as any).__xmovSdk = null
  }

  onUnmounted(() => destroy())

  return { isInitialized, isInitializing, downloadProgress, initError, init, speak, interrupt, destroy }
}
