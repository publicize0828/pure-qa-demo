<template>
  <TransitionGroup name="sub-line" tag="div" class="subtitle-display" v-if="lines.length">
    <div
      v-for="line in lines"
      :key="line.id"
      class="sub-line"
      :class="{ speaking: line.status === 'speaking', done: line.status === 'done' }"
    >
      <span class="sub-text">{{ line.text }}</span>
      <span v-if="line.status === 'speaking'" class="sub-cursor">|</span>
    </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import type { SubtitleLine } from '../composables/useSubtitle'

defineProps<{ lines: SubtitleLine[] }>()
</script>

<style scoped>
.subtitle-display {
  position: absolute;
  bottom: 120px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 150;
  max-width: 640px;
  width: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  pointer-events: none;
  overflow: hidden;
}

.sub-line {
  font-size: 16px;
  line-height: 1.7;
  text-align: center;
  padding: 4px 16px;
  border-radius: 8px;
  transition: all .35s ease;
  word-break: break-word;
}

.sub-line.done {
  color: rgba(255, 255, 255, .45);
  background: transparent;
}

.sub-line.speaking {
  color: #fff;
  background: rgba(0, 0, 0, .5);
  backdrop-filter: blur(6px);
  text-shadow: 0 1px 4px rgba(0, 0, 0, .3);
}

.sub-cursor {
  display: inline-block;
  animation: blink .8s step-end infinite;
  color: #fff;
  font-weight: 200;
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* TransitionGroup 动画 */
.sub-line-enter-active {
  transition: all .3s ease;
}
.sub-line-leave-active {
  transition: all .25s ease;
  position: absolute;
}
.sub-line-enter-from {
  opacity: 0;
  transform: translateY(12px);
}
.sub-line-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
.sub-line-move {
  transition: transform .3s ease;
}
</style>
