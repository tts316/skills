// Pure helpers: parse a VS Code .code-workspace file (JSONC) and resolve paths.

export type RawFolder = { path: string; name?: string }

/** Strips // and /* *\/ comments and trailing commas, leaving strings intact. */
export function stripJsonc(text: string): string {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === '"') {
      let j = i + 1
      while (j < n && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
      out += text.slice(i, j + 1)
      i = j + 1
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i++
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end < 0 ? n : end + 2
    } else {
      out += c
      i++
    }
  }
  return out.replace(/,(\s*[\]}])/g, '$1')
}

export function parseWorkspace(text: string): RawFolder[] {
  const data = JSON.parse(stripJsonc(text.replace(/^﻿/, '')))
  const folders = Array.isArray(data?.folders) ? data.folders : []
  return folders
    .filter((f: unknown): f is RawFolder =>
      typeof f === 'object' && f !== null && typeof (f as RawFolder).path === 'string')
    .map((f: RawFolder) => ({ path: f.path, name: typeof f.name === 'string' ? f.name : undefined }))
}

export function sepOf(path: string): string {
  return /^[A-Za-z]:\\/.test(path) || (path.includes('\\') && !path.includes('/')) ? '\\' : '/'
}

export function isAbsolute(path: string): boolean {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\')
}

export function dirname(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))
  if (cut < 0) return '.'
  if (cut === 0) return path.slice(0, 1)
  if (/^[A-Za-z]:$/.test(path.slice(0, cut))) return path.slice(0, cut + 1)
  return path.slice(0, cut)
}

export function basename(path: string): string {
  const trimmed = path.replace(/[\\/]+$/, '')
  return trimmed.slice(Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\')) + 1)
}

export function join(base: string, rel: string, sep = sepOf(base)): string {
  const parts = (base.replace(/[\\/]+$/, '') + sep + rel).split(/[\\/]+/)
  const out: string[] = []
  for (const p of parts) {
    if (p === '.') continue
    if (p === '..' && out.length > 1) out.pop()
    else out.push(p)
  }
  const joined = out.join(sep)
  return base.startsWith('/') && !joined.startsWith('/') ? '/' + joined : joined || sep
}

/** Resolves a folder path from the workspace file the way VS Code does. */
export function resolveFolder(workspaceFile: string, folderPath: string, home?: string): string {
  if (folderPath.startsWith('file://')) {
    folderPath = decodeURIComponent(folderPath.slice(7)).replace(/^\/([A-Za-z]:)/, '$1')
  }
  if (home && /^~([\\/]|$)/.test(folderPath)) return join(home, folderPath.slice(2) || '.')
  if (isAbsolute(folderPath)) return folderPath.replace(/[\\/]+$/, '') || folderPath
  return join(dirname(workspaceFile), folderPath, sepOf(workspaceFile))
}

/** Workspace title as VS Code shows it: file name without `.code-workspace`. */
export function workspaceTitle(file: string): string {
  return basename(file).replace(/\.code-workspace$/i, '')
}

/** Folder decoration from `git status --porcelain`, like VS Code's explorer. */
export function gitMarkOf(porcelain: string): 'modified' | 'untracked' | 'clean' {
  const lines = porcelain.split('\n').filter(l => l.trim() !== '')
  if (lines.length === 0) return 'clean'
  return lines.every(l => l.startsWith('??') || l.startsWith('A ')) ? 'untracked' : 'modified'
}
