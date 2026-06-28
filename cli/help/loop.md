## Intent Loop 详细流程

每个 Intent 独立走一圈。Loop 终止条件：所有 Intent 为 completed 且无 needs_review（不动点达成）。

## Step 1：Keeper 选 Intent

\`\`\`bash
loom intent next          # 返回下一个可执行 Intent（pending 且依赖都 completed）
loom context              # 当前状态摘要（进度+下一步+风险）
\`\`\`

如果没有可执行的 Intent：
- 全部 completed → 项目阶段完成
- 有 blocked → 需要人工介入
- 有 in_progress 但无验证记录 → 可能上次中断，跑 \`loom doctor\` 诊断

## Step 2：更新状态

\`\`\`bash
loom intent update <id> --status in_progress
\`\`\`

## Step 3：Forge 实现

\`\`\`bash
loom activate forge
\`\`\`

Forge 加载：意图叙事 + 哲学锚点 + 验收契约，在约束下自主实现代码。
辅助命令（三个命令的分工）：
- \`loom intent narrative <id>\` — 读意图叙事（"为什么做"）
- \`loom verify contract <id>\` — 读验收契约（"做成什么样才算数"）
- \`loom intent trace <id>\` — 完整追溯链（叙事+契约+哲学锚点一次性加载，最常用）
- \`loom philosophy get <anchor>\` — 读哲学原则（遇到取舍时查）

## Step 4：Keeper 验证

\`\`\`bash
loom activate keeper
loom verify contract <id>     # 重新加载验收契约
\`\`\`

Keeper 独立验证四维度：
1. 意图忠实度 — 实现是否忠于原始意图叙事
2. 哲学一致性 — 实现是否符合哲学原则
3. 底线合规 — 是否违反 BASELINE
4. 验收达成 — 是否满足验收契约

写入验证记录：
\`\`\`bash
loom verify write --json-file verification.json
\`\`\`

验证记录格式（\`loom verify write\` 的输入）：
\`\`\`json
{
  "intent_id": "INT-001",
  "verdict": "passed",
  "timestamp": "2026-06-28T12:00:00.000Z",
  "summary": "具体证据描述——不是'看起来没问题'",
  "reproduction_command": "LLM_API_KEY=mock npm test",
  "dimensions": {
    "intent_fidelity": {
      "verdict": "passed",
      "evidence": "对照意图叙事第 2 段，extract.js 实现了完整编排"
    },
    "philosophy_consistency": {
      "verdict": "passed",
      "evidence": "AI_PHILOSOPHY 反模式逐条对照：JSON.parse 有 try/catch、fetch 有超时、无硬编码密钥"
    },
    "baseline_compliance": {
      "verdict": "passed",
      "evidence": "B1-B5 逐条合规"
    },
    "acceptance_achievement": {
      "verdict": "passed",
      "evidence": "6 条契约全部达成，npm test 6/6 pass"
    }
  }
}
\`\`\`
CLI 自动包装成 \`{ intent_id, records: [{ round, ... }] }\` 追加到验证文件。
\`dimensions\` 每个维度必须是 \`{ verdict, evidence }\` 对象——不允许只写"合规"，必须写具体证据。
\`reproduction_command\` 是复现验证的命令——别人跑这个命令能复现你的验证结果。L2 必填。

**evidence 写法参考**：
- 长度：每条 evidence 50-300 字符为宜。太短（"合规"）不达标，太长难读。
- 哲学一致性维度：按哲学锚点逐条对照反模式（见 keeper.md 的"承诺验证法"）
- 其他维度：写"对照了什么 + 在代码哪里看到/没看到"
- \`reproduction_command\` 注意平台差异：
  - Unix/Mac: \`LLM_API_KEY=mock npm test\`
  - Windows PowerShell: \`$env:LLM_API_KEY='mock'; npm test\`
  - Windows cmd: \`set LLM_API_KEY=mock && npm test\`
- \`node --test\` 在 Windows 上不能用目录路径（\`node --test test/\` 会报错），用 glob：\`node --test test/*.test.js\`

## Step 5：根据判定结果

| verdict | 处理 |
|---|---|
| passed | \`loom intent update <id> --status completed\`，回到 Step 1 |
| deviated | 与 Forge 对话修正，重新实现重新验证。连续 3 轮升级 blocked |
| blocked | \`loom intent update <id> --status blocked\`，停下报告用户 |
| pending_human | **手动模式**：等用户补充判定（L3 人类反馈）。7 天超时升级 blocked |

**AUTO 模式下的判定规则**（关键差异）：
- AUTO 模式开启时（\`loom auto on\`），**不允许 pending_human**
- Keeper 遇到 L3 verification_method 时，用 L1+L2 能耐自主判定所有维度
- 要么 passed（有证据），要么 deviated（有偏离说明），不停下等人类
- **持续运行，除非出意外否则不允许私自停止**
- "出意外" = blocked（依赖阻塞/契约无法判定/连续 3 轮 deviated 升级）、fatal 错误

## 变更回流

如果 Forge 发现验收契约不合理、或 Architect 的设计需要调整：
1. Keeper 评估变更范围（微调 vs 结构性变更）
2. 微调（验收措辞、验证方式）→ Keeper 直接改
3. 结构性变更（增减 Intent、改依赖）→ 重新激活 Architect
4. 受影响的已完成 Intent 标记为 needs_review

## 不动点收敛

默认单趟：所有 Intent 按拓扑序验证完毕且全 passed → done。

触发收敛：Pass 1 结束后还有 needs_review 的 Intent → 自动进入 Pass 2。
- Pass 2: 重验所有 needs_review 的 Intent
  - deviated → 修 → 重验
  - 修的时候又影响别的 → 标记 needs_review
  - passed → completed
- Pass 2 结束还有 needs_review → Pass 3
- Pass 3 结束还有 needs_review → blocked，报告"无法收敛"

收敛达成 = 一趟完整 pass 没有产生任何新的 needs_review（不动点）。
最大 3 趟，超过判定为系统性问题，需 Architect 介入。

详细规则见 .loom/v{N}/ 下的 INTENT_LOOP.md。