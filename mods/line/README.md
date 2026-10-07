# line

Claude Code 的 mod：在 Claude Code（終端機或桌面程式的 Code 分頁）裡開一個 **LINE 面板**，把訊息傳到你自己的 LINE。

## 功能

- **LINE 面板**：`/line` 開啟，輸入框打字按 Enter 就傳到 LINE，上方列出傳送紀錄與錯誤
- **快速傳送**：`/line 今天的部署完成了` 直接傳
- **讓 Claude 傳**：Claude 多了一個 `send_line` 工具，你可以說「做完用 LINE 通知我」
- **任務完成通知**（選用）：Claude 一輪工作超過設定秒數時，自動把結果摘要傳到 LINE

> 只能「傳出」。LINE 不開放讀取個人聊天室；要在面板裡收到 LINE 訊息，需要一台對外公開的伺服器接收 LINE 的 webhook，這個 mod 目前不包含。

## 設定（一次）

1. 到 [LINE Developers](https://developers.line.biz/console/) 用你的 LINE 帳號登入，建立一個 Provider，再建立 **Messaging API** channel（會同時建立一個 LINE 官方帳號）。
2. 在 channel 的 **Messaging API** 頁籤：
   - 用手機 LINE 掃 QR code，把這個官方帳號**加為好友**（沒加好友收不到訊息）
   - 最下面 **Channel access token (long-lived)** 按 Issue，複製
3. 在 **Basic settings** 頁籤最下面複製 **Your user ID**（`U` 開頭）。
4. 在 Claude Code 輸入 `/config`，找到 `line` 的設定列填入：
   - `LINE Channel access token`：步驟 2 的 token
   - `收件人 ID`：步驟 3 的 user ID
   - `任務完成通知`／`通知門檻（秒）`：需要的話打開

Token 會存在 `~/.claude/settings.json` 的 `pluginConfigs.line.options`，請勿分享這個檔案。

## 載入

```sh
claude --plugin-dir ./mods/line
```

或設定環境變數 `CLAUDE_CODE_PLUGIN_DIRS`，桌面程式的 Code 分頁（本機工作階段）也會載入。多個 mod 用分號隔開（Windows）：

```powershell
[Environment]::SetEnvironmentVariable('CLAUDE_CODE_PLUGIN_DIRS', 'D:\AI-SYS\skills\mods\vscode-workspace;D:\AI-SYS\skills\mods\line', 'User')
```

## 開發

```sh
claude plugin validate mods/line
claude plugin test mods/line
```
