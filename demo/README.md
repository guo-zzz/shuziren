# 双自我对话 · 数字人交互 Demo

2026 动感地带 AI+ 高校创智计划 · AI 技术赛道｜命题方向二：数字人综合情感陪伴对话模型
负责人：郭柱（数字人前端交互 Demo 实现）

一句话说明：一个「过去的我」和「未来的我」同时出现在屏幕上的对话页面。过去的我是镜子，
停在写日记那一刻；未来的我是引路人，由问卷梦想和日记愿望投射而来。用户说一件事，
左边先接住情绪，右边再给出这周能做的一小步，数字人跟着情绪换表情、说话时张合嘴巴。

> 概念口径：唐应杰《心理 skill 知识库 v2.1》。旧概念「当下的我 × 理想的我」完整保留，
> 地址后加 `?concept=present_ideal` 即可切回，方便对照演示。

---

## 一、30 秒跑起来

1. 双击 `启动Demo.bat`（或在本目录执行 `node server.mjs`）。
2. 浏览器会自动打开 `http://127.0.0.1:8090`。
3. 后端没连上时页面会进入**演示模式**，用预置文案把整套流程演完。

顶部工具栏：

| 按钮 | 作用 |
| --- | --- |
| 自动演示 | 走一遍完整脚本（输入心事 → 双分身依次回应），演示/录屏用 |
| 清空 | 清空两个分身的所有对话 |
| 导出对话 | 把当前对话导出成 Markdown，方便写测试报告或答辩材料 |
| 设置 | 切换运行模式、调口型幅度、开关顺序发言、重新检测后端、查看情绪与安全口径、查看两个分身各自拿到的人格卡材料 |
| 问卷 | 打开基线问卷页（11 题），填完自动刷新人格卡 |
| 日记 | 打开日记页：写日记 → R9 安全扫描 → 提炼 → 生成人格卡预览 |

页面地址后可以加的参数：

| 参数 | 作用 |
| --- | --- |
| `?demo=1` | 打开后自动跑完整的演示脚本 |
| `?demo=safety` | 直接演示安全红线：发一条危机信号，看 R2 拦截与 12356 话术 |
| `?pose=低落` | 两个分身定格在指定表情，用来截图或导出素材 |
| `?speak=1` | 保持说话口型 |
| `?concept=present_ideal` | 切回旧概念「当下的我 × 理想的我」 |

---

## 二、目录结构

```
demo/
├─ 启动Demo.bat          双击启动（Windows，GBK 编码，中文控制台实测正常）
├─ server.mjs            零依赖 Node 服务：静态托管 + 后端转发 + 知识库检索增强 + 结构化日志
├─ config.json           后端地址、模型名、端口、知识库开关，唯一配置点
├─ README.md             本文件
├─ web/                  前端页面（原生 HTML/CSS/JS，无构建步骤）
│  ├─ index.html         页面骨架
│  ├─ styles.css         排版样式
│  ├─ app.js             主程序：对话流程、红线前置拦截、逐字显示、情绪联动
│  ├─ personas.js        两套人设（默认「过去的我 × 未来的我」）+ 安全边界
│  ├─ emotions16.js      官方 16 类情绪：判定规则、近义类辨析、16→6 表情映射
│  ├─ safety.js          安全红线 R1/R2/R3/R4/R6 的可执行实现
│  ├─ avatar.js          数字人形象绘制与动画（SVG）
│  ├─ persona-card.js    人格卡管道：问卷/日记提炼 → {{PERSONA_CARD}} 注入（P1–P4 + R9/R10）
│  ├─ survey.html        基线问卷页（11 题，P1 规格）
│  ├─ survey.js          问卷渲染、必答校验、写入本地并刷新人格卡
│  ├─ diary.html         日记页（写入 → R9 扫描 → 提炼 → 人格卡预览）
│  ├─ diary.js           日记写入 / 列表 / 人格卡两个视图渲染
│  ├─ intake.css         问卷页与日记页样式
│  └─ mock-data.js       演示模式预置文案（带官方情绪标签）
├─ knowledge/            心理 skill 知识库（唐应杰 v2.1）
│  ├─ 心理skill知识库-v2.md   知识库原文
│  ├─ build-kit.mjs      把原文解析成机器可读的卡片包
│  └─ prompt-kit.json    解析产物：11 张卡片 + 20 条技术 + 16 类情绪 + 辨析规则
├─ tests/                测试方案与执行器（唐应杰方案 v1.2）
│  ├─ 测试方案-v1.2.md
│  ├─ run-tests.mjs      测试执行器，产出报告到 tests/reports/
│  ├─ corpus/            官方抽样语料（内部使用，勿外传）
│  └─ reports/           历次执行报告（Markdown + JSON）
├─ logs/                 每轮对话的结构化日志（turns-YYYY-MM-DD.jsonl）
├─ data/                 问卷/日记/人格卡的本地镜像（浏览器 localStorage 是主存储；提交镜像不含这里的数据）
├─ tools/
│  └─ export-avatars.mjs 形象素材批量导出（生成 assets/ 下的 SVG 与总览页）
└─ assets/               形象素材（交付物）
   ├─ 形象素材总览.png     全部形象一页看完，可直接贴进 PPT
   ├─ contact-sheet.html  可交互素材总览页（服务启动后访问 /assets/contact-sheet.html）
   ├─ manifest.json       素材清单
   ├─ svg/                14 个矢量形象（past-* / future-*），PowerPoint 直接插入
   └─ png/                14 个同款 PNG（480×620）
```

