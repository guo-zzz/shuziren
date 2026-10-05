/** 日记页：写日记（R9 扫描）→ 提炼 → 人格卡预览 */
(async function () {
  var PC = window.PERSONA_CARD;
  var role = "past";

  var els = {
    date: document.getElementById("date"),
    entry: document.getElementById("entry"),
    add: document.getElementById("btnAdd"),
    sample: document.getElementById("btnSample"),
    entryStatus: document.getElementById("entryStatus"),
    scanResult: document.getElementById("scanResult"),
    cardStatus: document.getElementById("cardStatus"),
    cardNotice: document.getElementById("cardNotice"),
    build: document.getElementById("btnBuild"),
    refine: document.getElementById("btnRefine"),
    view: document.getElementById("cardView"),
    entries: document.getElementById("entries"),
    step1: document.getElementById("step1"),
  };

  await PC.hydrate();

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ------------------------------------------------------------ 人格卡视图

  function renderCard() {
    var card = PC.readCard();
    var survey = PC.readSurvey();
    var diary = PC.readDiary();
    var usable = diary.filter(function (e) { return !e.blocked; });

    if (PC.isEmpty(card)) {
      els.cardStatus.textContent = "还没有材料：问卷 " + (survey ? "已填" : "未填")
        + "，日记 " + diary.length + " 篇。";
      els.cardNotice.innerHTML = "";
      els.view.textContent = "（先填问卷、写至少一篇日记，再点「生成 / 更新人格卡」）";
      return;
    }

    var s = card.stats || {};
    els.cardStatus.textContent = "问卷 " + (s.has_survey ? "已填" : "未填")
      + "｜日记 " + s.diary_count + " 篇（可用 " + s.usable_count + "，高痛苦 " + s.high_distress_count
      + "，按 R9 未入库 " + s.blocked_count + "）｜来源：" + (card.source === "backend-llm" ? "后端模型提炼" : "本地规则提炼")
      + "｜更新时间：" + new Date(card.builtAt).toLocaleString("zh-CN");

    els.cardNotice.innerHTML = "";
    if (s.blocked_count > 0) {
      els.cardNotice.appendChild(el("div", "notice bad",
        "有 " + s.blocked_count + " 篇日记命中危机信号，按 R9 没有进入素材库，也不会出现在下面的内容里。"));
    }
    if (!s.has_survey) {
      els.cardNotice.appendChild(el("div", "notice warn", "问卷还没填，「未来的我」暂时不知道该往哪走——点右上角「去填问卷」。"));
    }
    if (s.high_distress_count > 0) {
      els.cardNotice.appendChild(el("div", "notice warn",
        "有 " + s.high_distress_count + " 篇高痛苦条目：只参与心态提炼，不进入可引用细节（R10）。"));
    }

    els.view.textContent = PC.block(role, card);
  }

  function renderEntries() {
    var list = PC.readDiary().slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    els.entries.innerHTML = "";
    if (!list.length) {
      els.entries.appendChild(el("div", "empty", "还没有日记。"));
      return;
    }
    list.forEach(function (e) {
      var box = el("div", "entry" + (e.blocked ? " blocked" : (e.highDistress ? " high" : "")));
      var meta = el("div", "meta");
      meta.appendChild(el("span", "pill", e.date));
      if (e.emotion16) {
        var emoPill = el("span", "pill emotion", (e.emotion_zh || "") + " · " + e.emotion16);
        emoPill.title = "由前端规则兜底判定；接入后端模型后由模型返回 emotion_label";
        meta.appendChild(emoPill);
      }
      meta.appendChild(el("span", "pill" + (e.blocked ? " bad" : (e.highDistress ? " warn" : " ok")),
        e.blocked ? "未入库（R9）" : (e.highDistress ? "高痛苦（R10）" : "可引用素材")));
      box.appendChild(meta);
      box.appendChild(el("div", "text", e.text));
      var foot = el("div", "foot");
      if (e.event) foot.appendChild(el("span", "pill", "事件：" + e.event));
      if (e.wish) foot.appendChild(el("span", "pill", "愿望线索：" + e.wish));
      (e.details || []).forEach(function (d) { foot.appendChild(el("span", "pill", "细节：" + d)); });
      if (e.scan && e.scan.matched && e.scan.matched.length) {
        foot.appendChild(el("span", "pill warn", "命中词：" + e.scan.matched.join("、")));
      }
      var del = el("button", "ghost", "删除");
      del.style.marginLeft = "auto";
      del.addEventListener("click", function () {
        PC.removeDiaryEntry(e.id);
        PC.writeCard(PC.buildCard(PC.readSurvey() || {}, PC.readDiary()));
        renderAll();
      });
      foot.appendChild(del);
      box.appendChild(foot);
      els.entries.appendChild(box);
    });
  }

  function renderSteps() {
    var survey = PC.readSurvey();
    els.step1.className = "step" + (survey && survey.dream ? " done" : "");
  }

  function renderAll() {
    renderCard();
    renderEntries();
    renderSteps();
  }

  // ------------------------------------------------------------ 交互

  function flash(text, kind) {
    els.entryStatus.textContent = text;
    els.entryStatus.style.color = kind === "warn" ? "#94595c" : "#4b5a6d";
  }

  function submit() {
    var text = els.entry.value.trim();
    if (!text) { flash("先写点什么再入库。", "warn"); return; }
    var result = PC.addDiaryEntry({ date: els.date.value || PC.today(), text: text });
    if (!result) { flash("这条日记是空的，没有入库。", "warn"); return; }

    els.scanResult.innerHTML = "";
    var cls = result.verdict.level === "blocked" ? "bad" : (result.verdict.level === "high" ? "warn" : "ok");
    var text2 = result.verdict.text;
    if (result.blocked && window.SAFETY) text2 = text2 + "\n\n" + window.SAFETY.crisisReply();
    els.scanResult.appendChild(el("div", "notice " + cls, text2));

    els.entry.value = "";
    flash(result.duplicate
      ? ("已存在：" + result.entry.date)
      : (result.blocked
        ? ("已写入 " + result.entry.date + "，但按 R9 未进入素材库")
        : ("已写入 " + result.entry.date + "（" + result.entry.emotion_zh + " · " + result.entry.emotion16 + "）")));
    PC.writeCard(PC.buildCard(PC.readSurvey() || {}, PC.readDiary()));
    renderAll();
  }

  els.date.value = PC.today();
  els.add.addEventListener("click", submit);
  els.sample.addEventListener("click", function () {
    els.entry.value = "今天下午和室友因为值日的事吵了两句，回宿舍有点尴尬。其实我不是气他，是气自己当时说不出话。"
      + "想着明天找机会把话说清楚，先想好第一句怎么说。";
    els.entry.focus();
  });
  els.entry.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
  });

  els.build.addEventListener("click", function () {
    var card = PC.buildCard(PC.readSurvey() || {}, PC.readDiary());
    PC.writeCard(card);
    renderAll();
    flash("人格卡已更新（本地规则提炼）。回对话页就能用上。");
  });

  els.refine.addEventListener("click", async function () {
    els.refine.disabled = true;
    els.refine.textContent = "提炼中…";
    try {
      await PC.refineWithBackend();
      renderAll();
      flash("后端模型已重新提炼，来源标记为 backend-llm。");
    } catch (err) {
      flash("后端提炼失败：" + err.message + "（本地规则版仍然可用）", "warn");
    } finally {
      els.refine.disabled = false;
      els.refine.textContent = "用后端模型重新提炼";
    }
  });

  document.querySelectorAll("#cardTabs .tab").forEach(function (tab) {
    tab.addEventListener("click", function () {
      document.querySelectorAll("#cardTabs .tab").forEach(function (t) { t.classList.remove("on"); });
      tab.classList.add("on");
      role = tab.dataset.role;
      renderCard();
    });
  });

  // 后端不在线时，把「用后端模型重新提炼」置灰并说明原因
  (async function () {
    try {
      var res = await fetch("/api/health", { cache: "no-store" });
      var data = await res.json();
      if (data.backend !== "online") {
        els.refine.disabled = true;
        els.refine.title = "后端大模型未连接（config.json 的 backend.baseUrl）";
        els.refine.textContent = "用后端模型重新提炼（后端未连接）";
      }
    } catch (e) {
      els.refine.disabled = true;
      els.refine.textContent = "用后端模型重新提炼（后端未连接）";
    }
  })();

  renderAll();
})();