# Replay - loom-v2-final-loop-audit

- goal: 审计并闭合 LOOM 从自然对话到专业能力、Work Map、Keeper 迭代、施工证据与 Evil Eval 的完整用户和系统流程
- mode: audit
- totalSteps: 8
- currentStep: 8
- status: completed

## Steps

### Step 1

- shouldConverge: false
- mustConclude: false

先纠正评测对象：主实验不是 LOOM v2 对旧 LOOM，而是同一个正常能力的 Agent 在完全相同模型、工具、仓库、用户事实、预算下，A 条件没有任何 LOOM，B 条件可使用 LOOM。旧 LOOM v1 只适合做可选回归对照，不能代替无框架 baseline。要比较的是结果忠实度、问题价值、专业判断、上下文重置后的连续性、可开工性，以及为此付出的用户负担、token 和时间。

### Step 2

- shouldConverge: false
- mustConclude: false

把生产流程拆成三个真正的循环而非一条流水线。理解循环在描述全貌、发现未知、成组询问、记录、能力补足、更新全貌之间往返。就绪循环在 project ready、陌生 Keeper、needs_revision、反馈注回理解循环、新 Keeper run 之间往返。施工循环在选择 Task、注入相关上下文、执行、测试、失败修正或上层回流、证据闭合、下一 Task 之间往返。Evil Eval 是外部实验环，不应侵入用户项目流程。

### Step 3

- shouldConverge: false
- mustConclude: false

审计现状发现 Keeper 回流不完整。needs_revision 虽把 project.status 设回 shaping，但 loom context 没有显示最新 Keeper summary、gaps 和 evidence；record 也不要求 fresh run_id，且没有检查 project ready 后文档是否被修改。结果是 Agent 可能不知道该修什么，同一验证者可假装独立复验，或使用过期准备状态写 verdict。需要把反馈、唯一 run_id、prepared digest 和再次 project ready 变成强契约。

### Step 4

- shouldConverge: false
- mustConclude: false

施工环也有绕过风险。通用 task update 目前允许直接把 status 改成 done，从而绕过 evidence；缺少显式 blocked 与 reopen 语义。应禁止通用 update 修改 status，保留 start 与 done 为强入口，并增加 block 与 reopen。失败但范围未变时保持 active 并更新 progress；缺权限或上层设计错误时 block，记录具体原因与恢复条件；修订后 reopen 再 start。全部 done 才 complete。

### Step 5

- shouldConverge: false
- mustConclude: false

UI 与 UX 应按责任分层。人类界面只有自然对话：初次看到成品轮廓与成组问题，迭代时只看到新增校准和真正需要回答的矛盾，开工前看到即将施工的结果、关键假设和高风险授权点。Agent 界面是 CLI：context 恢复，record 落盘，capability 管能力，task 管施工，keeper 管一次就绪审查，check 管结构。Keeper 失败通常不需要把框架错误暴露给用户；Agent 先根据 gaps 自主修文档和 Task，只有 gap 指向缺失用户决策时才自然追问。

### Step 6

- shouldConverge: true
- mustConclude: false

文档闭环应以当前真相为中心。PROJECT 描述全貌，DECISIONS 只保存关键沿革，能力卷宗把多个专业领域围绕一个决策综合但区分贡献，tasks 保存宽计划与当前执行证据。Keeper feedback 是暂态结构化输入，修正后仍保留 attempts 供审计，但当前 PROJECT 与 Task 必须吸收其影响。context 不应把全部历史和 Work Map 注入，只注当前真相、当前反馈和当前 Task 相关卷宗。

### Step 7

- shouldConverge: true
- mustConclude: false

虚拟项目应让差异有机会出现而不是偏袒 LOOM。用同一个含糊但可实现的 Windows 本地工具 brief，两个同模型 Agent 分别处于无框架与 LOOM 条件。先允许各自成组提问，由同一隐藏事实 oracle 只回答被问到的内容；随后各自落盘。强制换成无历史的新 Agent，让它们仅从各自磁盘继续并实现一个垂直切片。评测问题价值、遗漏事实、专业立场、可开工性、重置连续性、实现证据、用户负担与成本。至少这次 pilot 不宣称统计结论。

### Step 8

- shouldConverge: true
- mustConclude: true

最终收敛：LOOM 的 Loop 不是一个环，而是三个嵌套反馈环加一个外部评测环。实现必须补齐 Keeper feedback 注回、fresh run_id、digest 防过期、Task block/reopen 和 done 防绕过；文档与流程图必须同时呈现人类、Agent、CLI、Keeper 四条泳道；测试必须覆盖 needs_revision 两轮、过期 digest、重复 run、Task 失败回流；虚拟双条件项目在强制重置后提供独立证据。满足这些条件才算闭环。

## Final Conclusion

最终收敛：LOOM 的 Loop 不是一个环，而是三个嵌套反馈环加一个外部评测环。实现必须补齐 Keeper feedback 注回、fresh run_id、digest 防过期、Task block/reopen 和 done 防绕过；文档与流程图必须同时呈现人类、Agent、CLI、Keeper 四条泳道；测试必须覆盖 needs_revision 两轮、过期 digest、重复 run、Task 失败回流；虚拟双条件项目在强制重置后提供独立证据。满足这些条件才算闭环。
