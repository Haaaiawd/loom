# Pilot 001 盲评报告（修正版）

## 评审边界与计分口径

- 只检查 `judge/X` 与 `judge/Y` 内的问题/答案、设计、交接/Work Map、实现、RESULT 和证据；未查看 conditions、LOOM 源码、父目录中的实验条件或相关对话，也未联网。
- 第一轮按 X→Y 检查，随后刻意按 Y→X 复核。
- 统一采用 1–5 分，5 分代表该维度更强。`cost proxy` 的 5 分特指“从可见产物推测更精益、成本更低”，不是花费更多。
- 这只是一轮 Pilot。没有 token、wall-clock、工具调用次数或人工耗时 instrumentation，因此 `cost proxy` 只是方向性代理，不能当作真实成本测量。

## 勘误：旧匿名包的 harness 缺陷

初判使用了旧 `X/artifact` 与 `Y/artifact`。随后确认评测包构造器破坏了原始相对布局：

- 旧 `X/artifact` 把原本的 `prototype` 目录改名，导致测试仍按正确的原项目布局读取 `prototype/...` 时失败；
- 旧 `Y/artifact` 漏复制 `scripts/choose-folder.ps1`，并把 `sample-project` 放在错误层级。

这些是 **harness flawed**，不是 X/Y 的运行缺陷。旧初判曾给出 X 33/40、Y 29/40，并把 X 的 6 pass/8 fail、Y 的 3 pass/5 fail、Y picker 缺失计入 buildability 与 implementation evidence；这些扣分现全部撤销。该初判仅作为评测 harness 审计记录保留，不再代表当前结论。

修正版从保持原始相对布局的 `X/runtime` 与 `Y/runtime` 重跑：

- X：在 `X/runtime` 执行 `npm test --prefix prototype`，**21/21 通过**；`prototype/scripts/smoke-launch.ps1` 通过，记录 loopback ready、state round trip 与 graceful shutdown；`verify-readonly.mjs` 前后 SHA-256 相同；`verify-offline.mjs` 记录 5 个 loopback 请求、0 个 external 请求。
- Y：在 `Y/runtime` 执行 `npm test`，**8/8 通过**；`npm run smoke` 通过。`Y/runtime/scripts/choose-folder.ps1`、`Y/runtime/sample-project` 与 `Y/runtime/start.cmd` 均存在于实现预期位置。

下文只以修正版 runtime 的运行结果评价实现，不再把旧匿名包错误归因给被测方案。

## 修正后的方向性结论

**本轮仍方向性优选 X，但差距由初判的明显优势收窄为小幅优势。**

X 的核心优势不是文档数量，而是把事实、推断、未知、角色适配、证据不足和完成状态都变成了可执行契约。`X/design/evidence-recommendation.md`、`X/runtime/prototype/contracts/recommendation.schema.json` 与对应测试形成一条清楚的 evidence governance 链；当最终视觉证据不满足 done_when 时，当前 `X/WORK_MAP.json` 又把 TASK-004 从完成重开为 `blocked`，并记录 `completion_reopened` 与恢复条件。这使 X 的完成声明更可信、reset continuity 更强。

Y 的修正版则证明它不是“轻文档、弱实现”：`Y/runtime/tests/prototype.test.js` 8 项全部通过，覆盖只读扫描、候选稳定性、角色/目标变化、skip 补位、短 backlog、真实 Git 的诚实 501 边界、loopback 安全与状态持久化；picker 和启动路径也完整。Y 的角色不设墙、今日目标、单卡跳过补位和首次保存同意，比 X 更直接地服务用户能动性，且可见成本代理更低。

最终没有拉开大差距，是因为两者各有明确未完成边界：X 的自动化和三张真实截图较强，但 shortfall、input-error、accepted、restored、键盘、200% zoom 与实际双击/Ctrl+C 仍未完成；Y 的自动化核心闭环完整，但没有真实浏览器视觉/E2E、键盘/zoom 或两分钟人工计时证据，真实 `.git` adapter 也未实现。

## 修正后评分

