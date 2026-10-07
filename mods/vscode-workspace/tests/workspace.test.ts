import { expect, test } from 'claude-code/testing'

import { gitMarkOf, parseWorkspace, resolveFolder, workspaceTitle } from '../hooks/workspace'

const SAMPLE = `{
  // 聯成系統開發
  "folders": [
    { "path": "../job-resume", "name": "① 求職履歷系統" },
    { "path": "C:\\\\dev\\\\kpi", "name": "② 任務點數系統 (KPI)" },
    { "path": "purchase", }, /* 無名稱 */
  ],
  "settings": { "files.exclude": { "**/.git": true } },
}`

test('parses JSONC workspace folders', () => {
  expect(parseWorkspace(SAMPLE)).toEqual([
    { path: '../job-resume', name: '① 求職履歷系統' },
    { path: 'C:\\dev\\kpi', name: '② 任務點數系統 (KPI)' },
    { path: 'purchase', name: undefined },
  ])
})

test('resolves folder paths relative to the workspace file', () => {
  expect(resolveFolder('/home/u/ws/a.code-workspace', '../job-resume')).toBe('/home/u/job-resume')
  expect(resolveFolder('/home/u/ws/a.code-workspace', 'purchase')).toBe('/home/u/ws/purchase')
  expect(resolveFolder('D:\\work\\x.code-workspace', 'sub\\app')).toBe('D:\\work\\sub\\app')
  expect(resolveFolder('D:\\work\\x.code-workspace', 'C:\\dev\\kpi')).toBe('C:\\dev\\kpi')
  expect(resolveFolder('/w/a.code-workspace', '~/proj', '/home/u')).toBe('/home/u/proj')
})

test('titles and git marks', () => {
  expect(workspaceTitle('D:\\ws\\聯成系統開發-公司.code-workspace')).toBe('聯成系統開發-公司')
  expect(gitMarkOf('')).toBe('clean')
  expect(gitMarkOf('?? new.txt\n')).toBe('untracked')
  expect(gitMarkOf(' M a.ts\n?? b.ts\n')).toBe('modified')
})
