import { ref, computed, onUnmounted } from 'vue'

export interface SubtitleLine {
  id: number
  text: string
  status: 'speaking' | 'done'
}

const MAX_LINES = 3
let _nextId = 0

export function useSubtitle() {
  const lines = ref<SubtitleLine[]>([])
  const isSpeaking = ref(false)

  function onSubtitle(text: string) {
    if (!text) return
    // 找最后一行：如果是 speaking 状态就更新它，否则新增一行
    const last = lines.value[lines.value.length - 1]
    if (last && last.status === 'speaking') {
      last.text = text
    } else {
      // 把上一行 speaking 的标记为 done
      const prevSpeaking = lines.value.find(l => l.status === 'speaking')
      if (prevSpeaking) prevSpeaking.status = 'done'

      lines.value.push({ id: ++_nextId, text, status: 'speaking' })
    }
    // 保持最多 MAX_LINES 行
    while (lines.value.length > MAX_LINES) {
      lines.value.shift()
    }
    isSpeaking.value = true
  }

  function onSpeakEnd() {
    isSpeaking.value = false
    // 把 speaking 行标记为 done
    const last = lines.value[lines.value.length - 1]
    if (last && last.status === 'speaking') {
      last.status = 'done'
    }
  }

  function clear() {
    lines.value = []
    isSpeaking.value = false
  }

  const visibleLines = computed(() => lines.value.slice(-MAX_LINES))

  return { lines, visibleLines, isSpeaking, onSubtitle, onSpeakEnd, clear }
}