| 维度 | X | Y |
|---|---|---|
| intent fidelity | **5/5** — `X/QUESTIONS.md` 把目标收敛为“两分钟恢复上下文并由人决定”，`X/ANSWERS.md` 明确固定角色、仅 `BACKLOG.md`/`GIT_LOG.txt`、离线只读、最多三个候选、可接受/跳过和本地记忆；这些均落到 `X/design/product.md`、`X/design/evidence-recommendation.md` 与 `X/runtime/prototype/src/ui/app.mjs`。没有把 owner、deadline、severity 或 dependency 冒充事实。 | **4/5** — `Y/ANSWERS.md` 的跨角色可见、可选今日目标、选择/跳过、首次保存说明均落到 `Y/PRODUCT.md`、`Y/EXPERIENCE.md`、`Y/runtime/src/candidates.js` 与 UI。扣分只在范围兑现：`Y/SYSTEM_DESIGN.md`/`WORK_PLAN.md` 把真实 `.git` 适配器纳入首版图景，而 `Y/runtime/src/project.js` 仍明确返回 `REAL_GIT_NOT_IMPLEMENTED`；sample fixture 纵切完整，但真实仓库能力未完成。 |
| question value | **5/5** — `X/QUESTIONS.md` 直接追问来源冲突、风险/阻塞/角色相对 recency 的优先关系、样例五项应先选哪项，以及最小闭环哪些不可缺；每个问题都实质改变架构、推荐政策或验收 oracle。 | **4/5** — `Y/QUESTIONS.md` 覆盖用户、痛点、决定权、来源、权限、离线、验收和非目标，信息完整；但联网 AI、引擎与安装形态等分支更泛，样例推荐校准不如 X 直接，用户回答表面积略大。 |
| whole-project coverage | **5/5** — `X/design/` 覆盖产品、解析、推荐、状态、架构、安全、UI、视觉、验证和 Windows 运行；`X/WORK_MAP.json` 把契约→纯核心→UI/状态→包装验证串成依赖链；`X/runtime/prototype/` 中均有对应实现、合同、测试、脚本和证据。 | **4/5** — `Y/PRODUCT.md`、`EXPERIENCE.md`、`SYSTEM_DESIGN.md`、`WORK_PLAN.md` 与 `Y/runtime/src/` 覆盖完整产品纵切，picker/launcher 也已交付。扣分在真实 Git 尚未实现、没有视觉证据包，以及施工后的 Work Plan/HANDOFF 没有更新为当前进度面。 |
| professional capability depth | **5/5** — `X/design/evidence-recommendation.md` 将 `source_fact`、`bounded_inference`、`unknowns`、`direct/coordination/clarification`、distinct anchor 与 honest shortfall 变成数据契约；`X/runtime/prototype/contracts/` 与 21 项测试固化这些约束。浏览器读项目、服务只存选择的架构也显著缩窄服务器权限。 | **4/5** — `Y/SYSTEM_DESIGN.md` 的三理由槽位、受控词表、弱关联措辞、loopback/token/Host/Origin 与同意后原子持久化都有专业判断；`Y/runtime/src/candidates.js` 实现稳定 tie-break、去重、skip 补位和证据引用。扣分在 `Y/runtime/src/state.js` 只核对 `schemaVersion` 后合并状态，缺少严格运行时 state schema 验证。 |
| buildability / reset continuity | **5/5** — 修正版 `X/runtime` 中 21/21 测试、read-only、offline 和 Windows smoke 全部通过。`X/WORK_MAP.json` 还提供逐 Task outcome、done_when、边界、依赖、精确 reads/touches、证据和恢复条件，并能在证据不足时重开最终 Task；这是本轮最强的 reset continuity。 | **4/5** — 修正版 `Y/runtime` 8/8 与 smoke 全过，`start.cmd`、picker 和 sample 布局完整，实际可构建运行。`Y/HANDOFF.md` 对塑形阶段交接清楚，但仍停留在“尚未开始实现”并指向当前匿名文档集中没有的 `BRIEF.md`；施工后的真实状态主要依赖 `Y/RESULT.md`，没有一份同步更新的 Work Map/HANDOFF，所以不打 5。 |
| implementation evidence | **4/5** — `X/runtime/prototype/src/` 不是静态 mock；21 项测试覆盖合同、输入突变、负面输入、角色差异、状态重启、请求边界与 UI code path。盲评重跑 read-only digest、offline 和 state smoke 均通过；`X/artifact/evidence/screenshots/idle.png`、`programmer.png`、`artist.png` 可目视核对。未打 5 是因为 `X/RESULT.md` 与 `X/WORK_MAP.json` 明确承认最终视觉/交互验收仍不完整。 | **4/5** — `Y/runtime/tests/prototype.test.js` 8/8 证明解析、sample 零写入、黄金候选、稳定性、角色/目标、skip、短 backlog、loopback 防护和跨重启状态；`npm run smoke` 证明本地页面/health。未打 5 是因为没有真实浏览器完整主路径、视觉状态、键盘/zoom 或人工两分钟证据，smoke 也不覆盖扫描→选择→重启的浏览器交互。 |
| user burden / ceremony | **3/5** — `X/runtime/prototype/src/ui/index.html` 的用户主路径很短：文件夹、角色、读取、候选接受或整体跳过；但生产侧维护了多份重复边界说明、多个 capability dossier 和高度细粒度 reads/touches，流程 ceremony 明显，有压缩空间。 | **4/5** — 修正版 picker 存在，用户不必手填路径；`Y/runtime/src/ui/index.html` 的角色、今日目标、单卡跳过、找回跳过项、持久化同意与清除都有明确价值。操作比 X 多，但大多可选并直接增加可逆性；文档/验证层也更精简。 |
| cost proxy | **2/5** — `X/capabilities/`、`X/design/`、四阶段详细 Work Map、三类契约、分层测试和视觉证据构成更大的生产表面积。它换来更强边界与连续性，但可见代理信号偏高；没有 instrumentation，不能断言真实花费。 | **4/5** — `Y/PRODUCT.md`、`EXPERIENCE.md`、`SYSTEM_DESIGN.md`、一个主回归文件和较小实现面显示更精益，而修正版 8/8 与 smoke 说明这种精简仍得到实质闭环。它仍欠视觉 E2E、严格 state contract 与真实 Git，但不能再把 harness 缺陷算作“低成本带来的实现破损”。 |

