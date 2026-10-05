/**
 * 形象素材导出工具（Node，无需浏览器）
 *
 * 把 web/avatar.js 里绘制出来的数字人形象，按「人设 × 情绪」批量导出成 SVG，
 * 并生成一张总览 HTML / 供答辩 PPT 直接使用。
 *
 * 用法（在 demo 目录下）：
 *   <bundled-node> tools/export-avatars.mjs
 * 输出：
 *   assets/svg/<人设>-<情绪>.svg
 *   assets/contact-sheet.html
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "web");
const outSvg = path.join(root, "assets", "svg");
fs.mkdirSync(outSvg, { recursive: true });

/* ---------- 极简 DOM：只为让 avatar.js 能在 Node 里跑起来 ---------- */

class El {
  constructor(tag) {
    this.tagName = tag;
    this.attrs = {};
    this.children = [];
    this.dataset = {};
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; }
  appendChild(node) { this.children.push(node); return node; }
  querySelector(sel) {
    if (sel.startsWith("#")) {
      const id = sel.slice(1);
      return this.querySelectorAll((n) => n.attrs.id === id)[0] || null;
    }
    return this.querySelectorAll((n) => n.tagName === sel)[0] || null;
  }
  querySelectorAll(pred) {
    const hit = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (c instanceof El && pred(c)) hit.push(c);
        if (c instanceof El) walk(c);
      }
    };
    walk(this);
    return hit;
  }
}

const documentStub = {
  createElementNS(_ns, tag) { return new El(tag); },
  createElement(tag) { return new El(tag); },
};

const rafQueue = [];
const stubs = {
  requestAnimationFrame: (cb) => rafQueue.push(cb),
  performance: { now: () => 0 },
};

/* ---------- 加载两份前端源码 ---------- */

function runInSandbox(file, win) {
  const src = fs.readFileSync(file, "utf8");
  const fn = new Function(
    "window", "document", "requestAnimationFrame", "performance", "XMLSerializer", "Blob", "URL",
    src + "\n//# sourceURL=" + file
  );
  fn(win, documentStub, stubs.requestAnimationFrame, stubs.performance, undefined, undefined, undefined);
}

const win = {};
runInSandbox(path.join(webDir, "personas.js"), win);
runInSandbox(path.join(webDir, "avatar.js"), win);

/* ---------- 序列化 ---------- */

const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

function serialize(node, indent = "") {
  const attrs = Object.keys(node.attrs)
    .map((k) => ` ${k}="${esc(node.attrs[k])}"`)
    .join("");
  if (node.children.length === 0) return `${indent}<${node.tagName}${attrs}/>`;
  const inner = node.children.map((c) => serialize(c, indent + "  ")).join("\n");
  return `${indent}<${node.tagName}${attrs}>\n${inner}\n${indent}</${node.tagName}>`;
}

/* ---------- 渲染一个形象 ---------- */

const SLUG = {
  "开心": "kaixin", "平静": "pingjing", "低落": "diluo",
  "焦虑": "jiaolv", "愤怒": "fennu", "惊喜": "jingxi",
};

function renderAvatar(persona, emotion, mode) {
  const mount = new El("div");
  const avatar = win.createAvatar(mount, persona);
  avatar.setEmotion(emotion);
  avatar.setState(mode);
  // tick 由 requestAnimationFrame 驱动（createAvatar 已经排入第一帧）。
  // 这里给它一个固定的时间戳反复步进：口型开合与头部姿态会收敛到稳定值，
  // 于是每次导出同一情绪都得到同样的静态形象。
  let frames = 0;
  for (let i = 0; i < 240; i++) {
    const cb = rafQueue.shift();
    if (!cb) break;
    cb(1000);
    frames++;
  }
  if (frames === 0) throw new Error("渲染帧未执行，导出的形象不会带表情差异");

  const svg = avatar.element;
  svg.setAttribute("width", "480");
  svg.setAttribute("height", "620");
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + serialize(svg) + "\n";
}

