# 魔珐数字人纯对话 Demo

基于魔珐有灵（XmovAvatar）SDK 的纯对话交互 Demo，支持语音对话、文本问答、语音播报三种模式。

## 体验地址

👉 [https://publicize0828.github.io/pure-qa-demo/](https://publicize0828.github.io/pure-qa-demo/)

## 功能

- 🎤 语音交互：按住说话，ASR 识别 + LLM 回复
- 💬 文本问答：输入文字，LLM 智能回答
- 🔊 语音播报：文字转语音播报
- 👤 多角色人格：可切换不同对话风格
- 🎭 数字人驱动：实时口型同步

## 本地开发

```bash
pnpm install
pnpm dev
```

## 获取凭证

1. [魔珐星云官网](https://xingyun3d.com/) 注册
2. 邀请码 **JU6AD24X9V**（1000 积分）
3. 创建横屏应用 → 复制 APP ID / SECRET

## 技术栈

Vue 3 + TypeScript + Vite + XmovAvatar SDK + OpenAI SDK

## 技术手册

详见 [TECH.md](TECH.md)
