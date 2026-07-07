import { ref, shallowRef, onUnmounted } from 'vue'
import { escapeXml } from '../utils/xml'

function buildSDKConfig(containerId: string, options: {
  appId: string; appSecret: string; gatewayServer: string
  onSpeakEnd?: () => void
  proxyWidget?: Record<string, (data: any) => void>
  onMessage?: (data: any) => void
}) {
  return {
    containerId,
    appId: options.appId,
    appSecret: options.appSecret,
    gatewayServer: options.gatewayServer,
    env: 'production' as const,
    enableLogger: false,
    proxyWidget: options.proxyWidget ?? {},
    onSpeakStateChange(state: string) {
      if (state === 'speak_end') options.onSpeakEnd?.()
    },
    onMessage: options.onMessage,
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

  async function init(options: {
    appId: string; appSecret: string; gatewayServer: string
    onSpeakEnd?: () => void
    proxyWidget?: Record<string, (data: any) => void>
    onMessage?: (data: any) => void
  }) {
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