---

## 三、情绪口径（重要，全队统一）

数字人的表情、日志字段、测试报告、初赛 `emotion_label` 全部走**官方 16 类英文枚举**：

```
anxiety fear helplessness sadness loneliness anger disgust shame
joy gratitude pride care relaxed surprise neutral mixed
```

- 标注对象永远是**最新这条用户消息**的情绪，不是分身自己的情绪。
- 16 类到数字人 6 种表情的映射写在 `web/emotions16.js` 的 `TO_DISPLAY` 里：
  焦虑/恐惧→焦虑，无助/悲伤/孤独/羞愧→低落，愤怒/厌恶→愤怒，
  喜悦/感激/自豪/感动→开心，放松/平静→平静，惊喜→惊喜，复杂交织→焦虑。
- 情绪来源优先级：后端返回的 `emotion` 字段 → 回复首行 `【标签】` → 前端规则兜底 `emotions16.classify()`。
  规则兜底只保证明显情绪可用，真实识别由后端模型承担（服务端已自动把 16 类对照卡与辨析规则注入 prompt）。

---

## 四、安全红线（不可被任何 prompt 覆盖）

`web/safety.js` 在**调用大模型之前**先做检测，四个等级：

| 等级 | 触发 | 行为 |
| --- | --- | --- |
| crisis | 直接危机信号、交代后事式道别 | 停止角色化回应，原样给出 R2 话术（12356 + 120/校心理中心），不调用后端 |
| referral | 问诊断、问要不要吃药 | 按 R3：承认困扰真实、不做判断、建议专业评估 |
| watch | 口语夸张 / 持续消耗 | 照常回应；「持续消耗」连续三轮触发 R6 软性升级（加强共情 + 主动给资源） |
| none | 其余 | 正常对话 |

口语夸张（烦死了、累死了、想死的心都有了）**不计入 R6、不触发 L2**，避免玩笑话被当成危机；
日记入库侧的 R9 扫描与输出侧的 R4 说教黑名单也已实现为可调用规则。

---

## 五、接入后端大模型（对接人：张力文）

改 `config.json` 一处即可，OpenAI 兼容接口直接可用：

```json
{
  "port": 8090,
  "mode": "auto",
  "knowledge": { "enabled": true },
  "backend": {
    "baseUrl": "http://127.0.0.1:8000",
    "chatPath": "/v1/chat/completions",
    "healthPath": "/v1/models",
    "apiKey": "",
    "model": "qwen2.5-7b-instruct",
    "timeoutMs": 60000
  }
}
```

