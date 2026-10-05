/**
 * 双自我对话 Demo 本地服务（零依赖）
 *
 * 三个作用：
 *   1. 把 web/ 目录当作静态站点提供出去；
 *   2. 提供 /api/config，把配置下发给前端（apiKey 不下发到浏览器）；
 *   3. 提供 /api/chat，把前端请求转发给后端大模型服务，规避浏览器跨域限制。
 *
 * 运行：node server.mjs
 * 打开：http://127.0.0.1:8090
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(HERE, "config.json");
const WEB_ROOT = path.join(HERE, "web");
const LOG_DIR = path.join(HERE, "logs");
const KIT_PATH = path.join(HERE, "knowledge", "prompt-kit.json");
const DATA_DIR = path.join(HERE, "data");   // 问卷 / 日记 / 人格卡：本地落盘目录

// 知识库卡片包（由 knowledge/build-kit.mjs 从《心理 skill 知识库 v2.1》生成）
let KIT = null;
try {
  KIT = JSON.parse(fs.readFileSync(KIT_PATH, "utf8").replace(/^\uFEFF/, ""));
} catch {
  KIT = null;
}

/** 按用户最新一条消息检索命中的知识卡片（知识库模块五 P4：命中 1-2 条，不整库塞入） */
function retrieveCards(query, limit) {
  if (!KIT || !query) return [];
  const pool = []
    .concat((KIT.cards || []).map((c) => ({ id: c.id, title: c.title, points: c.points, samples: c.samples, keywords: c.keywords || [] })))
    .concat((KIT.techniques || []).map((c) => ({ id: c.id, title: c.name, points: c.note, samples: "", keywords: c.keywords || [] })));
  const hits = [];
  for (const card of pool) {
    let score = 0;
    for (const kw of card.keywords) {
      if (kw && query.includes(kw)) score += Math.min(kw.length, 6);
    }
    if (score > 0) hits.push({ card, score });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit || 2).map((h) => h.card);
}

/** 拼给大模型的知识库块：情绪口径 + 辨析要点 + 风格基准 + 命中卡片 */
function knowledgeBlock(messages) {
  if (!KIT) return "";
  const lastUser = messages.slice().reverse().find((m) => m && m.role === "user");
  const query = (lastUser && lastUser.content) || "";
  const picked = retrieveCards(query, 2);
  const strip = (s) => String(s || "").replace(/\*\*/g, "");
  const lines = [];
  lines.push("【知识库检索增强｜心理 skill 知识库 v2.1，自动注入】");
  lines.push("总则：不输出正确答案；分身只呈现用户自己的材料（问卷、日记），梳理权交给用户；用户永远是主角。");
  lines.push("情绪标签只能取官方 16 类英文枚举：" + (KIT.emotions16 || []).map((e) => e.label).join(" / "));
  if ((KIT.disambiguation || []).length) {
    lines.push("辨析要点：" + (KIT.disambiguation || []).slice(0, 4).map(strip).join(" "));
  }
  if (KIT.style && KIT.style.length) lines.push("风格基准：" + strip(KIT.style.length));
  if (picked.length) {
    lines.push("本轮按用户消息命中的卡片，请按这些要点回应，不要整段复述：");
    for (const c of picked) {
      lines.push("- " + c.id + " " + c.title + "｜要点：" + strip(c.points).slice(0, 140)
        + (c.samples ? "｜示例：" + strip(c.samples).slice(0, 120) : ""));
    }
  } else {
    lines.push("本轮没有命中特定卡片，按总则与分身准则自然回应。");
  }
  return lines.join("\n");
}

/** 把知识块拼到 system 消息后面；前端不变，注入发生在服务端 */
function augmentMessages(payload) {
  const msgs = Array.isArray(payload.messages) ? payload.messages.slice() : [];
  if (!KIT || (payload.knowledge === false)) return msgs;
  const block = knowledgeBlock(msgs);
  if (!block) return msgs;
  const idx = msgs.findIndex((m) => m && m.role === "system");
  if (idx >= 0) msgs[idx] = Object.assign({}, msgs[idx], { content: String(msgs[idx].content || "") + "\n\n" + block });
  else msgs.unshift({ role: "system", content: block });
  return msgs;
}

/** 每轮结构化日志：reply_text / emotion_label / persona / safety_flag / latency_ms */
async function handleLog(req, res) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  let entry;
  try {
    entry = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "请求体不是合法 JSON" });
  }
  const day = new Date().toISOString().slice(0, 10);
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, "turns-" + day + ".jsonl"), JSON.stringify(entry) + "\n", "utf8");
  } catch (err) {
    return sendJson(res, 500, { error: "写入日志失败", detail: String(err && err.message ? err.message : err) });
  }
  return sendJson(res, 200, { ok: true, file: "logs/turns-" + day + ".jsonl" });
}

