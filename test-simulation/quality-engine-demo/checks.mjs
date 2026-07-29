import { readFileSync } from "node:fs";
import { mergeTasks, parseLines } from "./app.js";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const html = read("./index.html");
const css = read("./style.css");
const js = read("./app.js");
const failures = [];
const expect = (condition, message) => { if (!condition) failures.push(message); };

expect(/id="task-input"/.test(html), "缺少每行任务输入框");
expect(/id="now-list"/.test(html) && /id="next-list"/.test(html) && /id="later-list"/.test(html), "缺少现在/接下来/稍后三层容器");
expect(/<button[^>]+id="organize-button"/.test(html), "缺少整理按钮");
expect(!/<script[^>]+https?:/i.test(html) && !/<link[^>]+https?:/i.test(html), "不得引用外部脚本或样式");
expect(/parseLines/.test(js) && /!urgent/.test(js) && /@\$\{tag\}/.test(js), "缺少轻量标签解析规则");
expect(/localStorage\.setItem/.test(js) && /localStorage\.getItem/.test(js) && /catch/.test(js), "本地持久化必须有读写与失败处理");
expect(/type="module" src="app\.js"/.test(html), "应用脚本必须以模块方式加载，供状态转换逻辑独立验证");
expect(!/innerHTML/.test(js), "不得将用户输入写入 innerHTML");
expect(/textContent = task\.text/.test(js), "任务文本必须用 textContent 呈现");
expect(/ctrlKey \|\| event\.metaKey/.test(js) && /event\.key === "Enter"/.test(js), "缺少 Ctrl/⌘ + Enter 快捷键");
expect(/:focus-visible/.test(css), "缺少可见键盘焦点");
expect(/@media \(max-width: 760px\)/.test(css) && /grid-template-columns: 1fr/.test(css), "缺少窄屏单列布局");
expect(/window\.confirm/.test(js), "清空既有任务必须要求显式确认");

const initial = parseLines("回复项目邮件 !urgent @work\n给植物浇水 @home");
initial[1].complete = true;
const afterSecondOrganize = mergeTasks(initial, parseLines("整理报销单 @work\n给植物浇水 @home"));
expect(afterSecondOrganize.length === 3, "第二次整理必须合并新任务，不能覆盖原任务");
expect(afterSecondOrganize[0] === initial[0] && afterSecondOrganize[1] === initial[1], "合并时必须保留既有任务对象与状态");
expect(afterSecondOrganize[1].complete === true, "第二次整理后既有完成状态不得丢失");

if (failures.length) {
  console.error("Focus Deck checks failed:\n- " + failures.join("\n- "));
  process.exit(1);
}
console.log("Focus Deck checks passed: structure, local-only boundary, parsing, persistence safeguards, keyboard focus, and narrow-screen layout.");
