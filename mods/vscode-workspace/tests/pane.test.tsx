import { expect, test } from 'claude-code/testing'

const WS = '/w/team.code-workspace'
const FILES: Record<string, string> = {
  [WS]: '{ "folders": [ { "path": "app", "name": "① 求職履歷系統" }, { "path": "/srv/kpi" } ] }',
}

test('/workspace loads the file and draws its folders', async ($, on) => {
  on('fs.read', async (_$, e) => {
    const text = FILES[e.path]
    if (text === undefined) throw new Error(`ENOENT ${e.path}`)
    return { value: text }
  })
  on('store.get', async () => ({ value: undefined }))
  on('store.set', async () => ({ value: undefined }))
  on('ui.open', async () => ({ value: { isPlaced: true } as const }))
  on('fs.list', async () => ({ value: [{ name: 'src', kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false }] }))
  on('process.run', async () => ({ value: { exitCode: 0, stdout: ' M x.ts\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }))

  const ran = await $.command.run({
    command: 'workspace',
    args: WS,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 160 },
  })
  expect(ran.text).toContain('team')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({
      plugin: 'vscode-workspace',
      surface,
      component: 'Pane',
      props: {
        title: '檔案總管',
        isFocused: false,
        bodyColumns: 40,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 30 },
        view: {},
      },
      requestId: 'vscode-workspace',
    })
    expect(await ui.find({ text: /team \(工作區\)/ })).toBeDefined()
    expect(await ui.find({ text: '① 求職履歷系統' })).toBeDefined()
    expect(await ui.find({ text: 'kpi' })).toBeDefined()
    expect(await ui.find({ text: /無法讀取/ })).toBeUndefined()
    expect(await ui.find({ text: '●' })).toBeDefined()

    await ui.press({ key: 'toggle:0' })
    expect(await ui.find({ key: 'dir:/w/app/src' })).toBeDefined()
    await ui.press({ key: 'toggle:0' })
    expect(await ui.find({ key: 'dir:/w/app/src' })).toBeUndefined()
  }
})
