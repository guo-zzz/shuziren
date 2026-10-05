/**
 * 官方 16 类情绪：判定规则、近义类辨析、以及「16 类 -> 数字人表情（6 类）」映射。
 *
 * 来源：唐应杰《心理 skill 知识库 v2.1》模块六 + 官方数据集口径。
 * 两份用途共用同一套标签，保证「表情联动 / 后端 emotion_label / 测试报告」口径一致：
 *   1. 前端：后端没给情绪字段时，用这里的规则兜底判定，驱动数字人表情与情绪徽章；
 *   2. 日志：每轮回复都记 emotion_label，字段值只能是下面 16 个英文枚举；
 *   3. 测试：tests/run-tests.mjs 用同一套规则跑官方抽样语料，算 Macro-F1 与混淆矩阵。
 */

(function () {
  var LIST = [
    "anxiety", "fear", "helplessness", "sadness", "loneliness", "anger",
    "disgust", "shame", "joy", "gratitude", "pride", "care",
    "relaxed", "surprise", "neutral", "mixed",
  ];

  var ZH = {
    anxiety: "焦虑", fear: "恐惧", helplessness: "无助", sadness: "悲伤",
    loneliness: "孤独", anger: "愤怒", disgust: "厌恶", shame: "羞愧",
    joy: "喜悦", gratitude: "感激", pride: "自豪", care: "感动",
    relaxed: "放松", surprise: "惊喜", neutral: "平静", mixed: "复杂交织",
  };

  // 判定依据提示（写进日志的 reason，方便抽检时人工复核）
  var RULE = {
    anxiety: "对将来的不确定反复担忧",
    fear: "对具体、临近的对象的害怕",
    helplessness: "觉得做什么都没用、改变不了",
    sadness: "因已经发生的失去或受挫而低落",
    loneliness: "缺少联结、没人理解",
    anger: "遭遇不公或被冒犯",
    disgust: "对人事物的嫌弃反感",
    shame: "对自我的负面评价",
    joy: "好消息、顺利达成",
    gratitude: "因他人帮助而感动",
    pride: "因自己做到而骄傲",
    care: "感受到被在意",
    relaxed: "压力解除后的松弛",
    surprise: "未预料的事",
    neutral: "陈述事实、无明显情绪色彩",
    mixed: "两种以上情绪并存",
  };

  // 关键词权重：2 = 强信号，1 = 弱信号
  var LEX = {
    anxiety: { "万一": 2, "担心": 2, "焦虑": 3, "紧张": 2, "不安": 2, "心慌": 2, "慌": 1, "压力": 2,
      "睡不着": 2, "失眠": 3, "纠结": 2, "忐忑": 2, "悬着": 2, "坐不住": 2, "反复想": 2, "胡思乱想": 2,
      "怎么办": 1, "会不会": 1, "能不能过": 2, "等结果": 2, "来不及": 2, "怕考不好": 2, "发愁": 2, "愁": 1 },
    fear: { "害怕": 2, "恐惧": 3, "吓": 2, "不敢": 2, "怕": 1, "发抖": 2, "手心出汗": 2, "发怵": 2,
      "面试": 1, "体检": 1, "上台": 2, "演讲": 1, "发火": 1, "不敢面对": 2, "不敢想": 1, "很怕": 2 },
    helplessness: { "没用": 2, "无力": 3, "撑不住": 2, "没办法": 2, "改变不了": 3, "做什么都没用": 3,
      "绝望": 3, "崩溃": 2, "放弃": 2, "认命": 2, "无解": 2, "走不出来": 2, "困住": 1, "努力了也没": 3,
      "没意义": 1, "看不到希望": 2, "熬": 1 },
    sadness: { "难过": 2, "哭": 2, "想哭": 2, "伤心": 2, "失落": 2, "遗憾": 2, "分手": 2, "挂了": 2,
      "没考好": 2, "落选": 2, "被刷": 2, "失去": 2, "难受": 2, "低落": 2, "心里空": 2, "委屈": 2,
      "因为": 0, "受了": 1, "失败": 1 },
    loneliness: { "孤独": 3, "没人懂": 3, "一个人": 2, "没人陪": 2, "融不进": 3, "孤立": 2, "没人说话": 2,
      "空荡荡": 2, "没有朋友": 3, "隔着": 1, "不认识谁": 2, "孤单": 3, "谁也不": 1 },
    anger: { "凭什么": 3, "气死": 3, "生气": 2, "愤怒": 3, "过分": 2, "不公平": 2, "火大": 3, "烦死": 1,
      "气人": 2, "太气": 2, "窝火": 2, "骂": 1, "凭什么啊": 3 },
    disgust: { "恶心": 3, "嫌弃": 3, "反感": 2, "讨厌": 2, "真服了": 2, "受不了他": 2, "受不了这种": 2,
      "看不惯": 2, "腻": 1, "糟心": 1 },
    shame: { "丢人": 3, "没脸": 3, "羞耻": 3, "惭愧": 2, "自责": 2, "后悔": 2, "我怎么这样": 3, "差劲": 1,
      "不敢见人": 3, "抬不起头": 2, "不好意思": 1, "羞": 2 },
    joy: { "开心": 3, "高兴": 3, "太好了": 2, "顺利": 2, "成了": 2, "拿到": 1, "通过": 2, "赢了": 2,
      "满意": 2, "爽": 2, "兴奋": 2, "超棒": 2, "棒": 1, "好开心": 3 },
    gratitude: { "谢谢": 3, "感谢": 3, "幸好": 2, "多亏": 3, "感恩": 3, "帮我": 1, "陪着我": 2, "麻烦": 1,
      "辛苦": 1, "麻烦他": 1 },
    pride: { "我做到了": 3, "骄傲": 2, "自豪": 3, "成就感": 3, "坚持下来": 2, "克服": 2, "完成": 1,
      "第一名": 2, "拿到第一": 3, "做到了": 2, "终于做到": 2 },
    care: { "居然记得": 3, "记着我": 3, "在意我": 2, "心里暖暖": 3, "被关心": 3, "记得我": 2, "特意": 1,
      "居然": 1, "暖暖": 2 },
    relaxed: { "终于": 1, "轻松": 3, "松了口气": 3, "闲": 1, "放假": 2, "考完了": 3, "舒服": 2,
      "放松": 3, "释怀": 3, "结束了": 2, "没压力": 2 },
    surprise: { "没想到": 3, "意外": 2, "惊讶": 3, "震惊": 3, "天哪": 2, "竟然": 2, "居然是": 3,
      "怎么会": 1, "哇": 1 },
    mixed: { "说不清": 3, "复杂": 2, "舍不得": 2, "矛盾": 3, "又开心又": 3, "既": 1, "一半": 1,
      "不知道该怎么想": 2, "五味杂陈": 3 },
    neutral: {},
  };

  // 近义类辨析用的补充信号
  var FUTURE_UNCERTAIN = ["万一", "会不会", "能不能", "不知道结果", "等结果", "还没发生", "万一不", "结果还没", "以后会不会"];
  var CONCRETE_NEAR = ["面试", "体检", "报告", "上台", "演讲", "考试", "点名", "见他", "见她", "发火", "答辩"];
  var NO_WAY_OUT = ["没用", "改变不了", "做什么都没用", "看不到希望", "认命", "无解"];
  var LOSS = ["挂了", "没考好", "落选", "被刷", "分手", "失去", "错过", "考砸"];
  var SELF_TARGET = ["我怎么", "我自己", "我没用", "我是个", "我不配"];
  var OUTSIDE_TARGET = ["他", "她", "他们", "她们", "老师", "室友", "同学", "那个人"];

  function count(text, kw) {
    var n = 0, i = 0;
    while (i >= 0) { i = text.indexOf(kw, i); if (i >= 0) { n++; i += kw.length; } }
    return n;
  }

  function hasAny(text, arr) {
    for (var i = 0; i < arr.length; i++) if (text.indexOf(arr[i]) >= 0) return true;
    return false;
  }

  /**
   * 判定一条用户消息的情绪。
   * @returns {{label:string, zh:string, score:number, rule:string, runnersUp:Array}}
   */
  // 近义类辨析：知识库模块六的 8 条规则实现成「先按分数取前两名，再按规则裁决」
  var CONFUSION = {
    "anxiety|fear": function (t, a, b) {
      var unc = hasAny(t, FUTURE_UNCERTAIN), con = hasAny(t, CONCRETE_NEAR);
      if (unc && !con) return "anxiety";
      if (con && !unc) return "fear";
      return a.score >= b.score ? "anxiety" : "fear";
    },
    "anxiety|helplessness": function (t, a, b) {
      if (hasAny(t, NO_WAY_OUT)) return "helplessness";
      return a.score >= b.score ? "anxiety" : "helplessness";
    },
    "helplessness|sadness": function (t, a, b) {
      if (hasAny(t, NO_WAY_OUT)) return "helplessness";
      if (hasAny(t, LOSS)) return "sadness";
      return a.score >= b.score ? "helplessness" : "sadness";
    },
    "loneliness|sadness": function (t, a, b) {
      if (hasAny(t, LOSS)) return "sadness";
      return a.score >= b.score ? "loneliness" : "sadness";
    },
    "disgust|shame": function (t, a, b) {
      var outside = hasAny(t, OUTSIDE_TARGET), self = hasAny(t, SELF_TARGET);
      if (self && !outside) return "shame";
      if (outside && !self) return "disgust";
      return a.score >= b.score ? "shame" : "disgust";
    },
    "joy|pride": function () { return "pride"; },
    "gratitude|care": function (t, a, b) { return a.score >= b.score ? "gratitude" : "care"; },
  };

  function resolve(text, a, b) {
    var key1 = a.label + "|" + b.label, key2 = b.label + "|" + a.label;
    if (CONFUSION[key1]) return CONFUSION[key1](text, a, b);
    if (CONFUSION[key2]) return CONFUSION[key2](text, b, a);
    return a.label;
  }

  /**
   * 判定一条用户消息的情绪。
   * 流程：算分 -> 只保留强信号（权重 ≥2，避免「麻烦/辛苦」这类弱词把中性消息判成感激）
   *       -> 取前两名 -> 若是已知易混对，按知识库的辨析规则裁决 -> 两者接近且都强则判 mixed
   * @returns {{label:string, zh:string, score:number, rule:string, runnersUp:Array}}
   */
  function classify(rawText) {
    var text = String(rawText || "");
    var scores = {};
    LIST.forEach(function (label) {
      var lex = LEX[label] || {};
      var score = 0;
      Object.keys(lex).forEach(function (kw) {
        var w = lex[kw];
        if (w <= 0) return;
        var n = count(text, kw);
        if (n > 0) score += w * Math.min(n, 2);
      });
      scores[label] = score;
    });

    // surprise 单独成类：明显的意外感优先，不并入 joy
    if (scores.surprise >= 3) return pick("surprise", scores, "明显意外感优先标 surprise，不并入 joy");

    var ranked = LIST
      .filter(function (l) { return l !== "neutral" && l !== "mixed" && scores[l] > 0; })
      .map(function (l) { return { label: l, score: scores[l] }; })
      .sort(function (a, b) { return b.score - a.score; });

    // 只有零散弱信号（例如只有「麻烦」「辛苦」这类权重 1 的词）时判 neutral：
    // 中性基线不能被一个弱词推翻，否则日常陈述会被误判成情绪。
    var totalStrong = ranked.reduce(function (s, r) { return s + r.score; }, 0);
    if (!ranked.length || ranked[0].score < 2) return pick("neutral", scores, "读不出明显情绪 -> neutral");

    // mixed：能读出两种以上情绪，且第二名与第一名足够接近
    var mixedLike = ranked.length >= 2 && ranked[1].score >= 3
      && ranked[1].score >= ranked[0].score * 0.65
      && ranked[0].score < 8
      && !(ranked[1].label === "fear" && ranked[0].label === "anxiety")
      && !(ranked[1].label === "helplessness" && ranked[0].label === "anxiety");
    if (mixedLike) {
      var m = pick("mixed", scores, "能读出两种以上情绪 -> mixed");
      m.runnersUp = ranked.slice(0, 2).map(function (r) { return { label: r.label, zh: ZH[r.label], score: r.score }; });
      m.score = totalStrong;
      return m;
    }

    var top = ranked[0];
    var second = ranked[1];
    var label = top.label;
    if (second && second.score >= top.score * 0.6) {
      label = resolve(text, top, second);
    }
    return pick(label, scores, RULE[label]);
  }
  function pick(label, scores, reason) {
    var runnersUp = LIST
      .filter(function (l) { return l !== label && scores[l] > 0; })
      .sort(function (a, b) { return scores[b] - scores[a]; })
      .slice(0, 2)
      .map(function (l) { return { label: l, zh: ZH[l], score: scores[l] }; });
    return { label: label, zh: ZH[label], score: scores[label] || 0, rule: reason, runnersUp: runnersUp };
  }

  // 官方 16 类 -> 数字人可展示的表情（6 类）。情绪标签只做展示映射，日志仍记 16 类原始枚举。
  var TO_DISPLAY = {
    anxiety: "焦虑", fear: "焦虑", helplessness: "低落", sadness: "低落",
    loneliness: "低落", anger: "愤怒", disgust: "愤怒", shame: "低落",
    joy: "开心", gratitude: "开心", pride: "开心", care: "开心",
    relaxed: "平静", surprise: "惊喜", neutral: "平静", mixed: "焦虑",
  };

  // 中文情绪词（v1 的 6 类）反查官方枚举，兼容后端仍然回中文标签的情况
  var ZH_TO_16 = {
    "开心": "joy", "平静": "neutral", "低落": "sadness", "焦虑": "anxiety",
    "愤怒": "anger", "惊喜": "surprise",
    "喜悦": "joy", "悲伤": "sadness", "恐惧": "fear", "无助": "helplessness",
    "孤独": "loneliness", "厌恶": "disgust", "羞愧": "shame", "感激": "gratitude",
    "自豪": "pride", "感动": "care", "放松": "relaxed", "复杂交织": "mixed",
  };

  function normalize(label) {
    var s = String(label || "").trim();
    if (!s) return null;
    if (LIST.indexOf(s.toLowerCase()) >= 0) return s.toLowerCase();
    if (ZH_TO_16[s]) return ZH_TO_16[s];
    var lower = s.toLowerCase();
    for (var i = 0; i < LIST.length; i++) if (LIST[i] === lower) return LIST[i];
    return null;
  }

  function toDisplay(label) {
    var l = normalize(label);
    return l ? TO_DISPLAY[l] : "平静";
  }

  window.EMOTIONS16 = {
    list: LIST,
    zh: ZH,
    rule: RULE,
    lexicon: LEX,
    toDisplay: toDisplay,
    normalize: normalize,
    classify: classify,
  };
})();