function readLogs(dateStr) {
  const day = /^\d{4}-\d{2}-\d{2}$/.test(dateStr || "") ? dateStr : new Date().toISOString().slice(0, 10);
  const file = path.join(LOG_DIR, "turns-" + day + ".jsonl");
  if (!fs.existsSync(file)) return { file: "logs/turns-" + day + ".jsonl", count: 0, entries: [] };
  const entries = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => {
    try { return JSON.parse(l); } catch { return { raw: l }; }
  });
  return { file: "logs/turns-" + day + ".jsonl", count: entries.length, entries };
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_PATH, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw);
}

function sendJson(res, code, payload) {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": body.length,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function publicConfig(cfg) {
  return {
    mode: cfg.mode || "auto",
    speech: cfg.speech || {},
    knowledge: {
      enabled: !!KIT && !(cfg.knowledge && cfg.knowledge.enabled === false),
      cards: KIT ? (KIT.cards || []).length : 0,
      techniques: KIT ? (KIT.techniques || []).length : 0,
      emotions16: KIT ? (KIT.emotions16 || []).length : 0,
      builtAt: KIT && KIT.meta ? KIT.meta.builtAt : "",
    },
    backend: {
      protocol: cfg.backend.protocol,
      model: cfg.backend.model,
      stream: cfg.backend.stream,
      baseUrlHint: cfg.backend.baseUrl,
    },
  };
}

// ------------------------------------------------ 问卷 / 日记 / 人格卡（本地落盘）
// 演示阶段存到 demo/data/：浏览器 localStorage 是主存储（R5 本地优先），这里是镜像，
// 换浏览器打开也能接着用。比赛提交的镜像里不含这些文件。

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return null;
  }
}

function writeJsonFile(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function readJsonFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
  } catch {
    return fallback;
  }
}

async function handlePersonaCard(req, res) {
  const file = path.join(DATA_DIR, "persona-card.json");
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body) return sendJson(res, 400, { error: "请求体不是合法 JSON" });
    try {
      writeJsonFile(file, body);
    } catch (err) {
      return sendJson(res, 500, { error: "写人格卡失败", detail: String(err && err.message ? err.message : err) });
    }
    return sendJson(res, 200, { ok: true, file: "data/persona-card.json" });
  }
  return sendJson(res, 200, { card: readJsonFile(file, null) });
}

async function handleSurvey(req, res) {
  const file = path.join(DATA_DIR, "survey.json");
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body) return sendJson(res, 400, { error: "请求体不是合法 JSON" });
    try {
      writeJsonFile(file, body);
    } catch (err) {
      return sendJson(res, 500, { error: "写问卷失败", detail: String(err && err.message ? err.message : err) });
    }
    return sendJson(res, 200, { ok: true, file: "data/survey.json" });
  }
  return sendJson(res, 200, { survey: readJsonFile(file, null) });
}

