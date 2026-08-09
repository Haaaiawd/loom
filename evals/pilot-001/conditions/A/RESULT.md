# Condition A 施工结果

状态：**已实现并验证第一个可运行纵向原型。**

这不是“设计文档完成”的替代说法：当前产物可以启动本地页面，读取 `sample-project` 的证据，生成三个可解释候选，让用户调整角色/目标、选择或跳过，并在首次明确同意后恢复上次选择。

## 启动方式

前提：Windows 11，Node.js 20 或更高版本。原型无第三方运行依赖，不需要 `npm install`，不需要联网。

双击：

```text
start.cmd
```

或在本目录运行：

```powershell
node src/server.js --open
```

服务会选择一个空闲端口，仅监听 `127.0.0.1`，打开带随机会话令牌的本地页面。终端中按 `Ctrl+C` 停止。浏览器文件夹对话框失败时，可在页面粘贴：

```text
D:\PROJECTALL\LOOM\evals\pilot-001\conditions\A\sample-project
```

若用户同意跨重启保存，状态写入 `%LOCALAPPDATA%\StartWorkbench\state.json`；拒绝时只保留在当前服务进程内。页面提供“清除选择”和“清除全部本地记录”。状态不会写进游戏项目。

## 已打通的核心路径

1. 选择文件夹，或粘贴绝对路径；
2. 仅读取根目录 `BACKLOG.md` 与历史来源；
3. 显示带行号的 5 个未决事项和带哈希的 4 条近期记录；
4. 明确把样例历史标记为 `fixture-export` / `GIT_LOG.txt 验收夹具`，不冒充实时 Git；
5. 选择程序角色时，风险候选首先是存档损坏调查；另外两个候选是 tutorial/ranged enemy 的近期连续性和 camera jitter 的程序相关性；
6. 美术角色时，存档风险仍保留，flooded archive 与 capsule images 进入另外两个槽位；
7. 修改今日目标并显式更新候选；跳过后从剩余事项稳定补位；少于 3 项时不伪造；
8. 展开原始 backlog/commit 证据，选择一个候选；首次保存前展示位置与内容并请求同意；
9. 重启后恢复“上次决定”快照，但不声称任务已完成。

## 安全与隐私边界

- 服务固定绑定 `127.0.0.1`，端口冲突时让操作系统选择其他空闲 loopback 端口；
- API 同时校验随机 session token、Host 与 Origin；
- 页面使用严格 CSP、`Cache-Control: no-store`、`Referrer-Policy: no-referrer`，无 CDN、远程字体、遥测或外部请求；
- 扫描器只构造 `BACKLOG.md`、`.git`、`GIT_LOG.txt` 三个受控目标，不接受任意文件读取 API，不递归读取源码；
- 单个来源限制为 1 MiB；项目根、backlog、fixture 或 `.git` 是链接/重解析点时拒绝；
- 不调用 `git` CLI，不在项目目录执行 shell、构建、脚本或写入；
- 原生文件夹选择器只执行工具自己的固定 PowerShell 脚本，不拼接项目内容为命令；
- 本地状态采用临时文件后原子替换，候选 ID 与输出对相同输入保持稳定。

## 完成证据

执行环境：Node `v22.16.0`。

```powershell
npm test
```

结果：**8/8 通过，0 失败**。覆盖：

- backlog 行号与 fixture 格式解析；
- `sample-project` 扫描前后内容摘要一致；
- 5 个 backlog 项、4 条 fixture commit、来源标记正确；
- 程序/美术/今日目标黄金候选、稳定性、去重、跳过补位、少于 3 项不伪造；
- 真实 `.git` 当前边界返回明确 `501 REAL_GIT_NOT_IMPLEMENTED`；
- loopback 监听、token、Host、Origin、CSP、no-store；
- API 扫描 → 候选 → 同意保存决定 → `state.json` 落盘；
- UI 静态资源不包含远程 URL、CDN、analytics 或 telemetry。

```powershell
npm run smoke
```

结果：

```text
SMOKE_OK loopback=127.0.0.1 port=<ephemeral> page=200 health=200
```

最终回归还直接打印了候选：

```text
programming
risk-blocker: Investigate save corruption reported after force-closing during scene transition. [2 evidence]
recent-continuity: Decide whether the tutorial should teach dodge before or after the first ranged enemy. [2 evidence]
role-goal: Fix boss-arena camera jitter when the player crosses the north trigger. [1 evidence]

art
risk-blocker: Investigate save corruption reported after force-closing during scene transition. [2 evidence]
recent-continuity: Replace placeholder ambience in the flooded archive. [2 evidence]
role-goal: Prepare three capsule images for the next internal playtest build. [2 evidence]
```

测试中的项目零写入证据不是靠人工观察：测试在扫描前后递归计算文件清单与内容 SHA-256 摘要并断言完全相同。`sample-project` 没有被修改。

## 未实现边界

1. **真实 `.git` 历史读取尚未实现。** 当前检测到 `.git` 会返回明确的 `501 REAL_GIT_NOT_IMPLEMENTED`，不会退回 `GIT_LOG.txt`，也不会把未知解释成“最近没有变化”。这意味着本次可运行原型只完成样例夹具纵切，尚不能声称兼容真实游戏仓库。
2. 没有解析 diff、分支拓扑、packed refs/objects、源码、构建结果或任务依赖；也没有调用 Git CLI。
3. Markdown 只支持根目录 `BACKLOG.md` 的普通顶层 `- ` / `* ` 列表。复选框、嵌套列表和复杂 frontmatter 不解释为项目语义。
4. 关键词/受控词表只证明了样例黄金路径。它会漏掉隐含语义，也可能误关联；界面始终展示原始证据并写明“可能相关”。
5. 中文目标与英文 backlog 只做浅层关键词/词表匹配，没有跨语言模型。
6. 自动化覆盖了服务、API、核心规则和静态资源，但没有完成真实浏览器的逐像素视觉回归、屏幕阅读器测试、Windows 11 不同企业策略下的文件夹对话框兼容性或人工两分钟计时。
7. 没有安装包、代码签名、自动更新或多人共享；这与首个原型范围一致。

## 实现中必须作出的假设

- Node.js 20+ 已安装且 `node` 在 `PATH` 中；`start.cmd` 会在缺失时明确提示，而不自动联网安装。
- 样例的 `GIT_LOG.txt` 是人为导出的验收夹具；只在根目录没有 `.git` 时读取。
- 产品工作名继续使用“开工台”，未把它当作确认品牌。
- 本地状态目录沿用设计稿中的 `%LOCALAPPDATA%\StartWorkbench`。
- 用户选择的文件夹本身不是链接/重解析点；为避免越界，原型选择拒绝而非跟随。

## 主要产物

```text
package.json                 运行与测试入口，无第三方依赖
start.cmd                    Windows 双击启动
scripts/choose-folder.ps1    工具自有原生文件夹选择器
src/server.js                loopback 服务、API 与会话防护
src/project.js               只读白名单扫描与解析
src/candidates.js            确定性三槽位候选与解释
src/state.js                 同意后本地原子持久化
src/ui/*                     单页安静工作台
tests/prototype.test.js      8 项自动化回归
tests/smoke.js               冷启动/页面/健康烟测
```

下一项最有价值的施工不是继续润色卡片，而是增加真正只读的 `.git` adapter，并用临时真实仓库分别覆盖 loose objects、packed refs/objects，再做浏览器端到端与 Windows 11 手工计时。当前 `501` 是有意留下的诚实边界，不是已完成能力。
