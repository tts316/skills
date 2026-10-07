export type GitMark = 'modified' | 'untracked' | 'clean' | 'none'

export type Entry = { name: string; path: string; isDir: boolean }

export type Folder = { name: string; path: string; git: GitMark }

export type Workspace = { file: string; name: string; folders: Folder[] }

declare module 'claude-code' {
  interface PluginState {
    'vscode-workspace': {
      workspace: Workspace | null
      error: string | null
      expanded: string[]
      children: Record<string, Entry[]>
    }
  }
}