修正后辅助总分：X **34/40**，Y **32/40**。

2 分差不应被读成统计显著性。若本轮更重视证据治理、失败后重启与交接连续性，X 更合适；若更重视尽快得到可用的用户能动性原型与较低成本代理，Y 很有竞争力。

## 关键实现与证据复核

### X

已证实：

- `X/runtime/prototype/src/core/input-parser.mjs` 与 `recommendation.mjs` 会随输入变化，候选按角色变化，并保留 source fact、bounded inference 和 unknowns。
- `npm test --prefix prototype`：21/21，通过合同、unit 和 integration 全集。
- `verify-readonly.mjs`：sample 前后 SHA-256 均为 `3e56ef730cd38618c3ab8cec406f4bb2011a9592c0a057ce6bcca48da00ee482`。
- `verify-offline.mjs`：`loopback_requests=5, external_requests=0`。
- `smoke-launch.ps1`：观察到 Node version、assigned loopback URL、state round trip 与 graceful shutdown。
- `X/artifact/evidence/screenshots/idle.png`、`programmer.png`、`artist.png` 与 visual review 描述相符，界面层级、角色差异、证据和未知项清楚。

仍有限制：

- `X/artifact/evidence/visual-review.md` 与 `X/RESULT.md` 明确列出 shortfall、input-error、accepted、restored、键盘、200% zoom 和真实 wrapper 交互未验证。
- `X/runtime/prototype/scripts/verify-offline.mjs` 是 Node fetch trap 加静态 HTML 检查，不等同于真实浏览器 network capture；因此 offline 证据有效但有边界。
- 当前 `X/WORK_MAP.json` 正确将 TASK-004 保持为 `blocked`，没有把上述缺口藏在自动化绿灯后面。

### Y

已证实：

