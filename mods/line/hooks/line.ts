// LINE Messaging API helpers: https://developers.line.biz/en/reference/messaging-api/#send-push-message

export const PUSH_URL = 'https://api.line.me/v2/bot/message/push'
export const MAX_TEXT = 5000

export function clip(text: string, max = MAX_TEXT): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : chars.slice(0, max - 1).join('') + '…'
}

export function pushBody(to: string, text: string): string {
  return JSON.stringify({ to, messages: [{ type: 'text', text: clip(text) }] })
}

/** Turns a LINE API error response into one readable line. */
export function lineError(status: number, body: string): string {
  try {
    const data = JSON.parse(body) as { message?: string; details?: { message?: string }[] }
    const detail = data.details?.map(d => d.message).filter(Boolean).join('; ')
    return `LINE API ${status}: ${data.message ?? body}${detail ? `（${detail}）` : ''}`
  } catch {
    return `LINE API ${status}: ${body.slice(0, 200)}`
  }
}

/** The LINE notification sent when a long turn finishes. */
export function turnSummary(answer: string, durationMs: number): string {
  const minutes = Math.round(durationMs / 6000) / 10
  const firstLines = answer.trim().split('\n').filter(l => l.trim()).slice(0, 6).join('\n')
  return clip(`✅ Claude Code 完成工作（${minutes} 分鐘）\n\n${firstLines || '（沒有文字回覆）'}`, 1000)
}
