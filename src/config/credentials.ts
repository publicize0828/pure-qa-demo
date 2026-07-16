import { SDK_APP_ID, SDK_APP_SECRET } from '../utils/env'

// 数字人网关（固定）
export const SDK_GATEWAY = 'https://nebula-agent.xingyun3d.com/user/v1/ttsa/session'

// 通过邀请码获取数字人凭证
// TODO: 替换为真实的魔搭 API 调用
export async function getSDKCredentials(_inviteCode: string): Promise<{ appId: string; appSecret: string }> {
  // 魔搭 API 占位 — 上线前替换为真实接口
  // const res = await fetch(`https://your-api/modelscope/credential?code=${inviteCode}`)
  // return res.json()

  // 临时：用 env 兜底
  return { appId: SDK_APP_ID.value, appSecret: SDK_APP_SECRET.value }
}
