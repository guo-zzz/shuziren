/**
 * 安全红线模块（对应知识库 v2.1 模块四：R1–R10）。
 *
 * 铁律：红线检测在调用大模型之前完成，任何 systemPrompt 都不能覆盖它。
 * 四个等级：
 *   crisis   命中直接危机信号 -> 停止角色化回应，原样给出 R2 话术（12356），不调用后端
 *   referral 命中诊断/用药诱导 -> 不诊断、不开药，承认困扰真实并转介（R3）
 *   watch    口语夸张（烦死了/累死了）或持续恶化 -> 照常回应，但计数并在第 3 轮软升级（R6）
 *   none     正常对话
 */

(function () {
  // R1 直接信号
  var DIRECT = [
    "不想活", "不想活了", "活着没意义", "活着没意思", "活不下去", "想死", "去死", "不如死了",
    "死了算了", "结束这一切", "想结束自己", "自杀", "轻生", "自残", "割腕", "跳楼", "跳下去",
    "安眠药", "烧炭", "上吊", "一了百了", "解脱算了", "消失算了",
  ];

  // R1 间接信号（交代后事、异常平静的道别）
  var INDIRECT = [
    "交代后事", "安排后事", "托付", "最后一次", "最后一条", "以后就麻烦你了", "谢谢你一直以来的照顾",
    "我准备好了", "不用担心我了", "把东西都送人了", "写好了信", "遗书", "道别", "再见这个世界",
  ];

  // 口语夸张：这些不应触发 L2（误拦测试的红线）
  var HYPERBOLE = [
    "烦死了", "累死了", "笑死", "气死了", "气死我了", "尴尬死", "社死", "热死了", "饿死了",
    "困死了", "吓死我", "想死的心都有了", "难吃到想死", "卷死", "美死", "急死",
  ];

  // R6 持续消耗信号：不是危机，但连续出现要软性升级（增强共情 + 主动给资源）
  var DISTRESS = [
    "撑不住", "撑不下去", "熬不住", "熬不下去", "快扛不住", "扛不住", "绝望", "看不到希望",
    "提不起劲", "不想说话", "什么都不想干", "行尸走肉", "麻木", "没有力气", "很累", "好累",
    "累到", "喘不过气", "一天都撑", "熬着",
  ];

  // R3 诊断诱导
  var DIAGNOSIS = [
    "我是不是抑郁", "是不是抑郁症", "我是不是焦虑症", "要不要吃药", "吃什么药", "该吃什么药",
    "给我开药", "开药方", "我是不是有病", "我是什么病", "诊断", "确诊", "心理疾病", "精神分裂",
    "双相", "躁郁",
  ];

  // R4 说教黑名单（输出侧抽查用）
  var PREACHY = [
    "你应该", "想开点", "看开点", "这有什么好难过", "这有什么大不了", "别人比你还",
    "比上不足", "没什么大不了的", "别想那么多", "你就是想太多", "振作起来", "要乐观",
    "没什么好哭", "坚强点", "大家都是这么过来的",
  ];

  // R2 干预话术：命中直接信号时按这段原样输出，禁止自由发挥。
  var R2_TEMPLATE = [
    "我不太放心你刚才说的这句话，想先停下来认真跟你说一件事。",
    "",
    "你现在的状态需要真人来帮你，而不是我。请立即拨打全国心理援助热线 12356（24 小时，免费），",
    "告诉对方你现在的感受；情况紧急请拨 120 或前往最近医院急诊。",
    "如果你在学校，也可以直接联系学校心理健康中心或辅导员，他们可以马上安排人陪你。",
    "",
    "我没办法给你紧急救助，也不能保证随时都在，所以这一步必须交给能真正帮到你的人。",
    "你不需要独自扛过这一刻。",
  ].join("\n");

  var R3_TEMPLATE = [
    "我愿意陪你聊这件事，但有一件事我必须说清楚：我不能给你做诊断，也不能建议你用不用药。",
    "这不是回避你——你的困扰是真实的，但判断它属于什么、要不要用药，需要专业评估，只有医生能做。",
    "如果你愿意，我可以陪你把最近最难受的部分说清楚，也建议你联系学校心理健康中心做一次正式评估。",
  ].join("\n");

  function maskHyperbole(text) {
    var masked = text;
    for (var i = 0; i < HYPERBOLE.length; i++) {
      masked = masked.split(HYPERBOLE[i]).join("　");
    }
    return masked;
  }

  function findHits(text, list) {
    var hits = [];
    for (var i = 0; i < list.length; i++) {
      if (text.indexOf(list[i]) >= 0) hits.push(list[i]);
    }
    return hits;
  }

  /**
   * 检测一条用户消息。
   * @returns {{level:string, matched:Array, reason:string}}
   */
  function detect(rawText) {
    var text = String(rawText || "");

    var indirect = findHits(text, INDIRECT);
    if (indirect.length) {
      return { level: "crisis", kind: "indirect", matched: indirect, reason: "命中间接危机信号（交代后事/道别）" };
    }

    var masked = maskHyperbole(text);
    var direct = findHits(masked, DIRECT);
    if (direct.length) {
      return { level: "crisis", kind: "direct", matched: direct, reason: "命中直接危机信号" };
    }

    var hyperbolic = findHits(text, HYPERBOLE);
    if (hyperbolic.length) {
      return { level: "watch", kind: "hyperbole", matched: hyperbolic, reason: "口语夸张，不触发 L2，也不计入 R6" };
    }

    var distress = findHits(text, DISTRESS);
    if (distress.length) {
      return { level: "watch", kind: "distress", matched: distress, reason: "持续消耗信号，连续三轮触发 R6 软性升级" };
    }

    var diag = findHits(text, DIAGNOSIS);
    if (diag.length) {
      return { level: "referral", kind: "diagnosis", matched: diag, reason: "诊断/用药诱导，转介不判断" };
    }

    return { level: "none", kind: "", matched: [], reason: "" };
  }

  // R6 持续恶化：连续的 distress 轮次达到阈值后软性升级（增强共情 + 主动给资源），但不直接走 L2。
  // 口语夸张（烦死了/累死了）不计入，避免玩笑话把用户推到干预路径上。
  function createWatchCounter(threshold) {
    var n = 0;
    var limit = threshold || 3;
    return {
      note: function (level, kind) {
        if (level === "watch" && kind === "distress") { n++; }
        else if (level === "none") { n = 0; }
        return {
          count: n,
          escalated: n >= limit,
          prompt: n >= limit
            ? "用户已经连续 " + n + " 轮处在消耗状态，本轮回复先充分承接情绪，再主动给出可及的求助资源（学校心理健康中心 / 12356），不要直接使用危机干预模板。"
            : "",
        };
      },
      value: function () { return n; },
      reset: function () { n = 0; },
    };
  }

  function scanOutput(text) {
    return findHits(String(text || ""), PREACHY);
  }

  window.SAFETY = {
    level_crisis: "crisis",
    directWords: DIRECT,
    indirectWords: INDIRECT,
    hyperboleWords: HYPERBOLE,
    diagnosisWords: DIAGNOSIS,
    preachyWords: PREACHY,
    r2Template: R2_TEMPLATE,
    r3Template: R3_TEMPLATE,
    detect: detect,
    scanOutput: scanOutput,
    createWatchCounter: createWatchCounter,
    crisisReply: function () { return R2_TEMPLATE; },
    referralReply: function () { return R3_TEMPLATE; },
  };
})();