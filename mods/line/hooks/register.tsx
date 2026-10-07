import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { LineLog } from '../types'
import { PUSH_URL, lineError, pushBody, turnSummary } from './line'

const PANE = 'line'
const TOOL = 'send_line'
const log = atom({ plugin: 'line', key: 'log' } as const, [])

const SETUP_HINT =
  'LINE 尚未設定：請在 /config 填入「LINE Channel access token」與「收件人 ID」。'

type Config = { token: string; to: string }

/** Pushes one text message and logs it; resolves the error line, or undefined when sent. */
async function send($: EngineInterface, config: Config, text: string, from: LineLog['from']): Promise<string | undefined> {
  let error: string | undefined
  if (!config.token || !config.to) {
    error = SETUP_HINT
  } else {
    try {
      const res = await $.http.fetch(PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
        body: pushBody(config.to, text),
      })
      if (!res.ok) error = lineError(res.status, res.text)
    } catch (err) {
      error = `傳送失敗：${(err as Error).message}`
    }
  }
  await update($, log, list => [...list, { at: Date.now(), text, from, error }].slice(-100))
  return error
}

export const register: Register = (on, options) => {
  const config: Config = {
    token: String(options.channelAccessToken ?? '').trim(),
    to: String(options.to ?? '').trim(),
  }
  const notifyOnTurnEnd = options.notifyOnTurnEnd === true
  const notifyAfterMs = Number(options.notifyAfterSeconds ?? 60) * 1000
  const isReady = config.token !== '' && config.to !== ''

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'line',
      description: '開啟 LINE 面板；帶文字則直接傳到你的 LINE',
      argumentHint: '[訊息]',
    })
    await $.tool.register({
      name: TOOL,
      description:
        "Send a text message to the user's own LINE account (via their LINE Messaging API bot). " +
        'Use only when the user asks to be messaged or notified on LINE. Keep it short and in the user\'s language.',
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string', description: 'The message text (max 5000 characters)' } },
        required: ['text'],
      },
    })
    return next(e)
  })

  on('command.run', { command: 'line' }, async ($, e) => {
    const text = e.args.trim()
    if (text) {
      const error = await send($, config, text, 'person')
      return { text: error ?? '已傳送到 LINE' }
    }
    await $.ui.open({ id: PANE, title: 'LINE' })
    return { text: isReady ? 'LINE 面板已開啟' : SETUP_HINT }
  })

  on('tool.call', { tool: 'mcp__line__send_line' }, async ($, e) => {
    const text = typeof e['text'] === 'string' ? e['text'] : ''
    if (!text.trim()) return { isError: true, result: 'text is empty', text: 'text is empty' }
    const error = await send($, config, text, 'claude')
    return error
      ? { isError: true, result: error, text: error }
      : { result: { sent: true }, text: 'Sent to LINE.' }
  }).catch(() => ({ deny: 'LINE 傳送失敗' }))

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (notifyOnTurnEnd && isReady && !e.agentId && !e.isAborted && e.durationMs >= notifyAfterMs) {
      await send($, config, turnSummary(e.answer, e.durationMs), 'notify')
    }
    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const { Box, Text } = elements
    // mobile has no Input: there the pane only lists what was sent
    const Input = 'Input' in elements ? elements.Input : undefined
    const list = await read($, log)
    const room = Math.max(3, Math.floor(((e.viewport?.rows ?? 24) - 6) / 2))
    const label: Record<LineLog['from'], string> = { person: '我', claude: 'Claude', notify: '通知' }

    return (
      <Box flexDirection="column" gap={1}>
        {!isReady && <Text color="warning">{SETUP_HINT}</Text>}
        {list.length === 0 && <Text dimColor>還沒有傳送過訊息。</Text>}
        {list.slice(-room).map(item => (
          <Box flexDirection="column">
            <Text dimColor>
              {new Date(item.at).toLocaleTimeString()} · {label[item.from]}
              {item.error ? ' · 失敗' : ' · 已送出'}
            </Text>
            <Text color={item.error ? 'error' : undefined} wrap="wrap">
              {item.error ? `${item.text}\n${item.error}` : item.text}
            </Text>
          </Box>
        ))}
        {Input && (
          <Input
            key="compose"
            placeholder="輸入訊息，Enter 傳送到 LINE"
            submitLabel="傳送"
            onSubmit={(text: string) => {
              if (text.trim()) void send($, config, text.trim(), 'person')
            }}
          />
        )}
      </Box>
    )
  })
}
