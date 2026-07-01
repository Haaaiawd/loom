## Preview 指南

preview 是给人看的只读投影。它把 `.loom/v{N}` 的哲学、愿景、架构、Intent Map 和验证记录压缩成 `loom-preview.html`。

## 常用命令

```bash
loom preview status   # 只读检查 preview 是否存在、是否新鲜
loom preview          # 新鲜则打开；过期则提示重新生成
loom preview --regen  # 输出生成提示词，让 Agent 重写 loom-preview.html
loom preview --stale  # 强行打开过期 preview
loom preview --help   # 查看 preview 命令用法
```

## Agent 使用规则

当用户说“看看进度”“打开 preview”“让我看全局”时：

1. 先运行 `loom preview status`
2. 如果 `fresh=true`，运行 `loom preview`
3. 如果 `fresh=false`，不要打开旧页面，运行 `loom preview --regen`
4. 按提示词读取 `.loom/`，重写 `loom-preview.html`
5. 再运行 `loom preview` 打开

只有用户明确说要看旧版时，才使用 `loom preview --stale`。

## 新鲜度判断

LOOM 使用最小 mtime 机制，不做 hash：

```text
preview_mtime = loom-preview.html 修改时间
source_latest_mtime = 当前 .loom/v{N} 核心源文件最新修改时间

preview_mtime >= source_latest_mtime → fresh
否则 → stale
```

核心源文件包括：
- `00_PHILOSOPHY/`
- `01_VISION.md`
- `02_ARCHITECTURE.md`
- `03_DECISIONS/`
- `04_INTENT_MAP.json`
- `05_VERIFICATION.md`
- `06_CHANGELOG.md`
- `verifications/`

## 为什么不直接打开旧 preview

旧 preview 是假仪表盘风险：`.loom/` 已经进入 blocked、deviated 或完成新 Intent，但 HTML 仍显示旧状态。

所以普通 `loom preview` 在 stale 时会停止并提示 `loom preview --regen`。

## 生成责任

当前 CLI 不直接生成 HTML。`loom preview --regen` 输出提示词，要求 Agent 读取 `.loom/` 后生成 `loom-preview.html`。

CLI 负责判断是否过期和打开文件，Agent 负责把信息做成高质量视觉投影。
