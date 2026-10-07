import { expect, test } from 'claude-code/testing'

import { clip, lineError, pushBody, turnSummary } from '../hooks/line'

const OPTIONS = { channelAccessToken: 'tok', to: 'U123' }
const run = (args: string) => ({
  command: 'line',
  args,
  origin: { kind: 'composer' } as const,
  presentation: { isFullscreen: true, columns: 160 },
})
const PANE_PROPS = {
  title: 'LINE',
  isFocused: true,
  bodyColumns: 50,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 30 },
  view: {},
}

test('helpers build the push body and read errors', () => {
  expect(JSON.parse(pushBody('U1', 'hi'))).toEqual({ to: 'U1', messages: [{ type: 'text', text: 'hi' }] })
  expect(Array.from(clip('一'.repeat(6000))).length).toBe(5000)
  expect(lineError(401, '{"message":"Authentication failed"}')).toBe('LINE API 401: Authentication failed')
  expect(turnSummary('done\n\nall good', 90_000)).toContain('1.5 分鐘')
})

test('/line <text> pushes to LINE with the token', { options: OPTIONS }, async ($, on) => {
  const calls: { url: string; auth?: string; body?: string }[] = []
  on('http.fetch', async (_$, e) => {
    calls.push({ url: e.url, auth: e.init?.headers?.Authorization, body: e.init?.body })
    return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
  })

  const ran = await $.command.run(run('午安'))
  expect(ran.text).toBe('已傳送到 LINE')
  expect(calls).toEqual([
    {
      url: 'https://api.line.me/v2/bot/message/push',
      auth: 'Bearer tok',
      body: '{"to":"U123","messages":[{"type":"text","text":"午安"}]}',
    },
  ])
})

test('/line explains the setup when unconfigured', async $ => {
  const ran = await $.command.run(run('hi'))
  expect(ran.text).toContain('LINE 尚未設定')
})

test('a LINE API error is reported', { options: OPTIONS }, async ($, on) => {
  on('http.fetch', async () => ({ value: { status: 400, ok: false, headers: {}, text: '{"message":"The request body has 1 error(s)"}' } }))
  const ran = await $.command.run(run('x'))
  expect(ran.text).toBe('LINE API 400: The request body has 1 error(s)')
})

test('the pane sends what is typed', { options: OPTIONS }, async ($, on) => {
  const bodies: string[] = []
  on('http.fetch', async (_$, e) => {
    bodies.push(e.init?.body ?? '')
    return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ plugin: 'line', surface, component: 'Pane', props: PANE_PROPS, requestId: 'line' })
    await ui.input({ key: 'compose', text: `from ${surface}` })
    expect(await ui.find({ text: `from ${surface}` })).toBeDefined()
  }
  expect(bodies.map(b => JSON.parse(b).messages[0].text)).toEqual(['from terminal', 'from desktop'])
})

test('Claude can send through the send_line tool', { options: OPTIONS }, async ($, on) => {
  const bodies: string[] = []
  on('http.fetch', async (_$, e) => {
    bodies.push(e.init?.body ?? '')
    return { value: { status: 200, ok: true, headers: {}, text: '{}' } }
  })
  const done = await $.tool.call({ tool: 'mcp__line__send_line', text: '建置完成' })
  expect(done.text).toBe('Sent to LINE.')
  expect(JSON.parse(bodies[0] ?? '{}').messages[0].text).toBe('建置完成')
})