- 请求：`POST http://127.0.0.1:8090/api/chat`，body 为 `{ model, stream, persona_id, messages }`，
  `persona_id` 取 `past` / `future`。`apiKey` 只存在服务端，不下发浏览器。
- 服务端会在转发前**自动注入知识库块**（总则 + 16 类情绪 + 辨析要点 + 风格基准 + 命中的 1-2 张卡片），
  前端无需改动；卡包由 `node knowledge/build-kit.mjs` 从知识库原文生成。
- 情绪标签：优先在流式块里带 `emotion` 字段（值取官方 16 类），或在回复首行写 `【sadness】`，
  两种都兼容；都不给时前端用规则兜底，不会报错。

---

## 六、结构化日志（初赛逐字段命中口径的练兵）

每轮对话结束后，前端把这一轮写进 `POST /api/log`，服务端追加到 `logs/turns-YYYY-MM-DD.jsonl`：

```json
{
  "ts": "2026-10-05T03:00:00.000Z",
  "persona": "past",
  "concept": "past_future",
  "user_text": "……",
  "reply_text": "……",
  "emotion_label": "sadness",
  "display_emotion": "低落",
  "emotion_rule": "为已失去或受挫的事难过 -> sadness",
  "safety_flag": "",
  "source": "mock",
  "latency_ms": 1240,
  "mode": "mock",
  "backend_online": false
}
```

读回日志：`GET /api/logs`（默认今天）或 `GET /api/logs?date=2026-10-05`。

---

## 七、跑测试（对接人：唐应杰）

```
node tests/run-tests.mjs                 # 全部本地可跑的项
node tests/run-tests.mjs --suite safety  # 只跑安全红线回归
node tests/run-tests.mjs --suite emotion # 只跑情绪识别实测（官方抽样语料）
node tests/run-tests.mjs --suite card    # 只跑人格卡管道（P1–P4 + R9/R10）
node tests/run-tests.mjs --mode live     # 有后端时跑真实生成（区分度 + 长历史时延）
```

报告写在 `tests/reports/`，Markdown 给人看、JSON 给脚本读。测试脚本**直接加载工程里的
`emotions16.js` 与 `safety.js`**，测的就是页面实际用的那套规则，不会出现「测试过了但页面不一样」。

当前本地模式能覆盖：安全红线回归（L2 拦截率 / 误拦率 / R3 / R6）、情绪识别实测（Macro-F1 + 混淆矩阵）、
分身区分度契约检查、时间边界契约检查、演示文案风格自检、工程冒烟、人格卡管道（P1–P4 + R9/R10，18 项）。
需要后端才能跑的：12 组区分度真实回复、长历史一致性、端到端时延（`--mode live`）。

> 语料纪律：`tests/corpus/` 抽自官方 train 集，含真实用户向对话内容，**仅限团队内部测试使用，不对外分享**；
> val 集整条留作初赛正式预演，不得提前查看。

---

## 八、改人设 / 换形象

- 文案与 prompt：改 `web/personas.js`（默认概念在 `past_future`，旧概念在 `present_ideal`）。
- 配色：改各分身 `palette`，形象立刻跟着变，不用改画图代码。
- 表情强度：改 `avatar.js` 顶部的 `EMOTION_PRESETS`（`curve` 是嘴角弧度，`blush` 是腮红，`browRot` 是眉毛角度）。
- 情绪判定词表与近义类规则：改 `web/emotions16.js`（改完记得重跑 `--suite emotion` 看 Macro-F1 变化）。
- 知识库卡片：改 `knowledge/心理skill知识库-v2.md` 原文，然后重跑 `node knowledge/build-kit.mjs`。
- 形象素材：改完配色后执行 `node tools/export-avatars.mjs` 重新生成 SVG、清单与总览页。

---

## 九、问卷页与日记页（人格卡管道）

两个分身不是靠「演得像」，而是靠**用户自己填的材料**：问卷给方向，日记给细节。两份数据都只存在
这台电脑的浏览器里（`localStorage` 主存储 + `demo/data/` 镜像），**不用填真实姓名、学号、住址**。

