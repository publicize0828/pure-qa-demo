// 优先从 window.__ENV__（运行时，ModelScope env.js 注入），fallback 到 import.meta.env（本地开发）
function env(key: string, fallback = '') {
  return (typeof window !== 'undefined' && window.__ENV__?.[key]) || import.meta.env[key] || fallback
}

export const LLM_API_KEY = env('VITE_LLM_API_KEY')
export const LLM_ENDPOINT = env('VITE_LLM_ENDPOINT')
export const LLM_MODEL = env('VITE_LLM_MODEL', 'qwen-flash')

export const ASR_APP_ID = env('VITE_ASR_APP_ID')
export const ASR_SECRET_ID = env('VITE_ASR_SECRET_ID')
export const ASR_SECRET_KEY = env('VITE_ASR_SECRET_KEY')

export const SDK_APP_ID = env('VITE_SDK_APP_ID')
export const SDK_APP_SECRET = env('VITE_SDK_APP_SECRET')
