import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderChildren } from 'claude-code'

import type { Entry, Folder, GitMark, Workspace } from '../types'
import {
  basename,
  gitMarkOf,
  join,
  parseWorkspace,
  resolveFolder,
  sepOf,
  workspaceTitle,
} from './workspace'

const PLUGIN = 'vscode-workspace'
const PANE = 'vscode-workspace'
const STORE_KEY = 'workspaceFile'
const HIDDEN = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db'])

const workspace = atom({ plugin: 'vscode-workspace', key: 'workspace' } as const, null)
const error = atom({ plugin: 'vscode-workspace', key: 'error' } as const, null)
const expanded = atom({ plugin: 'vscode-workspace', key: 'expanded' } as const, [])
const children = atom({ plugin: 'vscode-workspace', key: 'children' } as const, {})

const GIT_COLOR: Record<GitMark, string | undefined> = {
  modified: 'warning',
  untracked: 'success',
  clean: undefined,
  none: undefined,
}

async function gitMark($: EngineInterface, dir: string): Promise<GitMark> {
  try {
    const run = await $.process.run(['git', 'status', '--porcelain'], { cwd: dir, timeoutMs: 10_000 })
    return run.exitCode === 0 ? gitMarkOf(run.stdout) : 'none'
  } catch {
    return 'none'
  }
}

async function homeDir($: EngineInterface): Promise<string | undefined> {
  try {
    return (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')) ?? undefined
  } catch {
    return undefined
  }
}

/** Finds a *.code-workspace file in the working directory. */
async function findWorkspaceFile($: EngineInterface): Promise<string | undefined> {
  const cwd = await $.session.cwd()
  const entries = await $.fs.list(cwd).catch(() => [])
  const hit = entries.find(e => e.kind === 'file' && /\.code-workspace$/i.test(e.name))
  return hit ? join(cwd, hit.name) : undefined
}

async function loadWorkspace($: EngineInterface, file: string): Promise<void> {
  try {
    const text = await $.fs.read(file)
    const home = await homeDir($)
    const raw = parseWorkspace(text)
    const folders: Folder[] = await Promise.all(
      raw.map(async f => {
        const path = resolveFolder(file, f.path, home)
        return { name: f.name ?? basename(path), path, git: await gitMark($, path) }
      }),
    )
    const ws: Workspace = { file, name: workspaceTitle(file), folders }
    await update($, workspace, () => ws)
    await update($, error, () => null)
    await update($, children, () => ({}))
    await $.store.set(STORE_KEY, file).catch(() => undefined)
    // keep previously expanded folders open
    for (const path of await read($, expanded)) await loadChildren($, path)
  } catch (err) {
    await update($, error, () => `無法讀取工作區檔 ${file}：${(err as Error).message}`)
  }
}

async function loadChildren($: EngineInterface, dir: string): Promise<void> {
  const list = await $.fs.list(dir).catch(() => [])
  const sep = sepOf(dir)
  const entries: Entry[] = list
    .filter(e => !HIDDEN.has(e.name))
    .map(e => ({ name: e.name, path: dir + sep + e.name, isDir: e.kind === 'dir' }))
    .sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1))
  await update($, children, all => ({ ...all, [dir]: entries }))
}

async function toggle($: EngineInterface, path: string): Promise<void> {
  const isOpen = (await read($, expanded)).includes(path)
  if (isOpen) {
    await update($, expanded, list => list.filter(p => p !== path))
  } else {
    await loadChildren($, path)
    await update($, expanded, list => [...list, path])
  }
}

async function openPane($: EngineInterface, args: string): Promise<string> {
  const given = args.trim().replace(/^["']|["']$/g, '')
  const file =
    given ||
    ((await $.store.get(STORE_KEY).catch(() => undefined)) as string | undefined) ||
    (await findWorkspaceFile($))
  if (!file) {
    return '找不到工作區檔。用法：/workspace <路徑/xxx.code-workspace>'
  }
  await loadWorkspace($, file)
  const opened = await $.ui.open({ id: PANE, title: '檔案總管' })
  return opened.isPlaced
    ? `已開啟工作區：${workspaceTitle(file)}`
    : `工作區已載入，但面板尚未顯示（${opened.reason}）`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'workspace',
      description: '開啟 VS Code 工作區總管（讀取 .code-workspace 檔）',
      argumentHint: '[路徑.code-workspace]',
    })
    await $.command.register({
      name: 'workspace-refresh',
      description: '重新讀取工作區檔與 git 狀態',
    })
    return next(e)
  })

  on('command.run', { command: 'workspace' }, async ($, e) => ({ text: await openPane($, e.args) }))

  on('command.run', { command: 'workspace-refresh' }, async $ => {
    const ws = await read($, workspace)
    if (!ws) return { text: '尚未載入工作區，請先執行 /workspace' }
    await loadWorkspace($, ws.file)
    return { text: '工作區已重新整理' }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const ws = await read($, workspace)
    const err = await read($, error)
    const open = new Set(await read($, expanded))
    const kids = await read($, children)

    const rows: RenderChildren[] = []
    const walk = (dir: string, depth: number) => {
      for (const entry of kids[dir] ?? []) {
        const isOpen = open.has(entry.path)
        rows.push(
          <Box key={`row:${entry.path}`} flexDirection="row" paddingLeft={depth * 2}>
            {entry.isDir ? (
              <Button
                key={`dir:${entry.path}`}
                plain
                label={`${isOpen ? '∨' : '›'} ${entry.name}`}
                onPress={() => void toggle($, entry.path)}
              />
            ) : (
              <Button
                key={`file:${entry.path}`}
                plain
                dimColor
                label={`  ${entry.name}`}
                onPress={press => void $.ui.copy({ text: entry.path, surface: press.surface })}
              />
            )}
          </Box>,
        )
        if (entry.isDir && isOpen) walk(entry.path, depth + 1)
      }
    }

    if (ws) {
      ws.folders.forEach((folder, index) => {
        const isOpen = open.has(folder.path)
        const color = GIT_COLOR[folder.git]
        rows.push(
          <Box key={`folder:${index}`} flexDirection="row" justifyContent="space-between" paddingLeft={1}>
            <Box flexDirection="row" gap={1}>
              <Button
                key={`toggle:${index}`}
                plain
                dimColor
                label={isOpen ? '∨' : '›'}
                onPress={() => void toggle($, folder.path)}
              />
              <Text color={color} wrap="truncate-end">{folder.name}</Text>
            </Box>
            {color && <Text color={color}>●</Text>}
          </Box>,
        )
        if (isOpen) walk(folder.path, 2)
      })
    }

    return (
      <Box flexDirection="column">
        {err && <Text color="error">{err}</Text>}
        {!ws && !err && <Text dimColor>尚未載入工作區。執行 /workspace &lt;檔案.code-workspace&gt;</Text>}
        {ws && (
          <Box flexDirection="row" justifyContent="space-between">
            <Text bold>∨ {ws.name} (工作區)</Text>
            <Button key="refresh" plain dimColor label="↻" onPress={() => void loadWorkspace($, ws.file)} />
          </Box>
        )}
        {rows}
      </Box>
    )
  })
}