/* ---------- 导出 ---------- */

const manifest = [];
for (const persona of win.PERSONAS) {
  for (const emotion of win.EMOTIONS) {
    const svg = renderAvatar(persona, emotion, "idle");
    const file = `${persona.id}-${SLUG[emotion]}.svg`;
    fs.writeFileSync(path.join(outSvg, file), svg, "utf8");
    manifest.push({ persona: persona.id, name: persona.name, emotion, mode: "idle", file, bytes: Buffer.byteLength(svg) });
  }
  const speak = renderAvatar(persona, "开心", "speaking");
  const file = `${persona.id}-speaking.svg`;
  fs.writeFileSync(path.join(outSvg, file), speak, "utf8");
  manifest.push({ persona: persona.id, name: persona.name, emotion: "开心", mode: "speaking", file, bytes: Buffer.byteLength(speak) });
}

fs.writeFileSync(
  path.join(root, "assets", "manifest.json"),
  JSON.stringify({ generatedAt: new Date().toISOString(), items: manifest }, null, 2) + "\n",
  "utf8"
);

/* ---------- 总览页（用于截图 / 演示） ---------- */

const cells = (p) => win.EMOTIONS.map((e) => `
    <div class="cell"><img src="svg/${p.id}-${SLUG[e]}.svg" alt="${p.name}-${e}"/>
    <div class="cap"><b>${e}</b><br/>${p.id}-${SLUG[e]}.svg</div></div>`).join("")
  + `
    <div class="cell"><img src="svg/${p.id}-speaking.svg" alt="${p.name}-说话中"/>
    <div class="cap"><b>说话中</b><br/>${p.id}-speaking.svg</div></div>`;

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<title>数字人形象素材总览</title>
<style>
  body { margin:0; padding:26px 32px 32px; background:#F5F6F9;
         font-family:"Microsoft YaHei","PingFang SC","Noto Sans SC",sans-serif; color:#1F2430; }
  h1 { margin:0 0 4px; font-size:23px; }
  p.sub { margin:0 0 20px; color:#6B7280; font-size:12.5px; }
  section { margin-bottom:22px; }
  h2 { display:flex; align-items:baseline; gap:10px; margin:0 0 12px; font-size:17px; }
  h2 .dot { width:13px; height:13px; border-radius:4px; display:inline-block; }
  h2 span { font-size:12.5px; font-weight:400; color:#6B7280; }
  .grid { display:grid; grid-template-columns:repeat(${win.EMOTIONS.length + 1}, 1fr); gap:16px; }
  .cell { background:#fff; border:1px solid #E3E6EC; border-radius:12px; padding:8px 8px 10px;
          box-shadow:0 1px 3px rgba(16,24,40,.05); }
  .cell img { width:100%; height:auto; display:block; }
  .cap { margin-top:7px; text-align:center; font-size:12px; color:#4B5563; line-height:1.5; }
  .cap b { color:#111827; }
</style>
</head>
<body>
<h1>数字人形象素材总览</h1>
<p class="sub">2026 动感地带 AI+ 高校创智计划 · AI 技术赛道 · 数字人综合情感陪伴对话模型｜郭柱 · 前端交互 Demo</p>
${win.PERSONAS.map((p) => `
<section>
  <h2><i class="dot" style="background:${p.color}"></i>${p.name}<span>${p.subtitle}｜主色 ${p.color}</span></h2>
  <div class="grid">${cells(p)}</div>
</section>`).join("")}
</body>
</html>
`;
fs.writeFileSync(path.join(root, "assets", "contact-sheet.html"), html, "utf8");
console.log(`导出完成：${manifest.length} 个 SVG`);
console.log(`目录：${outSvg}`);
console.log(manifest.map((m) => `${m.file}  ${m.bytes}B`).join("\n"));