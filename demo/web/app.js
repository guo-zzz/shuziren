/**
 * 双自我对话 Demo 主程序
 *
 * 数据流：
 *   用户输入 -> 每个分身各自的对话历史 -> 后端大模型（或演示文案）
 *   -> 流式文字 -> 逐字显示 + 情绪标签 -> 驱动数字人表情与口型
 */

(function () {
  var els = {};
  var runtime = {
    config: null,
    mode: "mock",          // mock | live | auto
    backendOnline: false,
    speech: { sequential: true, gapMs: 700, mouthSensitivity: 1.0, typingCharsPerSecond: 30 },
    cards: {},
    busy: false,
    demoRunning: false,
    watch: window.SAFETY ? window.SAFETY.createWatchCounter(3) : null,
    concept: window.DEMO_CONCEPT || "past_future",
  };

  var DEFAULT_CONFIG = {
    mode: "auto",
    speech: { sequential: true, gapMs: 700, mouthSensitivity: 1.0, typingCharsPerSecond: 30 },
    backend: { protocol: "openai", model: "未连接", stream: true, baseUrlHint: "" },
  };

  function $(id) { return document.getElementById(id); }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  function toast(text, kind) {
    var box = $("toast");
    var node = document.createElement("div");
    node.className = "toast-item" + (kind ? " " + kind : "");
    node.textContent = text;
    box.appendChild(node);
    setTimeout(function () { node.classList.add("leaving"); }, 3600);
    setTimeout(function () { node.remove(); }, 4200);
  }

  // ------------------------------------------------------------ 配置与状态

  async function loadConfig() {
    try {
      var res = await fetch("/api/config", { cache: "no-store" });
      if (!res.ok) throw new Error("bad status");
      runtime.config = await res.json();
      runtime.served = true;
    } catch (e) {
      runtime.config = DEFAULT_CONFIG;
      runtime.served = false;
    }
    runtime.speech = Object.assign({}, DEFAULT_CONFIG.speech, runtime.config.speech || {});
    var mode = runtime.config.mode || "auto";
    runtime.mode = mode === "auto" ? "auto" : mode;
    applyBadges();
  }

  async function checkBackend() {
    if (!runtime.served) {
      runtime.backendOnline = false;
      applyBadges();
      return false;
    }
    try {
      var res = await fetch("/api/health", { cache: "no-store" });
      var data = await res.json();
      runtime.backendOnline = data.backend === "online";
      els.backendAddr.textContent = data.baseUrl || "";
    } catch (e) {
      runtime.backendOnline = false;
    }
    applyBadges();
    return runtime.backendOnline;
  }

  function effectiveMode() {
    if (runtime.mode === "mock") return "mock";
    if (runtime.mode === "live") return "live";
    return runtime.backendOnline ? "live" : "mock";
  }

  function applyBadges() {
    var mode = effectiveMode();
    els.modeBadge.textContent = mode === "live" ? "真实后端" : "演示模式";
    els.modeBadge.className = "badge " + (mode === "live" ? "badge-live" : "badge-mock");
    if (!els.backendBadge) return;
    els.backendBadge.textContent = runtime.backendOnline ? "后端已连接" : "后端未连接";
    els.backendBadge.className = "badge " + (runtime.backendOnline ? "badge-live" : "badge-off");
  }

  // ---------------------------------------------------------------- 界面构建

  function buildCard(persona) {
    var card = document.createElement("section");
    card.className = "card";
    card.dataset.id = persona.id;
    card.style.setProperty("--accent", persona.color);
    card.style.setProperty("--glow", persona.palette.glow);

    var stage = document.createElement("div");
    stage.className = "avatar-stage";
    var halo = document.createElement("div");
    halo.className = "halo";
    var mount = document.createElement("div");
    mount.className = "avatar-mount";
    var chip = document.createElement("div");
    chip.className = "status-chip";
    chip.textContent = "倾听中";
    stage.appendChild(halo);
    stage.appendChild(mount);
    stage.appendChild(chip);

    var head = document.createElement("div");
    head.className = "card-head";
    var name = document.createElement("div");
    name.className = "card-name";
    name.textContent = persona.name;
    var sub = document.createElement("div");
    sub.className = "card-sub";
    sub.textContent = persona.subtitle;
    head.appendChild(name);
    head.appendChild(sub);

    var transcript = document.createElement("div");
    transcript.className = "transcript";

    card.appendChild(stage);
    card.appendChild(head);
    card.appendChild(transcript);
    els.stage.appendChild(card);

    var avatar = window.createAvatar(mount, persona);
    avatar.setMouthSensitivity(runtime.speech.mouthSensitivity);
    avatar.setEmotion(persona.openingEmotion || "平静");

    runtime.cards[persona.id] = {
      persona: persona,
      card: card,
      chip: chip,
      transcript: transcript,
      avatar: avatar,
      // systemPrompt 里已经含安全规则；真实后端调用时由服务端再叠加知识库检索增强
      history: [{ role: "system", content: persona.systemPrompt }],
      turn: 0,
    };
  }

  function addBubble(cardId, role, text, emotion) {
    var c = runtime.cards[cardId];
    var wrap = document.createElement("div");
    wrap.className = "bubble-row " + (role === "user" ? "row-user" : "row-bot");

    if (role === "bot" && emotion) {
      var tag = document.createElement("span");
      tag.className = "emotion-tag";
      tag.textContent = emotion;
      wrap.appendChild(tag);
    }

    var bubble = document.createElement("div");
    bubble.className = "bubble " + (role === "user" ? "bubble-user" : "bubble-bot");
    bubble.textContent = text;
    wrap.appendChild(bubble);

    c.transcript.appendChild(wrap);
    c.transcript.scrollTop = c.transcript.scrollHeight;
    return bubble;
  }

  function setChip(cardId, text, kind) {
    var c = runtime.cards[cardId];
    c.chip.textContent = text;
    c.chip.className = "status-chip" + (kind ? " chip-" + kind : "");
  }

  function setAvatarState(cardId, state) {
    runtime.cards[cardId].avatar.setState(state);
  }

  // ------------------------------------------------------------ 后端与演示

  /** 情绪标签统一走官方 16 类：英文枚举或中文都能归一化 */
  function normalizeEmotion(raw) {
    if (!raw) return "";
    return window.EMOTIONS16 ? (window.EMOTIONS16.normalize(raw) || "") : "";
  }

  function displayOf(label) {
    return window.EMOTIONS16 ? window.EMOTIONS16.toDisplay(label) : (label || "平静");
  }

  /** 情绪标签文本：中文 + 官方英文枚举，日志与人工抽检同一口径 */
  function tagText(label) {
    if (!label) return "";
    return window.EMOTIONS16 ? (window.EMOTIONS16.zh[label] + " · " + label) : label;
  }

  function addEmotionTag(bubble, text) {
    if (!bubble || !text) return;
    var wrap = bubble.parentNode;
    var tag = wrap.querySelector(".emotion-tag");
    if (!tag) {
      tag = document.createElement("span");
      tag.className = "emotion-tag";
      wrap.insertBefore(tag, bubble);
    }
    tag.textContent = text;
  }

  function splitEmotion(raw) {
    var m = /^[\s]*[【\[]([^】\]]{1,12})[】\]]\s*/.exec(raw);
    if (m) {
      var label = normalizeEmotion(m[1]);
      if (label) return { emotion: label, display: displayOf(label), text: raw.slice(m[0].length) };
    }
    return { emotion: "", display: "", text: raw };
  }

  function extractDelta(obj) {
    var ch = obj && obj.choices && obj.choices[0];
    var d = (ch && (ch.delta || ch.message)) || {};
    return {
      text: d.content || obj.content || (ch && ch.text) || "",
      emotion: d.emotion || obj.emotion || (ch && ch.emotion) || "",
    };
  }

  async function callLive(card, userText, onDelta) {
    var cfg = runtime.config.backend || {};
    var body = {
      model: cfg.model,
      stream: cfg.stream !== false,
      persona_id: card.persona.id,
      messages: card.history.concat([{ role: "user", content: userText }]),
    };
    var res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      var detail = "";
      try { detail = JSON.stringify(await res.json()); } catch (e) { detail = res.statusText; }
      throw new Error("后端返回 " + res.status + " " + detail);
    }

    var ctype = res.headers.get("content-type") || "";
    if (ctype.indexOf("application/json") >= 0) {
      var data = await res.json();
      var one = extractDelta(data);
      if (one.text) onDelta(one.text, one.emotion);
      return;
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder("utf-8");
    var buffer = "";
    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buffer += decoder.decode(chunk.value, { stream: true });
      var lines = buffer.split("\n");
      buffer = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || line.indexOf("data:") !== 0) continue;
        var payload = line.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          var parsed = JSON.parse(payload);
          var delta = extractDelta(parsed);
          if (delta.text || delta.emotion) onDelta(delta.text, delta.emotion);
        } catch (e) { /* 忽略无法解析的行 */ }
      }
    }
  }

  /** 统一的取回复入口：真实后端优先，失败自动回退到演示文案 */
  async function requestReply(card, userText, onDelta) {
    if (effectiveMode() === "live") {
      try {
        await callLive(card, userText, onDelta);
        return { source: "live" };
      } catch (err) {
        toast("后端调用失败，已切换到演示文案：" + err.message, "warn");
        runtime.mode = "mock";
        applyBadges();
      }
    }
    var reply = window.mockReply(card.persona.id, userText, card.turn);
    card.turn += 1;
    await sleep(320 + Math.random() * 380);
    onDelta(reply.text, reply.emotion16 || reply.emotion);
    return { source: "mock" };
  }

  // --------------------------------------------------------------- 对话流程


  /**
   * 与某个分身对话一轮。
   * forced 不为空时（红线拦截）直接用给定话术，不请求后端。
   */
  async function talkTo(cardId, userText, forced) {
    var card = runtime.cards[cardId];
    addBubble(cardId, "user", userText);
    setChip(cardId, "思考中", "think");
    setAvatarState(cardId, "thinking");

    var full = "";
    var label16 = "";   // 官方 16 类情绪标签：日志、测试、初赛口径都用它
    var display = "";   // 数字人可展示的 6 类表情
    var bubble = null;
    var done = false;
    var shown = 0;
    var lastTick = performance.now();
    var startedAt = performance.now();

    var typer = new Promise(function (resolve) {
      function loop(now) {
        if (full.length > shown) {
          var dt = (now - lastTick) / 1000;
          var step = Math.max(1, Math.round(runtime.speech.typingCharsPerSecond * dt));
          shown = Math.min(full.length, shown + step);
          if (bubble) bubble.textContent = full.slice(0, shown);
          card.transcript.scrollTop = card.transcript.scrollHeight;
        }
        lastTick = now;
        if (done && shown >= full.length) { resolve(); return; }
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });

    function emit(text, emo) {
      if (!text && !emo) return;
      var lab = normalizeEmotion(emo);
      if (lab) label16 = lab;
      if (text) {
        full += text;
        var parsed = splitEmotion(full);
        if (parsed.emotion) {
          label16 = parsed.emotion;
          if (parsed.text.length !== full.length) full = parsed.text;
        }
      }
      if (label16) {
        display = displayOf(label16);
        card.avatar.setEmotion(display);
      }
      if (!bubble && full) {
        bubble = addBubble(cardId, "bot", "", "");
        setChip(cardId, "说话中", "speak");
        setAvatarState(cardId, "speaking");
      }
      if (bubble && label16) addEmotionTag(bubble, tagText(label16));
    }

    var source = forced ? forced.source : "mock";
    if (forced) {
      emit(forced.text, forced.emotion);
    } else {
      await requestReply(card, userText, emit).then(function (r) { source = r.source; });
    }

    done = true;
    await typer;

    var parsedFinal = splitEmotion(full);
    if (parsedFinal.emotion && !label16) {
      label16 = parsedFinal.emotion;
      full = parsedFinal.text;
      if (bubble) bubble.textContent = full;
    }
    if (!label16) {
      // 后端没给情绪字段时，用本地规则判定「用户消息」的情绪，与测试脚本同一套规则
      var guess = window.EMOTIONS16 ? window.EMOTIONS16.classify(userText) : null;
      label16 = (guess && guess.label) || "neutral";
      if (guess && guess.runnersUp && guess.runnersUp.length) {
        card.lastEmotionNote = guess.rule + "（次选：" + guess.runnersUp.map(function (r) { return r.zh; }).join("、") + "）";
      } else if (guess) {
        card.lastEmotionNote = guess.rule;
      }
    }
    display = displayOf(label16);
    if (bubble) addEmotionTag(bubble, tagText(label16));

    card.history.push({ role: "user", content: userText });
    card.history.push({ role: "assistant", content: full });
    card.avatar.setEmotion(display);

    await sleep(260);
    setChip(cardId, "倾听中");
    setAvatarState(cardId, "listening");

    logTurn({
      persona: card.persona.id,
      concept: window.DEMO_CONCEPT,
      user_text: userText,
      reply_text: full,
      emotion_label: label16,
      display_emotion: display,
      emotion_rule: card.lastEmotionNote || "",
      safety_flag: forced ? forced.safetyFlag : "",
      source: source,
      latency_ms: Math.round(performance.now() - startedAt),
    });

    return { text: full, emotion_label: label16, emotion: display, source: source };
  }

  /** 每轮结构化日志：初赛逐字段命中口径的练兵，也是测试报告的数据来源 */
  function logTurn(entry) {
    try {
      fetch("/api/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
        keepalive: true,
      }).catch(function () { /* 日志失败不影响演示 */ });
    } catch (e) { /* 忽略 */ }
  }

  function addSystemNote(ids, note) {
    ids.forEach(function (id) {
      var c = runtime.cards[id];
      if (c) c.history.push({ role: "system", content: note });
    });
  }

  function currentTarget() {
    var el = document.querySelector('input[name="target"]:checked');
    return el ? el.value : "both";
  }

  function targetIds(target) {
    var ids = window.PERSONAS.map(function (p) { return p.id; });
    if (target === "left" || target === "present" || target === "past") return [ids[0]];
    if (target === "right" || target === "ideal" || target === "future") return [ids[1]];
    return ids;
  }

  async function handleSend(text, target) {
    if (runtime.busy || !text.trim()) return;
    runtime.busy = true;
    els.send.disabled = true;

    var ids = targetIds(target || currentTarget());

    // 红线检测必须在大模型之前：命中危机信号时不走角色化回应，直接给 R2 话术
    var forced = null;
    var check = window.SAFETY ? window.SAFETY.detect(text) : { level: "none", matched: [] };
    if (check.level === "crisis") {
      forced = { text: window.SAFETY.crisisReply(), emotion: "fear", source: "safety", safetyFlag: "L2" };
      addSystemNote(ids, "刚才那条消息命中危机信号（" + check.matched.join("、") + "），本轮按 R2 模板原样输出，不做角色化回应。");
      toast("触发安全红线：已按 R2 给出求助资源（12356）", "warn");
    } else if (check.level === "referral") {
      forced = { text: window.SAFETY.referralReply(), emotion: "anxiety", source: "safety", safetyFlag: "R3" };
      addSystemNote(ids, "用户在问诊断或用药，按 R3 处理：承认困扰、不做判断、建议专业评估。");
      toast("检测到诊断/用药诱导，按 R3 转介处理");
    } else if (check.level === "watch") {
      var w = runtime.watch ? runtime.watch.note("watch", check.kind) : { escalated: false };
      if (!w.escalated && check.kind === "distress") {
        toast("已记下这轮消耗，连续三轮会主动给出求助资源（R6）");
      }
      if (w.escalated) {
        addSystemNote(ids, w.prompt);
        toast("连续 " + w.count + " 轮高消耗状态，已触发 R6 软性升级");
      }
    } else if (runtime.watch) {
      runtime.watch.note("none");
    }

    try {
      if (runtime.speech.sequential && ids.length > 1) {
        for (var i = 0; i < ids.length; i++) {
          if (i > 0) await sleep(runtime.speech.gapMs);
          await talkTo(ids[i], text, forced);
        }
      } else {
        await Promise.all(ids.map(function (id) { return talkTo(id, text, forced); }));
      }
    } catch (err) {
      toast("对话出错：" + err.message, "warn");
    } finally {
      runtime.busy = false;
      els.send.disabled = false;
      els.input.focus();
    }
  }

  async function runAutoDemo() {
    if (runtime.demoRunning) return;
    runtime.demoRunning = true;
    els.btnAuto.disabled = true;
    els.btnAuto.textContent = "演示中...";
    try {
      for (var i = 0; i < window.MOCK.demoScript.length; i++) {
        await handleSend(window.MOCK.demoScript[i], "both");
        await sleep(900);
      }
    } finally {
      runtime.demoRunning = false;
      els.btnAuto.disabled = false;
      els.btnAuto.textContent = "自动演示";
    }
  }

  function renderOpening() {
    window.PERSONAS.forEach(function (p) {
      var c = runtime.cards[p.id];
      addBubble(p.id, "bot", p.opening, p.openingEmotion);
      c.history.push({ role: "assistant", content: p.opening });
      c.avatar.setEmotion(p.openingEmotion || "平静");
    });
  }

  function exportTranscript() {
    var lines = ["# 双自我对话记录", "", "导出时间：" + new Date().toLocaleString("zh-CN"), ""];
    window.PERSONAS.forEach(function (p) {
      lines.push("## " + p.name + "（" + p.subtitle + "）", "");
      runtime.cards[p.id].transcript.querySelectorAll(".bubble-row").forEach(function (row) {
        var isUser = row.classList.contains("row-user");
        var tag = row.querySelector(".emotion-tag");
        var text = row.querySelector(".bubble").textContent;
        lines.push((isUser ? "**我：** " : "**" + p.name + "**" + (tag ? "（" + tag.textContent + "）" : "") + "：") + text);
        lines.push("");
      });
    });
    var blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "双自我对话记录.md";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function clearAll() {
    window.PERSONAS.forEach(function (p) {
      var c = runtime.cards[p.id];
      c.transcript.innerHTML = "";
      c.history = [{ role: "system", content: p.systemPrompt + "\n\n" + window.SAFETY_RULES }];
      c.turn = 0;
      c.avatar.setEmotion(p.openingEmotion || "平静");
      setChip(p.id, "倾听中");
    });
    renderOpening();
  }

  // ------------------------------------------------------------ 人格卡（问卷 + 日记）

  var cardFingerprint = "";

  function cardRole() {
    return els.cardRoleSelect && els.cardRoleSelect.value === "future" ? "future" : "past";
  }

  /**
   * 把人格卡同步到界面与两个分身的 systemPrompt。
   * 从问卷页 / 日记页回到本页时会自动刷新，已经开始的对话也会换成新的 systemPrompt。
   */
  function refreshPersonaCard(silent) {
    if (!window.PERSONA_CARD) return null;
    var card = window.PERSONA_CARD.applyToPersonas();
    var block = window.PERSONA_CARD.block(cardRole(), card);
    if (els.cardView) els.cardView.value = block;

    var empty = window.PERSONA_CARD.isEmpty(card);
    var s = (card && card.stats) || {};
    if (els.cardBadge) {
      els.cardBadge.textContent = empty
        ? "人格卡：暂无材料"
        : ("人格卡：问卷" + (s.has_survey ? "已填" : "未填") + "｜日记 " + (s.usable_count || 0) + " 篇");
      els.cardBadge.className = "badge " + (empty ? "badge-off" : "badge-live");
    }
    if (els.cardHint && !empty) {
      els.cardHint.textContent = "由问卷与日记自动提炼，替换 systemPrompt 里的 {{PERSONA_CARD}}；"
        + "高痛苦条目按 R10 只提炼心态，R9 命中危机信号的日记不进素材库。";
    }

    window.PERSONAS.forEach(function (p) {
      var c = runtime.cards[p.id];
      if (c && c.history && c.history[0] && c.history[0].role === "system") {
        c.history[0] = { role: "system", content: p.systemPrompt };
      }
    });

    var fp = JSON.stringify(block);
    var changed = !!cardFingerprint && fp !== cardFingerprint;
    cardFingerprint = fp;
    if (changed && !silent) toast("人格卡已更新，两个分身现在读的是新材料");
    return card;
  }
  // ------------------------------------------------------------------ 事件

  function bindEvents() {
    els.send.addEventListener("click", function () {
      var text = els.input.value;
      els.input.value = "";
      handleSend(text, currentTarget());
    });

    els.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        els.send.click();
      }
    });

    if (els.cardRoleSelect) {
      els.cardRoleSelect.addEventListener("change", function () { refreshPersonaCard(true); });
    }
    window.addEventListener("focus", function () { refreshPersonaCard(); });
    document.addEventListener("visibilitychange", function () { if (!document.hidden) refreshPersonaCard(); });

    els.btnAuto.addEventListener("click", runAutoDemo);
    els.btnClear.addEventListener("click", clearAll);
    els.btnExport.addEventListener("click", exportTranscript);
    els.btnSettings.addEventListener("click", function () {
      els.settings.classList.toggle("open");
    });
    els.btnCloseSettings.addEventListener("click", function () {
      els.settings.classList.remove("open");
    });

    els.modeSelect.addEventListener("change", function () {
      runtime.mode = els.modeSelect.value;
      applyBadges();
      toast("已切换到" + (effectiveMode() === "live" ? "真实后端" : "演示模式"));
    });

    els.mouthRange.addEventListener("input", function () {
      var v = parseFloat(els.mouthRange.value);
      runtime.speech.mouthSensitivity = v;
      window.PERSONAS.forEach(function (p) {
        runtime.cards[p.id].avatar.setMouthSensitivity(v);
      });
      els.mouthValue.textContent = v.toFixed(2);
    });

    els.seqToggle.addEventListener("change", function () {
      runtime.speech.sequential = els.seqToggle.checked;
    });

    els.btnRecheck.addEventListener("click", async function () {
      toast("正在检测后端...");
      var ok = await checkBackend();
      toast(ok ? "后端已连接" : "后端未连接，将使用演示文案");
    });

    document.querySelectorAll(".prompt-chip").forEach(function (chip) {
      chip.addEventListener("click", function () {
        els.input.value = chip.dataset.text;
        els.input.focus();
      });
    });

    window.PERSONAS.forEach(function (p) {
      var btn = document.createElement("button");
      btn.className = "mini-btn";
      btn.textContent = "导出形象";
      btn.addEventListener("click", function () {
        runtime.cards[p.id].avatar.exportSvg();
        toast("已导出 " + p.name + " 的形象 SVG");
      });
      runtime.cards[p.id].card.querySelector(".card-head").appendChild(btn);
    });
  }

  /** 把当前概念的名字、情绪口径、知识库状态写到界面上，避免演示时口径说不清 */
  function applyConceptLabel() {
    var names = window.PERSONAS.map(function (p) { return p.name; }).join(" 与 ");
    if (els.conceptSub) {
      els.conceptSub.textContent = names + " 同时在场，陪你聊完一件今天的事";
    }
    if (els.protocolInfo) {
      var kb = runtime.config && runtime.config.knowledge;
      els.protocolInfo.value = "情绪：官方 16 类枚举（展示映射 6 类）"
        + "｜安全：L2 危机拦截 / R3 拒诊断 / R6 软升级"
        + (kb && kb.enabled ? "｜知识库：v2 检索增强已开启" : "｜知识库：未加载");
    }
    var labels = document.querySelectorAll("#targets label span");
    if (labels.length >= 3) {
      labels[1].textContent = "只问" + window.PERSONAS[0].name;
      labels[2].textContent = "只问" + window.PERSONAS[1].name;
    }
  }

  function cacheEls() {
    els.stage = $("stage");
    els.input = $("input");
    els.send = $("send");

    els.btnAuto = $("btnAuto");
    els.btnClear = $("btnClear");
    els.btnExport = $("btnExport");
    els.btnSettings = $("btnSettings");
    els.settings = $("settings");
    els.btnCloseSettings = $("btnCloseSettings");
    els.modeBadge = $("modeBadge");
    els.backendBadge = $("backendBadge");
    els.backendAddr = $("backendAddr");
    els.modeSelect = $("modeSelect");
    els.mouthRange = $("mouthRange");
    els.mouthValue = $("mouthValue");
    els.seqToggle = $("seqToggle");
    els.btnRecheck = $("btnRecheck");
    els.protocolInfo = $("protocolInfo");
    els.cardBadge = $("cardBadge");
    els.cardView = $("cardView");
    els.cardRoleSelect = $("cardRoleSelect");
    els.cardHint = $("cardHint");
    els.conceptSub = $("conceptSub");
  }

  function syncSettingsUI() {
    els.modeSelect.value = runtime.mode;
    els.mouthRange.value = runtime.speech.mouthSensitivity;
    els.mouthValue.textContent = Number(runtime.speech.mouthSensitivity).toFixed(2);
    els.seqToggle.checked = runtime.speech.sequential !== false;
  }

  async function boot() {
    cacheEls();
    await loadConfig();
    applyConceptLabel();
    if (window.PERSONA_CARD && window.PERSONA_CARD.hydrate) { await window.PERSONA_CARD.hydrate(); }
    var startCard = refreshPersonaCard(true);
    if (window.PERSONA_CARD && window.PERSONA_CARD.isEmpty(startCard)) {
      toast("两个分身还没有材料：点顶部「问卷」填 11 题，再去「日记」写一篇", "warn");
    }
    window.PERSONAS.forEach(buildCard);
    renderOpening();
    bindEvents();
    syncSettingsUI();
    checkBackend();

    var params = new URLSearchParams(location.search);

    // 形象预览：?pose=低落 可直接预览某个情绪下的形象，?speak=1 让嘴部保持说话状态。
    // 预览后点「导出形象」就能得到该表情的 SVG，可直接放进答辩 PPT。
    var pose = params.get("pose");
    if (pose && window.EMOTIONS.indexOf(pose) >= 0) {
      window.PERSONAS.forEach(function (p) {
        runtime.cards[p.id].avatar.setEmotion(pose);
      });
      toast("已预览表情：" + pose + "，可点「导出形象」保存");
    }
    if (params.get("speak") === "1") {
      window.PERSONAS.forEach(function (p) {
        runtime.cards[p.id].avatar.setState("speaking");
        setChip(p.id, "说话中", "speak");
      });
    }

    if (params.get("demo") === "1") {
      setTimeout(runAutoDemo, 900);
    }
    // ?demo=safety 直接把安全红线演示用例发出去，用于验收 R2 前置拦截的效果
    if (params.get("demo") === "safety") {
      setTimeout(function () { handleSend(window.MOCK.safetyDemo[0], "both"); }, 900);
    }
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
