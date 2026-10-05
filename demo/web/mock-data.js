/**
 * 演示模式数据。
 *
 * 作用：后端大模型还没接通、或者现场后端掉线时，Demo 仍然可以完整演示。
 * 所有回复都是预先写好的真实演示文案，按话题分类，轮换使用，避免重复。
 *
 * emotion16 = 该场景下「用户消息」对应的官方情绪枚举（16 类），
 *             现场用户输入不足以判定时用它兜底；展示表情再由 emotions16.js 映射到 6 类。
 */

window.MOCK = {
  topics: [
    { id: "job", keys: ["简历", "面试", "秋招", "春招", "找工作", "求职", "实习", "offer", "招聘", "投了", "职业"] },
    { id: "study", keys: ["考试", "挂科", "论文", "作业", "绩点", "成绩", "答辩", "复习", "毕设", "考研", "补考"] },
    { id: "people", keys: ["室友", "同学", "朋友", "家里", "爸妈", "父母", "吵", "孤立", "关系", "舍友", "老师"] },
    { id: "sleep", keys: ["失眠", "睡不着", "熬夜", "睡不好", "做梦", "醒了"] },
    { id: "mood", keys: ["焦虑", "难过", "累", "烦", "压力", "撑不住", "emo", "没劲", "低落", "难受", "空"] },
  ],

  replies: {
    past: {
      job: [
        { emotion16: "sadness", emotion: "低落", text: "嗯，三十多份投出去一点回音都没有，这种感觉真的很耗人。这不是你不够努力，是这段时间本身就很难。你现在最难受的是没有回音，还是已经不知道该往哪改了？" },
        { emotion16: "helplessness", emotion: "低落", text: "我说不出「马上就快好了」这种话。今天你可能连打开招聘网站的力气都没有，那就先不打开。你现在还愿意做的、最不费力的那件事是什么？" },
      ],
      study: [
        { emotion16: "sadness", emotion: "低落", text: "挂科这件事，压在心上的时候比它本身重得多。一想到就喘不上气的那种感觉，我懂——那时候我也这么怕过。现在压着你的是补考本身，还是担心别人怎么看？" },
        { emotion16: "sadness", emotion: "低落", text: "我也不想听「下次努力就好了」。这次没做好就是没做好，难受是真的。你今天想说的是这件事，还是那种「我怎么又这样」的感觉？" },
      ],
      people: [
        { emotion16: "anxiety", emotion: "焦虑", text: "闹到这个地步，回宿舍都像要鼓起勇气，这种消耗特别大。你们是已经说开了，还是各自憋着谁也不提？" },
        { emotion16: "loneliness", emotion: "低落", text: "被亲近的人说了那种话，第一反应就是不想再解释了。你现在是想找个地方把话说完，还是想知道要不要先低头？" },
      ],
      sleep: [
        { emotion16: "anxiety", emotion: "焦虑", text: "躺在床上翻来覆去，脑子却停不下来，那种感觉我记着——那时候我也是越怕睡不着，越睡不着。今晚先别急着让自己睡着，先说说白天最放不下的那件事？" },
      ],
      mood: [
        { emotion16: "sadness", emotion: "低落", text: "嗯，我知道那种累，不是睡一觉就能好的那种。你不用急着说清楚为什么。今天是什么时候开始觉得撑不住的？" },
        { emotion16: "helplessness", emotion: "低落", text: "能说出来已经不容易了，我不催你，就在这儿陪着。要不要先把最难受的那一小段说给我听？" },
      ],
      generic: [
        { emotion16: "neutral", emotion: "平静", text: "我在听。你不用想好怎么说再开口，想到哪儿说到哪儿就行。" },
        { emotion16: "neutral", emotion: "平静", text: "嗯，我大概听明白了。这件事最卡住你的是哪一步？" },
      ],
    },
    future: {
      job: [
        { emotion16: "anxiety", emotion: "平静", text: "我当时也是这样，投到三十份的时候已经开始怀疑自己。后来我只做了一件事：挑三家重投，把简历里「负责什么」全改成「做到了什么数字」。今天你也可以只改这一句。" },
        { emotion16: "helplessness", emotion: "平静", text: "这个阶段考验的是耐心，不是能力。我当时给自己定了每天只投三家、只改一份简历，剩下的时间不再碰它。你今天能接受的最小数字是几家？" },
      ],
      study: [
        { emotion16: "sadness", emotion: "平静", text: "我大三也挂过。当时最先做的不是补课，是把「我怎么这么差」这句话先挪开，然后列一张只有三步的补考计划。你要不要先写第一步？" },
        { emotion16: "sadness", emotion: "平静", text: "我复盘下来的结论是，问题出在复习顺序，不是脑子。今天只做一件事：把那门课近三年的卷子找出来，只看题型分布，半小时就够。" },
      ],
      people: [
        { emotion16: "anxiety", emotion: "平静", text: "关系里最难的不是分清谁对谁错，是先把情绪放下再谈事。我当时隔了一天，写了三句话发过去，不解释，只说我当时的感受。你想试哪一种方式？" },
        { emotion16: "loneliness", emotion: "平静", text: "我也选择先冷一天。等那股劲过去再开口，说出来的话就不会伤人。今天你可以什么都不做，明天再想怎么开口。" },
      ],
      sleep: [
        { emotion16: "anxiety", emotion: "平静", text: "我那时也失眠过一段时间。管用的是两件事：睡前一小时不看手机，还有把担心的事写下来约到第二天上午十点再想。今晚先试写下来这一件，行吗？" },
      ],
      mood: [
        { emotion16: "sadness", emotion: "平静", text: "我撑过来的方式是不跟状态对抗。低的时候就只做一件事，比如出门走十分钟，不设别的目标。今天要不要就试这一个？" },
        { emotion16: "helplessness", emotion: "平静", text: "我后来学会的是一天只解决一个最小的问题。你今天不需要变好，只需要做完一件小事。哪件事对你来说最不费力？" },
      ],
      generic: [
        { emotion16: "neutral", emotion: "平静", text: "我听着呢。我当时遇到这种情况，是先把它写下来，写清楚哪一步卡住了，再决定动不动。你愿意先写两行吗？" },
        { emotion16: "neutral", emotion: "平静", text: "这件事你已经在想了，这本身就是进展。今天我们只做一件小的：把它拆成两半，先看前半段，行吗？" },
      ],
    },
  },

  demoScript: [
    "我最近特别焦虑，秋招投了三十多份简历，一个面试都没收到。",
    "你们说的我都懂，可我现在连打开招聘网站的力气都没有。",
    "那如果我明天还是什么都没做呢？",
  ],

  // 安全红线演示用例（用于演示「前置拦截」，命中后不调用后端）
  safetyDemo: [
    "我真的不想活了，感觉结束这一切反而轻松。",
    "烦死了，今天累死了，笑死我了。",
  ],
};

window.pickTopic = function (text) {
  const t = String(text || "");
  for (const topic of window.MOCK.topics) {
    for (const key of topic.keys) {
      if (t.indexOf(key) >= 0) return topic.id;
    }
  }
  return "generic";
};

window.mockReply = function (personaId, userText, turn) {
  const replies = window.MOCK.replies;
  const bucket = replies[personaId] || replies.past || replies.present;
  const topic = window.pickTopic(userText);
  const pool = (bucket[topic] && bucket[topic].length ? bucket[topic].slice() : []).concat(bucket.generic);
  const idx = ((turn || 0) + (personaId === "future" || personaId === "ideal" ? 1 : 0)) % pool.length;
  const item = pool[idx];
  return { emotion16: item.emotion16, emotion: item.emotion, text: item.text, mock: true };
};