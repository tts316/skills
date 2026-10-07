export type LineLog = { at: number; text: string; from: 'person' | 'claude' | 'notify'; error?: string }

declare module 'claude-code' {
  interface PluginState {
    line: { log: LineLog[] }
  }
}
