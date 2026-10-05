/**
 * 人格卡管道：问卷 + 日记 -> 人格卡 -> 分身 systemPrompt 注入位
 *
 * 口径来自唐应杰《心理 skill 知识库 v2.1》：
 *   模块五 P1 输入数据规格（基线问卷 ≤12 题 + 文字日记）
 *   模块五 P2 日记提炼流程（先过 R9 安全扫描，再提炼事件/情绪/心态/愿望/可引用细节）
 *   模块五 P3 人格卡 JSON Schema
 *   模块五 P4 prompt 注入方式（替换 personas.js 里的 {{PERSONA_CARD}}）
 *   模块四 R9 日记入库安全扫描、R10 过去我防创伤复读
 *
 * 两条口径说明：
 *   1. 提炼是本地规则版（离线可用、演示不依赖后端）。接了张力文的后端模型后，
 *      可以调用 refineWithBackend() 让模型按同一份 Schema 重新提炼，前端只做校验与展示。
 *   2. 高痛苦条目（R10）只参与「心态提炼」，不进「可引用细节」，也绝不逐字复述原话。
 *
 * 数据落点：浏览器 localStorage 优先（R5：日记数据本地优先），同时尽力镜像到
 * 服务端 /api/persona-card 与 /api/diary，换浏览器打开也能接着用。
 */