- `Y/runtime/src/project.js` 从 `Y/runtime/sample-project` 得到 5 个 backlog 项和 4 条 fixture commits，保留行号并标记 `fixture-export`；测试递归 digest 证明 sample 零写入。
- `Y/runtime/src/candidates.js` 对程序角色生成 save corruption、tutorial/ranged continuity、camera role 候选；美术角色保留跨角色 save risk，同时选择 ambience 与 capsule images；目标与 skip 会稳定改变结果。
- `Y/runtime/tests/prototype.test.js`：8/8，通过核心、API 安全、持久化重启和静态资源检查。
- `Y/runtime/tests/smoke.js`：本地页面和 health 均为 200，仅监听 `127.0.0.1`。
- `Y/runtime/scripts/choose-folder.ps1`、`start.cmd` 与 sample 均在实现引用的相对位置；旧匿名包缺失不能归因给 Y。

仍有限制：

- `Y/runtime/src/project.js` 遇到真实 `.git` 返回诚实的 501；没有 diff、packed refs/objects 或真实仓库读取能力。
- `Y/runtime/src/state.js` 缺少严格字段白名单/类型校验，损坏 JSON 能恢复，但 schemaVersion 1 的结构扩张不会被拒绝。
- 没有真实浏览器截图、交互 E2E、键盘/zoom 或两分钟人工计时；`Y/RESULT.md` 已承认这些边界。

## 双顺序复核与顺序敏感性

原始 X→Y 阅读中，X 的契约深度、测试分层和完成状态重开先建立了较高可信度；随后 Y 的今日目标、skip/consent 和较小实现面显示出明显的产品与成本优势。

按 Y→X 倒序复核时，修正版 Y 的 8/8、smoke 和完整 picker 消除了初判中最显眼的负面项；再看 X，21/21、独立 read-only/offline/smoke 和 `completion_reopened` 仍让它在证据治理与 reset continuity 上领先。两次方向均为 X 小幅领先，但倒序后更能看见 Y 与 X 的真实距离很近。

修正后评估为**低顺序敏感性**：顺序改变了对差距大小的直觉，没有改变方向。旧报告中的“低到中等敏感性”有一部分实际上来自 harness 缺陷，现予以撤回。

## 各自最强、最弱与机制取舍

### X

- 最强点：把“不要编造”变成可执行结构。`source_fact` / `bounded_inference` / `unknowns`、distinct anchors、direct/coordination/clarification、evidence shortfall，再加上完成状态可被证据推翻并重开，构成本轮最可信的闭环。
- 最弱点：流程和文档层偏重。多个 capability dossier、design 文档与逐文件 reads/touches 有重复表达；质量收益真实存在，但边际成本看起来较高。
- 最值得保留：**完成声明可被证据缺口推翻并重开**，以及**事实/推断/未知的机器可检验契约**。
- 最值得删除/压缩：**重复 capability dossier 与逐文件上下文仪式**。把真正改变设计的专业判断压缩进少数决策记录和验证矩阵，不必删除约束本身。

### Y

- 最强点：用户能动性机制。角色不设墙、可选今日目标、三理由槽位、单卡 skip 补位、首次持久化同意与清除状态，让建议可调、可逆、可反驳。
- 最弱点：专业边界虽写得清楚，但部分还没合同化或形成真实体验证据；典型是 state 只做宽松版本检查，以及没有浏览器/视觉/可用性验证。
- 最值得保留：**三理由槽位 + skip 补位 + 明确持久化同意**。这组机制既产生候选差异，也让本地写入成为知情选择。
- 最值得删除/延期：**把真实 `.git` adapter 放进首轮纵切完成版图**。sample fixture 已能验证核心价值；先完成严格 state contract 与浏览器主路径，再把真实 Git 作为独立适配器里程碑。

## 下一轮建议

下一轮应继续保持题目与验收夹具不变，只新增统一观测：

1. 自动记录 token、wall-clock、工具调用数、用户回答数与用户操作数；
2. 统一在保持原始相对布局的可搬移 runtime 上执行测试、smoke 与启动路径，并把 harness 自测列为评测前置条件；
3. 固定“完成”的最低证据：核心自动化、至少一条真实浏览器主路径、失败态、键盘/zoom，以及当前化的 reset/handoff；
4. 至少重复多轮并交换匿名映射，才判断 X 的额外 ceremony 是否产生稳定净收益，或 Y 的精益能否在补强 evidence contract 后反超。

当前最诚实的结论是：**X 在可信闭环上小胜，Y 在用户能动性和成本代理上更优；没有 instrumentation 和重复样本，不能把这轮结果推广成框架优劣定论。**
