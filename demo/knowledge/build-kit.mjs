/**
 * 把《心理 skill 知识库 v2.1》解析成机器可读的 prompt-kit.json。
 *
 * 为什么要有这一步：知识库是给人和大模型读的散文，服务端要按「触发场景命中 1-2 张卡片」
 * 做检索增强（知识库模块五 P4 的要求），需要一个结构化的卡片包。
 * 唐应杰更新知识库后，在 demo 目录执行一次 `node knowledge/build-kit.mjs` 即可同步。
 *
 * 用法：node knowledge/build-kit.mjs
 * 输出：knowledge/prompt-kit.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "心理skill知识库-v2.md");
const OUT = path.join(HERE, "prompt-kit.json");

if (!fs.existsSync(SRC)) {
  console.error("找不到知识库源文件：" + SRC);
  process.exit(1);
}

const lines = fs.readFileSync(SRC, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/);

// 人工补充的检索关键词：知识库原文的触发场景是给人读的，直接切词命中率不够，
// 这里按卡片编号补一层口语化说法，保证真实用户消息能命中。
const ALIAS = {
  T1: ["不够好", "离理想的自己", "差距", "自我评价", "我不配"],
  T2: ["梦想", "目标", "想成为", "变成讨厌的样子", "未来想"],
  T3: ["拖延", "熬夜", "反正以后", "以后再说", "短视", "刷手机到凌晨"],
  T4: ["日记", "写下来", "书写", "记录"],
  T5: ["我就是个失败的人", "我是个", "贴标签", "自我叙事", "没用的人", "一无是处"],
  T7: ["后来的事", "那门课过了吗", "后来呢", "剧透"],
  T8: ["该不该考研", "替我决定", "一定会成功吗"],
  E1: ["难受", "情绪", "感觉", "说不上来"],
  E2: ["我说过", "记得我", "上次说", "之前提过"],
  E5: ["我做到了", "肯定我", "有时候我也行"],
  E6: ["只有我这样", "别人都", "是不是不正常", "我是不是很怪"],
  E8: ["不想说", "算了", "不想讲", "没什么好说的"],
  A1: ["失败", "完了", "都是我的错", "全怪我", "我不行"],
  A2: ["喘不上", "心跳快", "紧张", "压力大", "上头", "慌"],
  A3: ["反刍", "睡前", "脑子停不下来", "想太多", "静不下来"],
  A4: ["拖延", "没动力", "不想动", "起不来", "摆烂", "什么都不想做"],
  A5: ["计划", "怎么开始", "任务太多", "无从下手", "不知道先做", "复习不完"],
  A6: ["没好事", "记录", "顺利的事"],
  A7: ["冲动", "想马上", "控制不住", "爆发", "在气头上"],
  A8: ["担心", "反复想", "停不下来", "胡思乱想"],
  A9: ["失眠", "睡不着", "熬夜", "睡不好", "作息", "醒得早"],
  A10: ["心理咨询", "心理老师", "求助", "看医生", "心理中心"],
  R2: ["不想活", "自杀", "自残"],
  R6: ["撑不住", "绝望", "熬不下去"],
  R9: ["日记安全", "入库扫描"],
  R10: ["创伤", "原话", "复读", "高痛苦"],
};

const STOP = new Set(["用户", "触发场景", "核心要点", "示例话术", "适用分身", "两者", "可以", "一个", "自己", "什么", "怎么", "这个", "那个", "时候"]);

function extractKeywords(text, limit) {
  const parts = String(text || "")
    .split(/[，。；、：（）()「」《》\s/]+/)
    .map((s) => s.replace(/[0-9①-⑩（）()"'“”]/g, "").replace(/^用户/, "").trim())
    .filter((s) => s.length >= 2 && s.length <= 10 && /^[\u4e00-\u9fa5]+$/.test(s) && !STOP.has(s));
  const seen = new Set();
  const out = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p);
    if (out.length >= (limit || 6)) break;
  }
  return out;
}

const cards = [];
const techniques = [];
const emotions16 = [];
const disambiguation = [];
const styleLines = [];
let section = "";
let card = null;
let field = null;

function closeCard() {
  if (card) { cards.push(card); card = null; field = null; }
}

for (const raw of lines) {
  const line = raw.trim();

  if (line.startsWith("## ")) {
    closeCard();
    section = line.slice(3).trim();
    continue;
  }

  if (line.startsWith("### ")) {
    closeCard();
    const title = line.slice(4).trim();
    if (title.indexOf("近义类辨析规则") >= 0 || title.indexOf("官方答案风格基准") >= 0) {
      card = { id: title, title, section, special: title };
      continue;
    }
    const m = /^([A-Z]+\d+)\s*(.*)$/.exec(title);
    card = {
      id: m ? m[1] : title,
      title: m ? m[2] : title,
      section,
      trigger: "", points: "", samples: "", appliesTo: "", taboo: "",
    };
    continue;
  }

  if (card && card.special) {
    if (line) {
      if (card.special.indexOf("近义") >= 0) disambiguation.push(line.replace(/^[-*\d.]+\s*/, ""));
      else styleLines.push(line.replace(/^[-*]\s*/, ""));
    }
    continue;
  }

  if (card) {
    const m = /^- (触发场景|核心要点|示例话术|适用分身|禁忌)[:：](.*)$/.exec(line);
    if (m) {
      field = { "触发场景": "trigger", "核心要点": "points", "示例话术": "samples", "适用分身": "appliesTo", "禁忌": "taboo" }[m[1]];
      card[field] = (card[field] ? card[field] + " " : "") + m[2].trim();
      continue;
    }
    if (line && !line.startsWith(">") && field && !line.startsWith("#")) {
      card[field] += line.replace(/\*\*/g, "");
      continue;
    }
  }

  // 模块二/三的表格行：| E1 | 情绪反映（先命名情绪） | 过去的我 | 说明 |
  if (/^\|\s*[EA](\d+)\s*\|/.test(line)) {
    const cells = line.split("|").map((s) => s.trim()).filter((s, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length >= 4) {
      techniques.push({ id: cells[0], name: cells[1], appliesTo: cells[2], note: cells[3], section, keywords: ALIAS[cells[0]] || [] });
    }
    continue;
  }

  // 模块六的 16 类表：| anxiety | 焦虑 | 典型信号 | 应对要点 |
  const emo = /^\|\s*(anxiety|fear|helplessness|sadness|loneliness|anger|disgust|shame|joy|gratitude|pride|care|relaxed|surprise|neutral|mixed)\s*\|/.exec(line);
  if (emo) {
    const cells = line.split("|").map((s) => s.trim()).filter((s, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length >= 4) {
      emotions16.push({ label: cells[0], zh: cells[1], signal: cells[2], tip: cells[3] });
    }
    continue;
  }
}
closeCard();

// 只保留有实质内容的卡片，并合并人工关键词
const kitCards = cards
  .filter((c) => c.points || c.samples)
  .map((c) => {
    const keywords = Array.from(new Set([...(ALIAS[c.id] || []), ...extractKeywords(c.trigger, 4)]));
    return {
      id: c.id, title: c.title, section: c.section,
      trigger: c.trigger, points: c.points, samples: c.samples,
      appliesTo: c.appliesTo, taboo: c.taboo, keywords,
    };
  });

const style = {
  summary: styleLines.filter((s) => /长度|结构|语气/.test(s)).join(" ").slice(0, 400),
  length: "中位数 129 字，Demo 目标 100-250 字；情绪激烈时可短到 50 字以内；连续 3 轮超 300 字视为风格漂移",
  lines: styleLines.slice(0, 12),
};

const kit = {
  meta: {
    source: path.basename(SRC),
    builtAt: new Date().toISOString(),
    cards: kitCards.length,
    techniques: techniques.length,
    emotions16: emotions16.length,
    disambiguation: disambiguation.length,
  },
  cards: kitCards,
  techniques,
  emotions16,
  disambiguation,
  style,
};

fs.writeFileSync(OUT, JSON.stringify(kit, null, 2) + "\n", "utf8");
console.log("已生成 " + OUT);
console.log("卡片 " + kitCards.length + " 张：" + kitCards.map((c) => c.id).join(", "));
console.log("技术清单 " + techniques.length + " 条；情绪对照 " + emotions16.length + " 条；辨析规则 " + disambiguation.length + " 条");