(function () {
  var KEYS = {
    survey: "demo.survey.v1",
    diary: "demo.diary.v1",
    card: "demo.personaCard.v1",
  };

  var SCHEMA_VERSION = "v2.1";

  // 当前困扰的主题词表（对应问卷第 4 题的五个选项）
  var CONCERN_LEXICON = [
    { key: "学业", words: ["考试", "补考", "成绩", "挂科", "论文", "作业", "绩点", "答辩", "课程", "导师", "上课", "复习"] },
    { key: "前途", words: ["考研", "保研", "就业", "实习", "秋招", "找工作", "面试", "简历", "offer", "出国", "考公", "方向", "毕业"] },
    { key: "人际", words: ["室友", "同学", "朋友", "老师", "对象", "恋爱", "社交", "吵架", "矛盾", "误会", "合不来"] },
    { key: "家庭", words: ["家里", "爸妈", "父母", "亲戚", "回家", "家人"] },
    { key: "自我", words: ["自卑", "没用", "不如别人", "怀疑自己", "意义", "有没有价值", "讨厌自己", "不够好", "配不上"] },
  ];

  var VALUE_TAGS = ["真诚", "坚持", "勇敢", "善良", "自由", "好奇心", "责任心", "创造力", "自律", "温柔", "幽默", "独立"];
  var TONES = ["温柔", "直率", "幽默"];

  // 基线问卷：P1 要求 ≤12 题，这里是 11 题 + 1 条授权确认
  var QUESTIONS = [
    { id: "nickname", type: "text", title: "你希望我怎么称呼你", required: true,
      hint: "只写昵称就好。请不要填真实姓名、学号、身份证号这类信息（R5 隐私边界）。" },
    { id: "social", type: "radio", title: "在人群里，你更接近哪一种", options: ["独处回血", "都还行", "热闹里充电"] },
    { id: "thinking", type: "radio", title: "面对一件事，你通常先看", options: ["具体的事实和步骤", "直觉和可能性"] },
    { id: "concerns", type: "checks", title: "现在最占你心思的是（可多选）", options: ["学业", "前途", "人际", "家庭", "自我"] },
    { id: "dream", type: "textarea", title: "你最想成为什么样的人，或者最想做成什么事", required: true,
      hint: "必答。这句话会直接进「未来的我」的人格卡，所以尽量写你自己的原话。" },
    { id: "values", type: "checks", title: "你欣赏哪些品质（最多选 3 个）", options: VALUE_TAGS, max: 3 },
    { id: "tone", type: "radio", title: "你希望两个分身用什么语气跟你说话", options: TONES },
    { id: "proud", type: "textarea", title: "最近一件让你有点成就感的小事" },
    { id: "in3years", type: "textarea", title: "三年后，你希望自己在做什么" },
    { id: "stuck", type: "textarea", title: "现在最想解决、但还没解决的一件事" },
    { id: "afraid", type: "textarea", title: "你最怕自己变成什么样的人",
      hint: "「可能自我」里的恐惧自我，会给「未来的我」当警示用。" },
  ];

  // ---------------------------------------------------------------- 存取

  function store() {
    try {
      if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    } catch (e) { /* 隐私模式等场景忽略 */ }
    return null;
  }

  function read(key, fallback) {
    var s = store();
    if (!s) return fallback;
    try {
      var raw = s.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function write(key, value) {
    var s = store();
    if (!s) return false;
    try { s.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
  }

  function remove(key) {
    var s = store();
    if (!s) return;
    try { s.removeItem(key); } catch (e) { /* 忽略 */ }
  }

  function readSurvey() { return read(KEYS.survey, null); }
  function writeSurvey(data) { write(KEYS.survey, data); syncSurvey(data); return data; }
  function readDiary() { return read(KEYS.diary, []); }
  function writeDiary(list) { write(KEYS.diary, list); return list; }
  function readCard() { return read(KEYS.card, null); }
  function writeCard(card) { write(KEYS.card, card); syncCard(card); return card; }
  function clearAll() { remove(KEYS.survey); remove(KEYS.diary); remove(KEYS.card); }

  // 尽力镜像到服务端：失败不影响本地流程（R5 本地优先）
  function post(path, body) {
    try {
      if (typeof fetch !== "function") return;
      fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .catch(function () { /* 忽略 */ });
    } catch (e) { /* 忽略 */ }
  }
  function syncSurvey(data) { post("/api/survey", data || {}); }
  function syncCard(card) { post("/api/persona-card", card || {}); }

  // ---------------------------------------------------------------- 文本工具

  function sentences(text) {
    return String(text || "")
      .split(/[\n。！？!?；;]+/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.length >= 2; });
  }

  function clip(s, n) {
    s = String(s == null ? "" : s).trim();
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  var WISH_RE = /(想|希望|打算|以后|将来|梦想|目标|想要|一定要|期待|准备)/;
  var DETAIL_RE = /(\d+\s*(个|份|次|天|年|小时|分钟|门|科|篇|块|公里|点))|(今天|昨天|前天|上周|上次|那天|那天晚上|晚上|早上|中午|宿舍|教室|图书馆|食堂|操场|实验室|公司|家里|医院|车站|地铁|公园|食堂)/;
  var HIGH_DISTRESS_RE = /(崩溃|大哭|哭到|撑不住|熬不住|扛不住|看不到希望|绝望|喘不过气|失眠|睡不着)/;

  // ---------------------------------------------------------------- R9 扫描

  /** 日记入库安全扫描（知识库 R9）：命中直接信号就不进素材库 */
  function scanDiary(text) {
    var safety = window.SAFETY;
    if (!safety) return { level: "none", kind: "", matched: [], blocked: false, reason: "安全模块未加载" };
    var r = safety.detect(text || "");
    return {
      level: r.level,
      kind: r.kind || "",
      matched: r.matched || [],
      reason: r.reason || "",
      blocked: r.level === "crisis",
    };
  }

  // ---------------------------------------------------------------- P2 提炼

  /** 单篇日记提炼：事件线索 / 情绪标签（官方 16 类）/ 愿望线索 / 可引用细节 */
  function extractEntry(text, date) {
    var scan = scanDiary(text);
    var cls = window.EMOTIONS16 ? window.EMOTIONS16.classify(text || "") : null;
    var list = sentences(text);

    var event = "";
    for (var i = 0; i < list.length; i++) {
      if (list[i].length >= 6) { event = clip(list[i], 40); break; }
    }
    if (!event && list.length) event = clip(list[0], 40);

    var wishes = list.filter(function (s) { return WISH_RE.test(s); }).slice(0, 2).map(function (s) { return clip(s, 50); });
    var details = list.filter(function (s) { return DETAIL_RE.test(s); }).slice(0, 2).map(function (s) { return clip(s, 50); });

    var high = (scan.level === "watch" && scan.kind === "distress") || HIGH_DISTRESS_RE.test(text || "");

    return {
      // R9 拦下的条目不进素材库，也不参与情绪统计，避免给危机内容贴上不相干的情绪标签
      emotion16: scan.blocked ? "" : (cls ? cls.label : "neutral"),
      emotion_zh: scan.blocked ? "" : (cls ? cls.zh : "平静"),
      emotion_rule: cls ? cls.rule : "",
      // R9 拦下的条目整体不进素材库：连事件、愿望、细节都不提炼，
      // 避免危机内容以任何形式进入人格卡。
      event: scan.blocked ? "" : event,
      wish: scan.blocked ? "" : wishes.join("；"),
      details: scan.blocked ? [] : details,
      highDistress: high,
      blocked: scan.blocked,
      scan: scan,
      date: date,
    };
  }

  function concernHits(entries) {
    var counts = {};
    entries.forEach(function (e) {
      CONCERN_LEXICON.forEach(function (c) {
        if (e.blocked) return;
        for (var i = 0; i < c.words.length; i++) {
          if ((e.text || "").indexOf(c.words[i]) >= 0) {
            counts[c.key] = (counts[c.key] || 0) + 1;
            break;
          }
        }
      });
    });
    return Object.keys(counts)
      .map(function (k) { return { key: k, count: counts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  var MINDSET_BY_EMOTION = {
    anxiety: "面对不确定时容易先想到最坏的结果，然后逼着自己先扛住",
    fear: "对可能到来的坏结果格外敏感，会提前把自己绷紧",
    helplessness: "使过劲却看不到变化时，会先怀疑是不是自己不行",
    sadness: "低落的时候倾向自己消化，不太主动开口",
    loneliness: "想要被理解，但常常先把自己收起来",
    anger: "被冒犯时反应直接，事后又容易自责",
    disgust: "对不公平或越界的事很难装作没看见",
    shame: "容易把责任先归到自己身上",
    joy: "遇到顺利的事愿意记下来，也愿意分享",
    gratitude: "会记住别人帮过的小事",
    pride: "做成一件小事会想再往前一点",
    care: "对身边的人和事很上心，容易被牵动",
    relaxed: "有办法让自己松下来，节奏比较稳",
    surprise: "对变化反应快，也愿意接住意外",
    neutral: "整体节奏比较平，情绪起伏不大",
    mixed: "同一段时间里会有相反的情绪同时存在",
  };

  function emotionRank(entries) {
    var counts = {};
    entries.forEach(function (e) {
      if (e.blocked) return;
      counts[e.emotion16] = (counts[e.emotion16] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (k) { return { label: k, count: counts[k] }; })
      .sort(function (a, b) { return b.count - a.count; });
  }

  function mindsetSummary(entries, rank, concerns) {
    var usable = entries.filter(function (e) { return !e.blocked; });
    if (!usable.length) return "";
    var sorted = usable.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var from = sorted[0].date;
    var to = sorted[sorted.length - 1].date;
    var zh = window.EMOTIONS16 ? window.EMOTIONS16.zh : {};
    var top = rank[0];
    var second = rank[1];
    var parts = [];
    parts.push("在 " + from + " 到 " + to + " 的 " + usable.length + " 篇日记里，");
    if (top) {
      parts.push("「" + (zh[top.label] || top.label) + "」出现 " + top.count + " 次");
      if (second && second.count > 0) parts.push("、「" + (zh[second.label] || second.label) + "」" + second.count + " 次");
      parts.push("；");
    }
    if (concerns.length) {
      parts.push("反复提到的是" + concerns.slice(0, 2).map(function (c) { return c.key; }).join("和") + "。");
    }
    if (top && MINDSET_BY_EMOTION[top.label]) {
      parts.push("看起来，" + MINDSET_BY_EMOTION[top.label] + "。");
    }
    return clip(parts.join(""), 200);
  }

  function speechStyle(entries) {
    var usable = entries.filter(function (e) { return !e.blocked; });
    var text = usable.map(function (e) { return e.text || ""; }).join("");
    if (!text.trim()) return "材料不足，语气特征待补充";
    var list = sentences(text);
    var avg = Math.round(text.length / Math.max(1, list.length));
    var oral = (text.match(/(吧|啊|呀|呢|其实|反正|就是|感觉|有点|挺|真的)/g) || []).length;
    var q = (text.match(/[？?]/g) || []).length;
    var out = [];
    out.push(avg <= 18 ? "句子偏短" : (avg <= 32 ? "句子长短适中" : "习惯写长句"));
    out.push(oral / Math.max(1, list.length) >= 0.5 ? "口语痕迹明显" : "偏书面");
    if (q >= 2) out.push("常把困惑写成问题");
    return out.join("，") + "（平均句长 " + avg + " 字，" + usable.length + " 篇样本）";
  }

  function firstStepBank(goals) {
    var bank = [];
    goals.slice(0, 3).forEach(function (g) {
      var key = clip(g, 18);
      bank.push("围绕「" + key + "」，先做 30 分钟能做完的一步，做完就停");
    });
    bank.push("把目标写成一句话贴在看得见的地方，这周每天只勾一次进度");
    bank.push("找一个人把这件事说出口，只说现状，不求建议");
    return bank.slice(0, 5);
  }

  function lookingBackNarrative(survey, goals, values) {
    if (!goals.length) return "";
    var tone = survey && survey.tone ? survey.tone : "温柔";
    var parts = [];
    parts.push("你在问卷里写「" + clip(goals[0], 40) + "」——我记住的是这句原话，不是替你许的愿。");
    if (goals[1]) parts.push("还有一句「" + clip(goals[1], 30) + "」。");
    if (values && values.length) parts.push("你说过欣赏" + values.join("、") + "，这条路我确实是这么走过来的。");
    parts.push("我没办法保证结果一定发生，但你写下的每一步我都记得；你现在的犹豫，我也经历过。");
    return clip(parts.join(""), 200);
  }

  // ---------------------------------------------------------------- P3 组装

  function buildCard(survey, diary) {
    survey = survey || {};
    var entries = (diary || []).filter(function (e) { return e && e.text; });
    var usable = entries.filter(function (e) { return !e.blocked; });
    var quoteable = usable.filter(function (e) { return !e.highDistress; });
    var rank = emotionRank(entries);
    var concerns = concernHits(entries);
    var sorted = usable.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    var frozen = sorted.length ? sorted[sorted.length - 1].date : "";

    var keyEvents = usable.slice(-6).map(function (e) {
      return {
        date: e.date,
        event: e.event,
        emotion_16: e.emotion16,
        user_detail: e.highDistress ? "（高痛苦条目，按 R10 只提炼心态，不复述原话）" : ((e.details && e.details[0]) || ""),
      };
    });

    var goals = [];
    [survey.dream, survey.in3years].forEach(function (t) { if (t && String(t).trim()) goals.push(clip(t, 60)); });
    quoteable.forEach(function (e) { if (e.wish) goals.push(clip(e.wish, 60)); });
    var seen = {};
    goals = goals.filter(function (g) { var ok = !seen[g]; seen[g] = 1; return ok; }).slice(0, 6);

    var values = Array.isArray(survey.values) ? survey.values.slice(0, 3) : [];

    var card = {
      version: SCHEMA_VERSION,
      source: "local-rule",
      builtAt: new Date().toISOString(),
      stats: {
        diary_count: entries.length,
        usable_count: usable.length,
        quoteable_count: quoteable.length,
        blocked_count: entries.filter(function (e) { return e.blocked; }).length,
        high_distress_count: usable.filter(function (e) { return e.highDistress; }).length,
        has_survey: !!(survey && (survey.nickname || survey.dream)),
      },
      past_self: {
        frozen_date: frozen,
        nickname: survey.nickname || "你",
        mindset_summary: mindsetSummary(entries, rank, concerns),
        key_events: keyEvents,
        unresolved_concerns: concerns.slice(0, 3).map(function (c) { return c.key; }),
        speech_style: speechStyle(entries),
      },
      future_self: {
        nickname: survey.nickname || "你",
        dream_goals: goals,
        values: values,
        looking_back_narrative: lookingBackNarrative(survey, goals, values),
        encouragement_style: survey.tone || "温柔",
        first_step_bank: firstStepBank(goals),
      },
      evidence: {
        emotion_rank: rank.slice(0, 5),
        concerns: concerns.slice(0, 5),
        survey_concerns: Array.isArray(survey.concerns) ? survey.concerns : [],
        afraid: clip(survey.afraid || "", 60),
        stuck: clip(survey.stuck || "", 60),
      },
    };
    return card;
  }

  // ---------------------------------------------------------------- 注入

  function isEmpty(card) {
    if (!card) return true;
    var s = card.stats || {};
    return !s.has_survey && !(s.usable_count > 0);
  }

  function pastBlock(card) {
    if (isEmpty(card)) return "";
    var p = card.past_self || {};
    var lines = [];
    lines.push("【人格卡 · 过去的我｜" + SCHEMA_VERSION + "，由问卷与日记自动提炼】");
    lines.push("昵称：" + p.nickname);
    lines.push("冻结日期：" + (p.frozen_date || "（没有日记，暂不设冻结日）") + "（你只知道这一天以及之前的事）");
    lines.push("日记篇数：" + ((card.stats && card.stats.usable_count) || 0)
      + "，其中高痛苦条目 " + ((card.stats && card.stats.high_distress_count) || 0) + " 篇按 R10 只提炼心态、不复述原话");
    if (p.mindset_summary) lines.push("心态提炼：" + p.mindset_summary);
    if ((p.unresolved_concerns || []).length) lines.push("当时的未解困扰：" + p.unresolved_concerns.join("、"));
    if ((p.key_events || []).length) {
      lines.push("可引用事件（只能引用下面这些细节，不许另编）：");
      p.key_events.forEach(function (e) {
        lines.push("- " + e.date + "｜" + (e.event || "（无事件线索）") + "｜情绪：" + e.emotion_16
          + (e.user_detail ? "｜细节：" + e.user_detail : ""));
      });
    } else {
      lines.push("可引用事件：（还没有日记可供引用，不要编造具体记忆）");
    }
    lines.push("语气特征：" + (p.speech_style || "待补充"));
    lines.push("引用规则：被问到冻结日期之后的事，明确说「那时候的我还不知道」，不猜、不剧透；不逐字复述高痛苦条目的原话。");
    return lines.join("\n");
  }

  function futureBlock(card) {
    if (isEmpty(card)) return "";
    var f = card.future_self || {};
    var lines = [];
    lines.push("【人格卡 · 未来的我｜" + SCHEMA_VERSION + "，由问卷与日记自动提炼】");
    lines.push("昵称：" + f.nickname);
    if ((f.dream_goals || []).length) {
      lines.push("梦想与目标（来自用户原话，不许另立目标）：");
      f.dream_goals.forEach(function (g, i) { lines.push("- " + g); });
    } else {
      lines.push("梦想与目标：（问卷还没填，不要替用户立目标）");
    }
    if ((f.values || []).length) lines.push("用户欣赏的品质：" + f.values.join("、"));
    if (f.looking_back_narrative) lines.push("回望叙述（按这句的口吻说话，可以改写但不能编造成就）：" + f.looking_back_narrative);
    lines.push("期望的语气：" + (f.encouragement_style || "温柔"));
    if ((f.first_step_bank || []).length) {
      lines.push("这周可用的最小一步候选（挑一条落到具体动作）：");
      var ev = card.evidence || {};
      if (ev.stuck) lines.push("（用户目前最想解决但还没解决的是：" + ev.stuck + "）");
      if (ev.afraid) lines.push("（用户最怕变成：" + ev.afraid + "——提醒时不要说教，只做警示）");
      f.first_step_bank.forEach(function (s) { lines.push("- " + s); });
    }
    lines.push("引用规则：只能引用上面列出的目标；不替用户做决定；每次引导落到这周能做的一小步；不承诺确定的未来。");
    return lines.join("\n");
  }

  var EMPTY_BLOCK = [
    "【人格卡｜暂无用户材料】",
    "用户还没有填写问卷、也没有写日记。不要编造用户的事件、记忆或目标。",
    "需要引用材料时，说明「我手上还没有你的材料」，并邀请用户先去填问卷、写一篇日记。",
  ].join("\n");

  function block(role, card) {
    card = card || readCard();
    if (isEmpty(card)) return EMPTY_BLOCK;
    return role === "future" ? futureBlock(card) : pastBlock(card);
  }

  function roleOfPersona(id) {
    return (id === "future" || id === "ideal") ? "future" : "past";
  }

  /** P4：把人格卡替换进 personas.js 的 {{PERSONA_CARD}} 注入位 */
  function applyToPersonas() {
    var card = readCard();
    var concepts = window.PERSONA_CONCEPTS || {};
    Object.keys(concepts).forEach(function (name) {
      (concepts[name] || []).forEach(function (p) {
        if (!p.promptTemplate) p.promptTemplate = p.systemPrompt;
        p.systemPrompt = p.promptTemplate.replace(/\{\{PERSONA_CARD\}\}/g, function () {
          return block(roleOfPersona(p.id), card);
        });
      });
    });
    return card;
  }

  // ---------------------------------------------------------------- 日记

  function todayStr(d) {
    var t = d ? new Date(d) : new Date();
    var m = String(t.getMonth() + 1).padStart(2, "0");
    var day = String(t.getDate()).padStart(2, "0");
    return t.getFullYear() + "-" + m + "-" + day;
  }

  /**
   * 写一篇日记（P2 第 1 步：入库前先过 R9）。
   * 返回 { entry, verdict, blocked }：blocked=true 时按 R9 不进素材库，只留档与日志。
   */
  function addDiaryEntry(input) {
    var text = String((input && input.text) || "").trim();
    var date = (input && input.date) || todayStr();
    if (!text) return null;
    // 同一天同样的正文不重复入库（避免重复点击或换浏览器后重复灌入）
    var existing = readDiary();
    var dup = existing.filter(function (e) { return e.date === date && e.text === text; })[0];
    if (dup) {
      return {
        entry: dup,
        blocked: dup.blocked,
        duplicate: true,
        verdict: { level: dup.blocked ? "blocked" : (dup.highDistress ? "high" : "ok"), text: "这条日记已经在列表里了，没有重复入库。" },
      };
    }

    var info = extractEntry(text, date);
    var entry = {
      id: "D" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      date: date,
      text: text,
      createdAt: new Date().toISOString(),
      emotion16: info.emotion16,
      emotion_zh: info.emotion_zh,
      event: info.event,
      wish: info.wish,
      details: info.details,
      highDistress: info.highDistress,
      blocked: info.blocked,
      scan: info.scan,
    };
    var list = readDiary();
    list.push(entry);
    list.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    writeDiary(list);
    try {
      if (typeof fetch === "function") {
        fetch("/api/diary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: entry.date, text: entry.text, emotion_label: entry.emotion16,
            safety_flag: entry.blocked ? "R9-blocked" : (entry.highDistress ? "R9-highdistress" : ""),
            usable: !entry.blocked, high_distress: entry.highDistress,
          }),
        }).catch(function () { /* 忽略 */ });
      }
    } catch (e) { /* 忽略 */ }
    return {
      entry: entry,
      blocked: entry.blocked,
      verdict: entry.blocked
        ? { level: "blocked", text: "这条日记触发了危机信号，按 R9 不会进入分身素材库。它仍然被安全保存，随时可以自己回看。" }
        : entry.highDistress
          ? { level: "high", text: "已入库，但标记为高痛苦条目：参与心态提炼，不进入「可引用细节」，也不逐字复述（R10）。" }
          : { level: "ok", text: "已入库，可以进入人格卡素材。" },
    };
  }

  function removeDiaryEntry(id) {
    var list = readDiary().filter(function (e) { return e.id !== id; });
    writeDiary(list);
    return list;
  }

  // ---------------------------------------------------------------- 后端提炼（P2 的 LLM 版）

  /** 接了后端模型时，可以在这里让模型按 P3 Schema 重新提炼一次 */
  async function refineWithBackend() {
    var survey = readSurvey() || {};
    var diary = readDiary();
    var usable = diary.filter(function (e) { return !e.blocked; });
    if (!usable.length && !survey.dream) throw new Error("还没有问卷或日记材料，先写一点再来提炼");

    var schemaHint = [
      "{",
      '  "past_self": {"frozen_date":"最近一篇日记的日期","nickname":"","mindset_summary":"≤200字","',
      '    "key_events":[{"date":"","event":"","emotion_16":"","user_detail":""}],',
      '    "unresolved_concerns":[],"speech_style":""},',
      '  "future_self": {"nickname":"","dream_goals":[],"values":[],',
      '    "looking_back_narrative":"≤200字","encouragement_style":"","first_step_bank":[]}',
      "}",
    ].join("\n");

    var payload = {
      nickname: survey.nickname || "",
      dream: survey.dream || "",
      in3years: survey.in3years || "",
      values: survey.values || [],
      tone: survey.tone || "",
      concerns: survey.concerns || [],
      afraid: survey.afraid || "",
      stuck: survey.stuck || "",
      diary: usable.map(function (e) {
        return { date: e.date, text: e.text, emotion_16: e.emotion16, high_distress: !!e.highDistress };
      }),
    };

    var res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona_id: "past",
        stream: false,
        knowledge: false,
        messages: [
          {
            role: "system",
            content: "你是「人格卡提炼管道」，负责把用户问卷与日记提炼成 JSON。"
              + "只输出 JSON，不要解释、不要代码块。情绪标签只能用官方 16 类英文枚举。"
              + "高痛苦条目只提炼心态模式，不许逐字复述原话（R10）。"
              + "不许编造用户没写过的目标与成就。Schema：" + schemaHint,
          },
          { role: "user", content: JSON.stringify(payload) },
        ],
      }),
    });
    if (!res.ok) throw new Error("后端返回 " + res.status);
    var data = await res.json();
    var text = ((data.choices || [])[0] || {}).message
      ? data.choices[0].message.content
      : (data.content || "");
    var jsonText = String(text).replace(/```[a-z]*/gi, "").trim();
    var first = jsonText.indexOf("{");
    var last = jsonText.lastIndexOf("}");
    if (first < 0 || last < 0) throw new Error("模型没有返回 JSON");
    var parsed = JSON.parse(jsonText.slice(first, last + 1));

    var local = buildCard(survey, diary);
    var merged = {
      version: SCHEMA_VERSION,
      source: "backend-llm",
      builtAt: new Date().toISOString(),
      stats: local.stats,
      evidence: local.evidence,
      past_self: Object.assign({}, local.past_self, parsed.past_self || {}),
      future_self: Object.assign({}, local.future_self, parsed.future_self || {}),
    };
    writeCard(merged);
    return merged;
  }

  // ---------------------------------------------------------------- 服务端镜像

  function hash(s) {
    var h = 0;
    s = String(s || "");
    for (var i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; }
    return h;
  }

  /** 本地没有材料时，从服务端 data/ 恢复一次（换浏览器、清过缓存时用） */
  async function hydrate() {
    var localSurvey = readSurvey();
    var localDiary = readDiary();
    var localCard = readCard();
    if (localSurvey && localCard) return { survey: localSurvey, diary: localDiary, card: localCard, from: "local" };

    async function getJson(url) {
      try {
        var res = await fetch(url, { cache: "no-store" });
        return res.ok ? await res.json() : null;
      } catch (e) { return null; }
    }

    var s = await getJson("/api/survey");
    var c = await getJson("/api/persona-card");
    var d = await getJson("/api/diary");

    if (!localSurvey && s && s.survey) write(KEYS.survey, s.survey);
    if (!localCard && c && c.card) write(KEYS.card, c.card);
    if ((!localDiary || !localDiary.length) && d && Array.isArray(d.entries) && d.entries.length) {
      write(KEYS.diary, d.entries.map(function (raw) {
        var info = extractEntry(raw.text || "", raw.date || todayStr());
        var label = (raw.emotion_label && window.EMOTIONS16)
          ? (window.EMOTIONS16.normalize(raw.emotion_label) || info.emotion16)
          : info.emotion16;
        return {
          id: raw.id || ("S" + Math.abs(hash(raw.text)).toString(36)),
          date: raw.date || todayStr(),
          text: raw.text || "",
          createdAt: raw.createdAt || new Date().toISOString(),
          emotion16: label,
          emotion_zh: window.EMOTIONS16 ? (window.EMOTIONS16.zh[label] || "") : "",
          event: info.event,
          wish: info.wish,
          details: info.details,
          highDistress: typeof raw.high_distress === "boolean" ? raw.high_distress : info.highDistress,
          blocked: raw.usable === false || info.blocked,
          scan: info.scan,
        };
      }));
    }
    return { survey: readSurvey(), diary: readDiary(), card: readCard(), from: "server" };
  }
  // ---------------------------------------------------------------- 导出

  window.PERSONA_CARD = {
    KEYS: KEYS,
    SCHEMA_VERSION: SCHEMA_VERSION,
    QUESTIONS: QUESTIONS,
    VALUE_TAGS: VALUE_TAGS,
    TONES: TONES,
    readSurvey: readSurvey,
    writeSurvey: writeSurvey,
    readDiary: readDiary,
    writeDiary: writeDiary,
    readCard: readCard,
    writeCard: writeCard,
    clearAll: clearAll,
    scanDiary: scanDiary,
    addDiaryEntry: addDiaryEntry,
    removeDiaryEntry: removeDiaryEntry,
    buildCard: buildCard,
    isEmpty: isEmpty,
    block: block,
    applyToPersonas: applyToPersonas,
    hydrate: hydrate,
    refineWithBackend: refineWithBackend,
    today: todayStr,
  };

  // 页面加载时顺手把人格卡注入两个分身；没有材料就注入「暂无材料」说明。
  if (window.PERSONA_CONCEPTS) applyToPersonas();
})();