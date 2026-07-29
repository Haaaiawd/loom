## Patch 审计工作流

Patch 只处理不改变 Intent 或验收契约的实现修正。`06_CHANGELOG.json` 是唯一权威来源，`06_CHANGELOG.md` 是 CLI 确定性生成的只读投影，不要手工编辑。

```bash
# 修改并自行运行验证后，准备输入文件
loom patch record --json-file patch.json
loom patch list
loom patch get PATCH-001
loom patch validate
```

输入格式：

```json
{
  "summary": "修复空输入崩溃",
  "reason": "解析器遗漏空字符串边界",
  "affects": ["INT-001"],
  "files": ["src/parser.js", "test/parser.test.js"],
  "verification": [
    { "command": "npm test", "result": "passed" },
    { "method": "agent-browser screenshot", "result": "passed", "evidence": "浅色和深色背景下均清晰可读" }
  ]
}
```

- `affects` 可省略；提供时每个 ID 必须存在于当前 Intent Map。
- `files` 必须是安全的项目相对路径。
- `verification` 每项提供 `command` 或 `method`，可附具体 `evidence`；至少有一个 `passed`。CLI 只记录结果，绝不执行命令。
- Patch 只能在当前版本全部 Intent 完成后记录；未完成的能力变化必须走 Intent Loop。
- `id` 和 `timestamp` 由 CLI 分配，输入中不要提供。
- `loom patch validate` 校验 JSON 全量记录及 Markdown 是否与 JSON 完全一致。