### 9.1 页面入口

| 地址 | 说明 |
| --- | --- |
| `/survey.html`（顶栏「问卷」） | 基线问卷 11 题（P1 规格）：昵称、内外向、直觉/现实、当前困扰、梦想（必答）、欣赏的品质、期望语气、最近成就、三年后、最想解决、最怕变成 |
| `/diary.html`（顶栏「日记」） | 写日记 → 先过 R9 安全扫描 → 提炼事件/情绪/愿望 → 生成人格卡预览 |

对话页顶栏有状态徽章「人格卡：问卷已填｜日记 N 篇」；设置抽屉里能直接查看**两个分身各自拿到的材料**。

### 9.2 日记写入的三道关

1. **R9 入库扫描**：命中危机词（如「不想活」「结束这一切」）的日记整条**不提炼**，只安全留档，
   页面给出 12356 话术，**绝不进分身素材库**。
2. **R10 高痛苦条目**：只提炼心态，不复述原话（列表里标「高痛苦（R10）」）。
3. **去重**：同日期 + 同正文的日记不会重复入库。

### 9.3 人格卡怎么进 prompt

`web/persona-card.js` 把提炼结果压成一份卡片（P3 Schema）：

- `past_self`：`frozen_date`（冻结日 = 最近一篇可用日记的日期）、昵称、心态摘要（≤200 字）、关键事件、未解困扰、说话风格。
- `future_self`：昵称、梦想目标、价值观、回望叙事、鼓励风格、第一小步库。
- 另带 `stats` 与 `evidence`，每条素材都能追回出处。

`web/personas.js` 的两个分身 prompt 里本来就留了 `{{PERSONA_CARD}}` 注入位，`persona-card.js` 会把它替换成
该分身该看的那一块；**没有任何材料时注入空态块**，明确写「不要编造用户的事件、记忆或目标」。
每次问卷/日记变化都会重算并同步进分身的 `history[0]`，聊天页立刻生效。

> 默认提炼是**本地规则版**（离线可用，来源标 `local-rule`）。已接通后端模型时，可在日记页点
> 「用后端模型重新提炼」，让模型按同一 Schema 重做，来源改标 `backend-llm`。

### 9.4 数据落在哪

- 浏览器 `localStorage`：`demo.survey.v1`、`demo.diary.v1`、`demo.personaCard.v1`。
- 服务端镜像：`POST /api/survey`、`POST /api/diary`、`POST /api/persona-card` 写到 `demo/data/`；
  接口读回 `GET /api/survey`、`GET /api/diary`、`GET /api/persona-card`，换浏览器/换机器也能接着用。
- **提交给主办方的镜像里不含 `demo/data/` 中的个人数据**。

对应测试：`node tests/run-tests.mjs --suite card`（18 项：P1–P4 + R9/R10）。

---

## 十、答辩/演示建议流程

1. 提前 5 分钟双击 `启动Demo.bat`，确认页面能打开、状态显示「后端已连接」（没连上也会自动走演示模式）。
2. 打开 `http://127.0.0.1:8090/?demo=1`，让自动演示跑一遍，观众先看到完整效果。
3. 手动输入一句现场想好的心事，展示两个分身的差异：左边接住情绪、右边给这周的一小步。
4. 打开 `?demo=safety` 演示红线前置拦截：危机信号直接给 12356 与校心理中心，不进角色化回应。
5. 顶栏点「问卷」填一份（约 30 秒），再点「日记」写一篇，回对话页看徽章变成「问卷已填｜日记 N 篇」——
   说明两个分身的素材来自用户自己填写的问卷与日记，而不是凭空演。
6. 收尾打开 `/assets/contact-sheet.html`（或 `assets/形象素材总览.png`），说明情绪联动是
   「同一套 16 类标签同时驱动表情、日志与初赛字段」。

---

## 十一、已经验证过 / 还没做

