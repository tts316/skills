// Pure helpers: parse a VS Code .code-workspace file (JSONC) and resolve paths.

export type RawFolder = { path: string; name?: string }

/** Strips // and /* *\/ comments and trailing commas, leaving strings intact. */
export function stripJsonc(text: string): string {
  return dropTrailingCommas(dropComments(text))
}

function scanString(text: string, i: number): number {
  let j = i + 1
  while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1
  return j + 1
}

function dropComments(text: string): string {
  let out = ''
  let i = 0
  const n = text.length
  while (i < n) {
    const c = text[i]
    if (c === '"') {
      const j = scanString(text, i)
      out += text.slice(i, j)
      i = j
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
  return out
}

function dropTrailingCommas(text: string): string {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      const j = scanString(text, i)
      out += text.slice(i, j)
      i = j
    } else if (c === ',' && /^\s*[\]}]/.test(text.slice(i + 1))) {
      i++
    } else {
      out += c
      i++
    }
  }
  return out
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

/** Drops trailing separators but keeps a root (`/`, `C:\\`) whole. */
export function trimSep(path: string): string {
  if (/^[A-Za-z]:[\\/]*$/.test(path)) return path.slice(0, 2) + sepOf(path)
  return path.replace(/[\\/]+$/, '') || path.slice(0, 1)
}

export function join(base: string, rel: string, sep = sepOf(base)): string {
  const isUnc = /^[\\/]{2}[^\\/]/.test(base)
  const parts = (base + sep + rel).split(/[\\/]+/).filter(p => p !== '' && p !== '.')
  // never climb above the root: a UNC share (server + share) or a drive letter
  const floor = isUnc ? 2 : /^[A-Za-z]:$/.test(parts[0] ?? '') ? 1 : 0
  const out: string[] = []
  for (const p of parts) {
    if (p !== '..') out.push(p)
    else if (out.length > floor) out.pop()
  }
  const joined = out.join(sep)
  if (isUnc) return sep + sep + joined
  if (base.startsWith('/')) return '/' + joined
  return /^[A-Za-z]:$/.test(joined) ? joined + sep : joined
}

/** Resolves a folder path from the workspace file the way VS Code does. */
export function resolveFolder(workspaceFile: string, folderPath: string, home?: string): string {
  if (folderPath.startsWith('file://')) {
    folderPath = decodeURIComponent(folderPath.slice(7)).replace(/^\/([A-Za-z]:)/, '$1')
  }
  if (home && /^~([\\/]|$)/.test(folderPath)) return join(home, folderPath.slice(2) || '.')
  if (isAbsolute(folderPath)) return trimSep(folderPath)
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
