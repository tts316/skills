# vscode-workspace

Claude Code 的 mod（函式 hooks 外掛）：仿 VS Code「檔案總管」的工作區側邊面板，直接讀取 VS Code 的 `.code-workspace` 檔。

## 功能

- 讀取 `.code-workspace`（支援 JSONC 註解與尾逗號），依 `folders` 的順序列出各資料夾，顯示 `name`（沒有則用資料夾名稱）
- 相對路徑以工作區檔所在目錄為基準解析，也支援絕對路徑、Windows 路徑（`C:\...`）、`~` 與 `file://`
- 點 `›` / `∨` 展開或收合資料夾，可逐層瀏覽子目錄（資料夾在前，隱藏 `.git`、`node_modules`）
- 依 `git status --porcelain` 為資料夾上色，跟 VS Code 一樣：有修改 → 橘色 `●`，只有新增檔 → 綠色 `●`
- 點檔案會把完整路徑複製到剪貼簿
- 記住上次開啟的工作區檔，下次只要打 `/workspace`

## 指令

| 指令 | 說明 |
| --- | --- |
| `/workspace <路徑.code-workspace>` | 載入指定的工作區檔並開啟面板 |
| `/workspace` | 開啟上次的工作區；沒有的話就找目前目錄下的 `*.code-workspace` |
| `/workspace-refresh` | 重新讀取工作區檔與 git 狀態（面板右上角的 `↻` 也可以） |

## 載入

```sh
claude --plugin-dir ./mods/vscode-workspace
```

## 開發

```sh
claude plugin validate mods/vscode-workspace
claude plugin test mods/vscode-workspace
```