async function handleDiary(req, res) {
  const file = path.join(DATA_DIR, "diary.jsonl");
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    if (!body || !String(body.text || "").trim()) return sendJson(res, 400, { error: "日记正文不能为空" });
    const entry = Object.assign({ createdAt: new Date().toISOString() }, body);
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
    } catch (err) {
      return sendJson(res, 500, { error: "写日记失败", detail: String(err && err.message ? err.message : err) });
    }
    return sendJson(res, 200, { ok: true, file: "data/diary.jsonl" });
  }
  let entries = [];
  try {
    entries = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch {
    entries = [];
  }
  return sendJson(res, 200, { count: entries.length, entries });
}
async function backendReachable(cfg) {
  const { baseUrl, healthPath, apiKey, timeoutMs } = cfg.backend;
  if (!baseUrl) return false;
  try {
    const res = await fetch(baseUrl.replace(/\/$/, "") + (healthPath || "/"), {
      method: "GET",
      headers: apiKey ? { Authorization: "Bearer " + apiKey } : {},
      signal: AbortSignal.timeout(Math.min(timeoutMs || 5000, 5000)),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function handleChat(req, res, cfg) {
  let raw = "";
  for await (const chunk of req) raw += chunk;

  let payload;
  try {
    payload = JSON.parse(raw || "{}");
  } catch {
    return sendJson(res, 400, { error: "请求体不是合法 JSON" });
  }

  const { baseUrl, chatPath, apiKey, model, timeoutMs, extraBody } = cfg.backend;
  const url = baseUrl.replace(/\/$/, "") + (chatPath || "/v1/chat/completions");
  // 知识库检索增强：拼进 system 消息后再转发（前端无需改动）
  const augmented = augmentMessages(payload);
  const body = Object.assign({}, extraBody || {}, payload, {
    messages: augmented.length ? augmented : payload.messages,
    model: payload.model || model,
  });

  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = "Bearer " + apiKey;

  let upstream;
  try {
    upstream = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs || 60000),
    });
  } catch (err) {
    return sendJson(res, 502, {
      error: "无法连接后端大模型服务",
      detail: String(err && err.message ? err.message : err),
      triedUrl: url,
    });
  }

  res.writeHead(upstream.status, {
    "Content-Type": upstream.headers.get("content-type") || "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  if (!upstream.body) {
    res.end();
    return;
  }

  const reader = upstream.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } catch {
    // 客户端或上游中断，直接结束
  } finally {
    res.end();
  }
}

// 形象素材（assets/）单独挂一个只读目录，答辩时可以直接开总览页展示，
// 也方便把 SVG 拖进 PPT。web/ 仍是默认站点根目录。
const ASSETS_ROOT = path.join(HERE, "assets");

function serveStatic(req, res, pathname) {
  const isAssets = pathname === "/assets" || pathname.startsWith("/assets/");
  const root = isAssets ? ASSETS_ROOT : WEB_ROOT;
  const raw = isAssets ? pathname.replace(/^\/assets/, "") : pathname;
  const rel = raw === "/" || raw === "" ? "/index.html" : raw;
  const safe = path.normalize(rel).replace(/^([/\\])+/, "");
  const target = path.join(root, safe);

  if (!target.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }

  fs.readFile(target, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 找不到文件：" + rel);
      return;
    }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(target).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const cfg = loadConfig();
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === "/api/config") return sendJson(res, 200, publicConfig(cfg));

  if (pathname === "/api/health") {
    const ok = await backendReachable(cfg);
    return sendJson(res, 200, {
      backend: ok ? "online" : "offline",
      baseUrl: cfg.backend.baseUrl,
      model: cfg.backend.model,
    });
  }

  if (pathname === "/api/log") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "请使用 POST" });
    return handleLog(req, res);
  }

  if (pathname === "/api/logs") {
    return sendJson(res, 200, readLogs(url.searchParams.get("date")));
  }

  if (pathname === "/api/persona-card") return handlePersonaCard(req, res);

  if (pathname === "/api/survey") return handleSurvey(req, res);

  if (pathname === "/api/diary") return handleDiary(req, res);

  if (pathname === "/api/chat") {
    if (req.method !== "POST") return sendJson(res, 405, { error: "请使用 POST" });
    return handleChat(req, res, cfg);
  }

  return serveStatic(req, res, pathname);
});

const START = loadConfig();
// 端口/监听地址三级回退：云平台（Render/Railway/Fly 等）会注入 PORT 并要求监听 0.0.0.0；
// 本地可用 DEMO_PORT / DEMO_HOST 覆盖（守护脚本靠它开放局域网访问）；
// 两者都没给时用 config.json 的 port，且只监听 127.0.0.1（最安全的默认）。
const PORT = Number(process.env.DEMO_PORT || process.env.PORT || START.port || 8090);
const HOST = process.env.DEMO_HOST || (process.env.PORT ? "0.0.0.0" : "127.0.0.1");

// 控制台输出一律用 ASCII：Windows 中文控制台（代码页 936）下 Node 写出的中文会变成乱码，
// 中文说明交给 启动Demo.bat 的横幅和 README，这里只保留地址等关键信息。
server.on("error", (err) => {
  if (err && err.code === "EADDRINUSE") {
    console.log("");
    console.log("  [ERROR] Port " + PORT + " is already in use.");
    console.log("  A Demo server is probably already running.");
    console.log("  Just open http://" + HOST + ":" + PORT + " in your browser.");
    console.log("  To stop the running one: close its console window or press Ctrl + C there.");
    console.log("");
  } else {
    console.log("");
    console.log("  [ERROR] " + (err && err.message ? err.message : String(err)));
    console.log("");
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  console.log("");
  console.log("  Dual-Self Chat Demo is running");
  console.log("  Open in browser : http://" + HOST + ":" + PORT);
  console.log("  Backend model   : " + START.backend.baseUrl + START.backend.chatPath);
  console.log("  Stop the server : press Ctrl + C in this window");
  console.log("");
});