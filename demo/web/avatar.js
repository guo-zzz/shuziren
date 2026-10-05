/**
 * 数字人形象模块（交付物之一）
 *
 * 用 SVG 直接绘制形象，而不是用图片素材，原因有三个：
 *   1. 嘴部是真实可控的图形元素，口型动画精确、不会错位；
 *   2. 不依赖任何外部素材文件，换人设只改配色即可；
 *   3. 可以一键导出成 SVG 或 PNG，直接放进答辩 PPT。
 *
 * 对外接口：
 *   const avatar = createAvatar(容器元素, 人设对象);
 *   avatar.setEmotion("低落");           // 切换表情，情绪词见 personas.js
 *   avatar.setState("speaking");         // idle | listening | thinking | speaking
 *   avatar.setAudioLevel(0.6);           // 预留：接入 TTS 音频后用它驱动口型
 *   avatar.setMouthSensitivity(1.2);     // 口型幅度
 *   avatar.exportSvg();                  // 下载 SVG
 */

(function () {
  var uid = 0;

  var EMOTION_PRESETS = {
    "开心": { browY: -3, browRot: 3, eyeScale: 1.0, curve: 1.0, blush: 0.55, tilt: 0, restOpen: 0.06 },
    "平静": { browY: 0, browRot: 0, eyeScale: 1.0, curve: 0.25, blush: 0.22, tilt: 0, restOpen: 0.0 },
    "低落": { browY: 2, browRot: -7, eyeScale: 0.86, curve: -0.8, blush: 0.12, tilt: -3, restOpen: 0.0 },
    "焦虑": { browY: 1, browRot: -4, eyeScale: 1.02, curve: -0.25, blush: 0.20, tilt: 2, restOpen: 0.02 },
    "愤怒": { browY: 3, browRot: 11, eyeScale: 0.92, curve: -0.9, blush: 0.28, tilt: 0, restOpen: 0.0 },
    "惊喜": { browY: -5, browRot: 0, eyeScale: 1.16, curve: 0.5, blush: 0.5, tilt: 1, restOpen: 0.16 },
  };

  function el(tag, attrs) {
    var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.keys(attrs || {}).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    return node;
  }

  function mouthPath(open, curve) {
    var cx = 120, cy = 178;
    var w = 30 + open * 9;
    var h = 3 + open * 17;
    var lift = curve * 3.5;
    var lx = cx - w / 2, rx = cx + w / 2;
    var ly = cy - lift * 0.7, ry = cy - lift * 0.7;
    var topC = cy - 2 - lift * 1.5;
    var botC = cy + h + (curve < 0 ? curve * 2.5 : 0);
    return "M " + lx.toFixed(2) + " " + ly.toFixed(2)
      + " Q " + cx + " " + topC.toFixed(2) + " " + rx.toFixed(2) + " " + ry.toFixed(2)
      + " Q " + cx + " " + botC.toFixed(2) + " " + lx.toFixed(2) + " " + ly.toFixed(2) + " Z";
  }

  function buildSvg(persona) {
    var id = "av" + (++uid);
    var p = persona.palette;
    var svg = el("svg", {
      viewBox: "0 0 240 310",
      xmlns: "http://www.w3.org/2000/svg",
      "class": "avatar-svg",
      role: "img",
      "aria-label": persona.name + " 的数字人形象",
    });

    var defs = el("defs");
    var grad = el("linearGradient", { id: id + "-cloth", x1: "0", y1: "0", x2: "0", y2: "1" });
    grad.appendChild(el("stop", { offset: "0%", "stop-color": p.cloth }));
    grad.appendChild(el("stop", { offset: "100%", "stop-color": p.clothDark }));
    defs.appendChild(grad);

    var clip = el("clipPath", { id: id + "-mouthclip" });
    var clipPath = el("path", { id: id + "-mouthclippath", d: mouthPath(0, 0) });
    clip.appendChild(clipPath);
    defs.appendChild(clip);
    svg.appendChild(defs);

    // 身体
    var body = el("g", { id: id + "-body" });
    body.appendChild(el("path", {
      d: "M42 310 C42 256 82 234 120 234 C158 234 198 256 198 310 Z",
      fill: "url(#" + id + "-cloth)",
    }));
    body.appendChild(el("path", {
      d: "M120 234 C112 250 108 274 108 310 M120 234 C128 250 132 274 132 310",
      fill: "none", stroke: p.clothDark, "stroke-width": "2.4", opacity: "0.7",
    }));
    svg.appendChild(body);

    // 脖子
    svg.appendChild(el("rect", { x: "104", y: "186", width: "32", height: "58", rx: "14", fill: p.skinShade }));

    // 头部（整体可做轻微摆动）
    var head = el("g", { id: id + "-head" });
    head.appendChild(el("ellipse", { cx: "58", cy: "146", rx: "11", ry: "17", fill: p.skinShade }));
    head.appendChild(el("ellipse", { cx: "182", cy: "146", rx: "11", ry: "17", fill: p.skinShade }));
    head.appendChild(el("ellipse", { cx: "120", cy: "140", rx: "63", ry: "75", fill: p.skin }));

    // 头发
    head.appendChild(el("path", {
      d: "M56 140 C52 76 88 50 120 50 C152 50 188 76 184 140 "
        + "C177 112 165 95 147 87 C135 100 104 106 87 97 C71 89 60 108 56 140 Z",
      fill: p.hair,
    }));
    head.appendChild(el("path", {
      d: "M74 84 C88 66 108 58 126 58 C112 66 98 76 88 90 Z",
      fill: p.hairLight, opacity: "0.75",
    }));

    // 眉毛
    var browL = el("path", {
      id: id + "-browL", d: "M86 110 Q99 103 112 106",
      fill: "none", stroke: p.hair, "stroke-width": "5", "stroke-linecap": "round",
    });
    var browR = el("path", {
      id: id + "-browR", d: "M128 106 Q141 103 154 110",
      fill: "none", stroke: p.hair, "stroke-width": "5", "stroke-linecap": "round",
    });
    head.appendChild(browL);
    head.appendChild(browR);

    // 眼睛
    function eye(cx, isLeft) {
      var g = el("g", { id: id + (isLeft ? "-eyeL" : "-eyeR") });
      g.appendChild(el("ellipse", {
        cx: cx, cy: "134", rx: "13", ry: "14", fill: "#FFFFFF",
      }));
      var iris = el("circle", { cx: cx, cy: "135", r: "7.4", fill: p.eye });
      g.appendChild(iris);
      g.appendChild(el("circle", { cx: cx - 2.6, cy: "131.5", r: "2.5", fill: "#FFFFFF", opacity: "0.9" }));
      g.appendChild(el("path", {
        d: "M" + (cx - 14) + " 128 Q" + cx + " 118 " + (cx + 14) + " 128",
        fill: "none", stroke: p.hair, "stroke-width": "2.6", "stroke-linecap": "round", opacity: "0.85",
      }));
      g.dataset.cx = String(cx);
      g.dataset.cy = "134";
      g.dataset.irisX = String(cx);
      return g;
    }
    var eyeL = eye(98, true);
    var eyeR = eye(142, false);
    head.appendChild(eyeL);
    head.appendChild(eyeR);

    // 鼻子
    head.appendChild(el("path", {
      d: "M118 154 Q120 159 125 156", fill: "none", stroke: p.skinShade,
      "stroke-width": "2.6", "stroke-linecap": "round",
    }));

    // 嘴
    var mouth = el("path", { id: id + "-mouth", d: mouthPath(0, 0.25), fill: "#8E4B48" });
    head.appendChild(mouth);
    var tongue = el("ellipse", {
      cx: "120", cy: "196", rx: "9", ry: "6", fill: "#D9736E",
      "clip-path": "url(#" + id + "-mouthclip)", opacity: "0",
    });
    head.appendChild(tongue);

    // 腮红
    var blushL = el("ellipse", { cx: "82", cy: "164", rx: "14", ry: "8.5", fill: "#E8896F", opacity: "0.2" });
    var blushR = el("ellipse", { cx: "158", cy: "164", rx: "14", ry: "8.5", fill: "#E8896F", opacity: "0.2" });
    head.appendChild(blushL);
    head.appendChild(blushR);

    svg.appendChild(head);

    return {
      svg: svg,
      refs: {
        head: head, browL: browL, browR: browR, eyeL: eyeL, eyeR: eyeR,
        mouth: mouth, tongue: tongue, clipPath: clipPath,
        blushL: blushL, blushR: blushR, id: id,
      },
    };
  }

  window.createAvatar = function (mount, persona) {
    var built = buildSvg(persona);
    var r = built.refs;
    var svg = built.svg;

    var state = {
      emotion: "平静",
      mode: "idle",
      openness: 0,
      target: 0,
      audio: 0,
      sensitivity: 1,
      blink: 1,
      blinkUntil: 0,
      nextBlink: performance.now() + 2500,
      look: { x: 0, y: 0 },
      lookTarget: { x: 0, y: 0 },
    };

    mount.innerHTML = "";
    mount.appendChild(svg);

    function setEmotion(name) {
      if (EMOTION_PRESETS[name]) state.emotion = name;
    }

    function applyStateTargets(mode) {
      if (mode === "thinking") state.lookTarget = { x: -3, y: -3 };
      else if (mode === "listening") state.lookTarget = { x: 0, y: 1 };
      else state.lookTarget = { x: 0, y: 0 };
    }

    function setStateInner(mode) { state.mode = mode; }

    function renderMouth() {
      var curve = EMOTION_PRESETS[state.emotion].curve;
      r.mouth.setAttribute("d", mouthPath(state.openness, curve));
      r.clipPath.setAttribute("d", mouthPath(state.openness, curve));
      var showTongue = state.openness > 0.35;
      r.tongue.setAttribute("opacity", showTongue ? String(Math.min(1, state.openness)) : "0");
      r.tongue.setAttribute("cy", String(186 + state.openness * 8));
    }

    function renderFace(now) {
      var preset = EMOTION_PRESETS[state.emotion];
      var blinkScale = 1;
      if (now < state.blinkUntil) blinkScale = 0.12;

      [r.eyeL, r.eyeR].forEach(function (g) {
        var cx = parseFloat(g.dataset.cx);
        var scale = preset.eyeScale * blinkScale;
        g.setAttribute("transform", "translate(" + cx + ",134) scale(1," + scale.toFixed(3) + ") translate(" + (-cx) + ",-134)");
        var iris = g.querySelector("circle");
        var look = state.mode === "thinking" ? { x: -2.6, y: -2.2 } : state.look;
        iris.setAttribute("cx", String(cx + look.x));
        iris.setAttribute("cy", String(135 + look.y));
      });

      var browY = preset.browY;
      r.browL.setAttribute("transform", "translate(0," + browY + ") rotate(" + preset.browRot + " 86 110)");
      r.browR.setAttribute("transform", "translate(0," + browY + ") rotate(" + (-preset.browRot) + " 154 110)");

      r.blushL.setAttribute("opacity", String(preset.blush));
      r.blushR.setAttribute("opacity", String(preset.blush));

      var bob = state.mode === "speaking" ? Math.sin(now / 320) * 1.6 : 0;
      var tilt = preset.tilt + (state.mode === "listening" ? 2.5 : 0);
      r.head.setAttribute("transform",
        "translate(120," + (140 + bob).toFixed(2) + ") rotate(" + tilt + ") translate(-120,-140)");
    }

    function tick(now) {
      if (now > state.nextBlink && now > state.blinkUntil) {
        state.blinkUntil = now + 130;
        state.nextBlink = now + 2400 + Math.random() * 3600;
      }

      var target = 0;
      if (state.audio > 0.02) {
        target = Math.min(1, state.audio * 1.15);
      } else if (state.mode === "speaking") {
        var env = 0.42 + 0.58 * Math.abs(Math.sin(now / 118));
        var jitter = 0.82 + 0.36 * Math.abs(Math.sin(now / 47));
        target = Math.max(0.16, Math.min(1, env * jitter * state.sensitivity));
      } else {
        target = EMOTION_PRESETS[state.emotion].restOpen;
      }
      state.target = target;
      state.openness += (target - state.openness) * (target > state.openness ? 0.42 : 0.26);

      state.look.x += (state.lookTarget.x - state.look.x) * 0.08;
      state.look.y += (state.lookTarget.y - state.look.y) * 0.08;

      renderMouth();
      renderFace(now);
      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);

    return {
      element: svg,
      setEmotion: setEmotion,
      setState: function (mode) { setStateInner(mode); applyStateTargets(mode); },
      setAudioLevel: function (v) { state.audio = Math.max(0, Math.min(1, v || 0)); },
      setMouthSensitivity: function (v) { state.sensitivity = Math.max(0.3, Math.min(2.5, v || 1)); },
      exportSvg: function () {
        var clone = svg.cloneNode(true);
        clone.setAttribute("width", "480");
        clone.setAttribute("height", "620");
        var source = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone);
        var blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = persona.id + "-avatar.svg";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      },
    };
  };
})();