已验证：双分身并排渲染、自动演示完整流程、流式逐字显示、16 类情绪标签与表情映射、
安全红线四级拦截（含 URL 演示）、知识库检索增强注入、结构化日志读写、
问卷页与日记页、人格卡提炼与注入（P1–P4 + R9/R10，测试 18/18 通过）、
测试执行器与报告产出、形象素材批量导出与在线总览。

本阶段刻意简化或未做：语音 TTS（口型目前由文字节奏驱动，已预留 `setAudioLevel` 接口）、
历史会话持久化、移动端适配。形象是简易卡通矢量风格，符合本阶段「次要 UI 效果先简化」的定位。

---

## 十二、让服务一直开着（开机自启 + 崩溃自动重启）

默认情况下服务是「手动启动、关掉窗口就停」。想让它常驻，本仓库带了三个脚本：

| 文件 | 作用 |
| --- | --- |
| `服务器常驻.vbs` | 隐藏窗口启动（不弹黑色命令行窗口） |
| `服务器常驻.bat` | 真正的守护：先探测 8090 有没有服务；没有就启动 `node server.mjs`，**退出或崩溃后 5 秒自动重启** |
| `停止常驻.bat` | 一键停止守护和 node 服务（双击即可，不用管隐藏的窗口） |

**平时怎么用**：双击 `服务器常驻.vbs` 让它常驻后台；要关掉就双击 `停止常驻.bat`。

**开机自动启动**：已注册 Windows 计划任务 `DigitalHumanDemoServer`（登录后延迟 20 秒启动，可在「任务计划程序」里看到）。

```powershell
schtasks /query  /tn DigitalHumanDemoServer                            # 查看状态
Start-ScheduledTask -TaskName DigitalHumanDemoServer                   # 手动拉起
schtasks /delete /tn DigitalHumanDemoServer /f                        # 取消开机自启
```

几个要知道的边界：

- 只有**电脑开着并且你已登录**时服务才在；关机、睡眠期间访问会失败。
- 默认只监听 `127.0.0.1`，**只有本机能访问**。要让同一局域网的队友打开（`http://你的局域网IP:8090`），需要用 `DEMO_HOST=0.0.0.0` 启动并放行防火墙 8090 端口。
- 想让外网也能访问，得用内网穿透或云服务器；临时演示建议用 GitHub Codespaces（见根目录 README）。

---

## 十三、服务打不开时怎么排查

这个 Demo 是**手动启动的本地服务**，不会自己常驻：关掉那个黑色命令行窗口、注销或重启电脑，服务就停了，
浏览器再打开 `http://127.0.0.1:8090` 就会提示「拒绝连接」。

1. **先确认服务还在不在**：浏览器打开 `http://127.0.0.1:8090/api/health`。
   能看到一段 JSON（含有 `"backend"`）说明服务活着；提示拒绝连接说明服务停了，做第 2 步。
2. **重新启动**：双击 `启动Demo.bat`，窗口里出现 `Dual-Self Chat Demo is running` 即成功。演示期间不要关这个窗口。
3. **提示端口被占用**（`Port 8090 is already in use`）：已经有一个 Demo 在跑，直接打开地址即可；
   要重启就先关掉之前那个命令行窗口。
4. **提示没有找到 node**：到 https://nodejs.org 装 LTS 版，装完重新双击。
5. **想换端口**：改 `config.json` 的 `port`，重启后浏览器地址里的端口一起改。

其他常见情况：

**一直显示「后端未连接」**：后端模型没启动或 `baseUrl` 写错。不影响演示，页面会自动走演示模式，
也可以把 `mode` 改成 `mock` 固定用预置文案。
**回复没有表情变化**：检查后端有没有按第三节的口径返回情绪字段或首行标签。
**口型不动**：确认回复是流式的；非流式返回会整段显示，口型只在文字逐字出现时联动。
**命令窗口中文乱码**：`启动Demo.bat` 按 GBK 保存并已实测正常；服务自身输出刻意用英文。
**看到「知识库：未加载」**：执行 `node knowledge/build-kit.mjs` 生成 `knowledge/prompt-kit.json` 后重启服务。