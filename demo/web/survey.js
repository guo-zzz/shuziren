/** 基线问卷页：渲染 P1 的题目、保存到人格卡管道 */
(async function () {
  var PC = window.PERSONA_CARD;
  var form = document.getElementById("questions");
  var status = document.getElementById("status");
  await PC.hydrate();
  var state = PC.readSurvey() || {};

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function renderQuestion(q) {
    var box = el("div", "q");
    var title = el("div", "qtitle");
    title.appendChild(document.createTextNode(q.title));
    if (q.required) title.appendChild(el("span", "req", "必答"));
    box.appendChild(title);
    if (q.hint) box.appendChild(el("div", "qhint", q.hint));

    var body = el("div", "qbody");

    if (q.type === "text") {
      var input = document.createElement("input");
      input.type = "text";
      input.id = "q_" + q.id;
      input.value = state[q.id] || "";
      input.placeholder = "例如：小柱";
      input.addEventListener("input", function () { state[q.id] = input.value; });
      body.appendChild(input);
    } else if (q.type === "textarea") {
      var ta = document.createElement("textarea");
      ta.id = "q_" + q.id;
      ta.value = state[q.id] || "";
      ta.rows = 3;
      ta.addEventListener("input", function () { state[q.id] = ta.value; });
      body.appendChild(ta);
    } else {
      (q.options || []).forEach(function (opt) {
        var label = el("label", "opt");
        var input = document.createElement("input");
        input.type = q.type === "checks" ? "checkbox" : "radio";
        input.name = "q_" + q.id;
        input.value = opt;
        if (q.type === "checks") {
          input.checked = Array.isArray(state[q.id]) && state[q.id].indexOf(opt) >= 0;
        } else {
          input.checked = state[q.id] === opt;
        }
        input.addEventListener("change", function () {
          if (q.type === "checks") {
            var list = Array.isArray(state[q.id]) ? state[q.id].slice() : [];
            if (input.checked) {
              if (q.max && list.length >= q.max) { input.checked = false; flash("「" + q.title + "」最多选 " + q.max + " 个"); return; }
              list.push(opt);
            } else {
              list = list.filter(function (x) { return x !== opt; });
            }
            state[q.id] = list;
          } else {
            state[q.id] = opt;
          }
        });
        label.appendChild(input);
        label.appendChild(el("span", null, opt));
        body.appendChild(label);
      });
    }

    box.appendChild(body);
    form.appendChild(box);
  }

  function flash(text, kind) {
    status.textContent = text;
    status.style.color = kind === "warn" ? "#94595c" : "#1d7a4b";
  }

  function save() {
    var missing = [];
    PC.QUESTIONS.forEach(function (q) {
      if (!q.required) return;
      var v = state[q.id];
      if (!v || !String(v).trim()) missing.push(q.title);
    });
    if (missing.length) {
      flash("还差必答题：" + missing.join("、"), "warn");
      return false;
    }
    PC.writeSurvey(state);
    PC.writeCard(PC.buildCard(state, PC.readDiary()));
    flash("已保存（" + new Date().toLocaleTimeString("zh-CN") + "）。去写一篇日记，两个分身就有材料了。");
    return true;
  }

  PC.QUESTIONS.forEach(renderQuestion);
  if (PC.readSurvey()) status.textContent = "已载入上次保存的答案";

  document.getElementById("btnSave").addEventListener("click", save);
  document.getElementById("btnSaveDiary").addEventListener("click", function () {
    if (save()) location.href = "diary.html";
  });
  document.getElementById("btnClear").addEventListener("click", function () {
    if (!confirm("清空问卷答案？日记和人格卡不受影响。")) return;
    var s = PC.readSurvey();
    PC.writeSurvey({});
    state = {};
    PC.QUESTIONS.forEach(function (q) {
      var node = document.getElementById("q_" + q.id);
      if (node) node.value = "";
      document.querySelectorAll('input[name="q_' + q.id + '"]').forEach(function (i) { i.checked = false; });
    });
    if (s) PC.writeCard(PC.buildCard({}, PC.readDiary()));
    flash("问卷已清空。");
  });
})();