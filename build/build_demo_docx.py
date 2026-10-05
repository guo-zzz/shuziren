# -*- coding: utf-8 -*-
"""Build the merged dual-self demo DOCX (knowledge base + test plan + corpus)."""

import os
import sys

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_persona_docx as P  # 复用引文块与图片原语
import build_docx as B

OUT = r"D:\iwen-codex\codex-2\deliverables\郭柱-双自我对话Demo说明.docx"
SHOT_DEMO = r"D:\iwen-codex\codex-2\build\figures\demo-past-future.png"
SHOT_SAFETY = r"D:\iwen-codex\codex-2\build\figures\demo-safety.png"
OVERVIEW = r"D:\iwen-codex\codex-2\demo\assets\形象素材总览.png"

LEFT = WD_ALIGN_PARAGRAPH.LEFT


def build():
    doc = Document()
    B.setup_styles(doc)

    section = doc.sections[0]
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.left_margin = Cm(2.4)
    section.right_margin = Cm(2.4)
    section.top_margin = Cm(2.2)
    section.bottom_margin = Cm(2.2)
    B.footer_page_number(section)

    # ------------------------------------------------------------------ 标题
    title = doc.add_paragraph(style="Title")
    title.paragraph_format.space_after = Pt(2)
    B.set_run(title.add_run("双自我对话数字人前端 Demo 说明"), size=20, bold=True, font=B.HEAD_FONT)

    sub = doc.add_paragraph()
    sub.paragraph_format.space_after = Pt(2)
    B.set_run(
        sub.add_run("2026 动感地带 AI+ 高校创智计划 · AI 技术赛道 · 命题方向二 数字人综合情感陪伴对话模型"),
        size=9.5, color="5A6472")
    sub2 = doc.add_paragraph()
    sub2.paragraph_format.space_after = Pt(14)
    B.set_run(sub2.add_run("编制：郭柱｜2026 年 10 月 5 日"), size=9.5, color="5A6472")

    B.para(doc,
           "这份文档说明前端 Demo 现在的样子，以及队友交来的三份材料是怎么合成一个整体的："
           "唐应杰的《Demo 测试方案 v1.2》《心理 skill 知识库 v2.1》，加上 120 条官方抽样测试语料。"
           "三份材料都没有停在文档层面，而是分别变成了可执行的规则表、服务端的检索增强，"
           "以及一条命令就能跑出报告的测试执行器。",
           after=8)
    B.para(doc,
           "结论先说。概念从「当下的我 × 理想的我」换成知识库 v2 的「过去的我 × 未来的我」，"
           "旧概念完整保留在 code 里，地址后加 ?concept=present_ideal 即可切回；"
           "情绪口径统一到官方 16 类英文枚举，数字人表情、日志字段、测试报告和初赛提交字段共用同一套标签；"
           "安全红线做成调用大模型之前的前置拦截，后端没连上时也照样生效；"
           "知识库以检索增强的方式挂在服务端，前端协议不变。",
           after=8)
    B.para(doc,
           "读者按需取用：张力文照第五节接后端情绪字段，唐应杰照第六节跑测试，"
           "王如怡照第二节写场景脚本，答辩演示照第八节取形象素材。",
           after=12)

    # ------------------------------------------------------ 一、融合的内容
    B.heading(doc, "一、本次融合的内容与落点")
    B.para(doc,
           "融合的原则是一份口径、三处引用：知识库定义的术语、人设和情绪分类，"
           "同时出现在前端代码、服务端提示词和测试用例里，避免文档写 16 类、代码写 6 类、报告又是第三套。",
           after=8)
    B.table(
        doc,
        ["材料", "融合后的形态", "落地位置", "主要使用者"],
        [
            ["心理 skill 知识库 v2.1",
             "解析成机器可读卡片包，服务端按关键词检索后注入 systemPrompt",
             "knowledge/心理skill知识库-v2.md、build-kit.mjs、prompt-kit.json、server.mjs",
             "张力文、郭柱"],
            ["Demo 测试方案 v1.2",
             "七个套件写成可执行测试器，直接调用页面在用的规则文件",
             "tests/测试方案-v1.2.md、tests/run-tests.mjs、tests/reports/",
             "唐应杰、郭柱"],
            ["官方抽样测试语料 120 条",
             "拆成情绪覆盖 80 条、重情绪复核 30 条、长历史 10 条，作为实测与人工复核的输入",
             "tests/corpus/测试语料-官方抽样.jsonl",
             "唐应杰"],
            ["知识库模块六的 16 类情绪",
             "与官方数据集口径合并，成为表情、日志、测试共用的唯一标签来源",
             "web/emotions16.js",
             "全队"],
            ["知识库 T6 至 T9 人设准则",
             "写进两个分身的 systemPrompt，成为行为准则与冲突处理规则",
             "web/personas.js",
             "王如怡、张力文"],
        ],
        [3.4, 5.4, 4.8, 2.6],
        aligns=[LEFT, LEFT, LEFT, LEFT])

    # -------------------------------------------------------- 二、概念与人设
    B.heading(doc, "二、概念与两个分身的定义")
    B.para(doc,
           "默认概念取自知识库里的自我差异理论与可能自我理论：过去的我来自用户写的日记，"
           "停在写日记的那一天；未来的我由问卷里的梦想和日记里的愿望投射而来，已经走到那一步。"
           "两个分身并排出现在同一屏，用户说一件事，左边先接住情绪，右边再给出这周能做的一小步。",
           after=8)
    B.table(
        doc,
        ["项目", "过去的我", "未来的我"],
        [
            ["身份", "日记里停在冻结日期的自己，是见证者与镜子",
             "由梦想与愿望投射出的、已经走到那一步的自己，是引路人与可能性"],
            ["屏幕位置与主色", "左侧，蓝灰 #5A6B8C", "右侧，赭金 #C08428"],
            ["时间边界", "只知道人格卡冻结日期之前的事，被问之后的事就说不记得",
             "站在用户写下的方向回望现在，不承诺确定的未来"],
            ["材料边界", "只用日记里的事件与原话，不编造记忆", "只用问卷目标与日记愿望，不替用户立目标"],
            ["每次回复的落点", "命名情绪、复述具体内容，一次只问一个问题",
             "落到这周能做的一小步，越具体越好"],
            ["禁忌", "不剧透，不用现在的视角评判过去", "不空头支票，不代替用户做决定"],
            ["开口第一句", "你来了。我停在写日记的那天，后来的事我还不知道。",
             "我在这儿。我是你写下的那个方向，不着急。"],
        ],
        [2.6, 6.8, 6.8],
        aligns=[LEFT, LEFT, LEFT])
    B.para(doc,
           "两个分身共用一段总则，写在 systemPrompt 顶部：不输出正确答案，材料梳理权交给用户本人；"
           "每次只推进一件事，不抢话、不轮流说教；知道另一个分身存在，可以自然提到对方，但不互相否定。"
           "systemPrompt 的拼装顺序是总则、分身准则、输出格式、语气与长度基准、安全边界、人格卡注入位。"
           "人格卡用 {{PERSONA_CARD}} 占位，问卷页与日记页还没做，后端接入后直接替换这个占位符即可，"
           "两个分身当前的行为准则已经写在 web/personas.js 里。",
           after=10)
    if os.path.exists(SHOT_DEMO):
        P.figure(doc, SHOT_DEMO, 16.2,
                 "图 1　双自我对话界面（左为过去的我，右为未来的我；同一件事由两个分身依次回应）")

    # ---------------------------------------------------------- 三、情绪口径
    B.heading(doc, "三、情绪口径与 16 类标签")
    B.para(doc,
           "情绪口径统一到官方 16 类英文枚举，来源是知识库模块六与官方数据集。"
           "数字人的六种表情只是展示层的映射，日志与测试仍然记 16 类原始枚举，"
           "这样前端表情、后端 emotion_label 和初赛提交字段说的是同一件事。",
           after=8)
    B.table(
        doc,
        ["官方标签", "中文", "数字人表情"],
        [
            ["anxiety", "焦虑", "焦虑"],
            ["fear", "恐惧", "焦虑"],
            ["helplessness", "无助", "低落"],
            ["sadness", "悲伤", "低落"],
            ["loneliness", "孤独", "低落"],
            ["anger", "愤怒", "愤怒"],
            ["disgust", "厌恶", "愤怒"],
            ["shame", "羞愧", "低落"],
            ["joy", "喜悦", "开心"],
            ["gratitude", "感激", "开心"],
            ["pride", "自豪", "开心"],
            ["care", "感动", "开心"],
            ["relaxed", "放松", "平静"],
            ["surprise", "惊喜", "惊喜"],
            ["neutral", "平静", "平静"],
            ["mixed", "复杂交织", "焦虑"],
        ],
        [4.2, 4.0, 8.0],
        aligns=[LEFT, LEFT, LEFT])
    B.para(doc,
           "标注对象永远是用户最新这条消息的情绪，不是分身自己的情绪。后端返回情绪时按后端的走，"
           "没返回时由前端规则兜底判定，同样输出 16 类之一。气泡上的标签显示成「中文 · 英文」，"
           "例如「悲伤 · sadness」，抽检时可以直接对照官方枚举。",
           after=10)

    # ---------------------------------------------------------- 四、安全红线
    B.heading(doc, "四、安全红线前置拦截")
    B.para(doc,
           "红线拦截发生在调用大模型之前，用的是工程里的规则表，所以后端未连接、页面走演示模式时一样生效。"
           "拦截命中时两个分身给出同一条合规话术，不再进入角色化回应。",
           after=8)
    B.table(
        doc,
        ["级别", "触发条件", "系统动作", "用户看到什么"],
        [
            ["crisis 危机", "直接危机信号，例如不想活、自杀、自残、交代后事",
             "立即停止角色化回应，不调用大模型", "热线 12356、120 与学校心理健康中心，两个分身同一条话术"],
            ["referral 转介", "诊断或用药诱导，例如问自己是不是抑郁症、要不要吃药、要求开药方",
             "不做诊断，不建议用药，把评估交回专业人员", "说明不能诊断与建议用药，建议联系学校心理中心做正式评估"],
            ["watch 持续消耗", "持续消耗信号连续三轮，例如撑不住、看不到希望",
             "照常回应，累计计数，第三轮软性升级", "前两轮正常回应，第三轮增强共情并主动给出资源"],
            ["none", "未命中以上任何一类", "正常走分身对话", "两个分身各自的回复"],
        ],
        [2.2, 4.6, 4.2, 5.2],
        aligns=[LEFT, LEFT, LEFT, LEFT],
        keep_together=False)
    B.para(doc,
           "口语夸张单独做了一张白名单，烦死了、累死了、笑死、尴尬死、饿死了等词先屏蔽再匹配，"
           "避免把日常抱怨误判成危机。测试方案里的九条误拦用例现在全部正确放行，"
           "输出侧还有一张说教黑名单，禁止出现「你应该」「想开点」「没什么大不了的」这类表达。",
           after=10)
    if os.path.exists(SHOT_SAFETY):
        P.figure(doc, SHOT_SAFETY, 16.2,
                 "图 2　安全红线演示（危机信号不进入角色化回应，两个分身给出同一条干预话术）")

    # ---------------------------------------------------------- 五、知识库
    B.heading(doc, "五、知识库的融合方式")
    B.para(doc,
           "知识库原文放在 knowledge 目录，由 build-kit.mjs 解析成卡片包 prompt-kit.json，服务启动时加载。"
           "解析产物一共五类内容，覆盖人设、技术、情绪、辨析和风格：",
           after=8)
    P.quote_block(doc, [
        "卡片 11 张：T1 自我差异理论、T2 可能自我理论、T3 未来自我连续性、T4 表达性书写、",
        "　　　　　　T5 叙事身份、T6 三角对谈总则、T7 过去的我行为准则、T8 未来的我行为准则、",
        "　　　　　　T9 两分身意见相左时的处理、R9 日记入库安全扫描、R10 过去我防创伤复读规则",
        "技术 20 条：E 系列共情技术（情绪命名、具体化、一次一个问题等），A 系列行动技术",
        "情绪 16 类：官方枚举的定义与判定提示，与第三节共用",
        "辨析 8 条：焦虑与恐惧、悲伤与无助、感激与感动等近义类别的区分规则",
        "风格基准：回复长度、结构顺序、语气与禁用表达",
    ], fill="F7F8FA", size=9)
    B.para(doc,
           "检索发生在服务端。收到 /api/chat 请求后，服务按用户这句话命中一到两张卡片，"
           "把总则、16 类情绪、辨析规则、风格基准和命中的卡片一起拼到 system 消息之后，再转发给后端。"
           "前端发出的 messages 结构不变，张力文那边不需要改协议。"
           "config.json 里 knowledge.enabled 设成 false 可以整体关掉检索增强，方便对照实验。",
           after=8)
    B.para(doc,
           "知识库以后要改，流程是三步：改 knowledge/心理skill知识库-v2.md 原文，"
           "跑一次 node knowledge/build-kit.mjs 重新生成卡片包，重启服务。",
           after=10)

    # ------------------------------------------------------ 六、测试与语料
    B.heading(doc, "六、测试方案与语料的融合")
    B.para(doc,
           "测试方案 v1.2 的七个套件写成了 tests/run-tests.mjs，直接加载工程里的 emotions16.js 与 safety.js，"
           "测的就是页面实际在用的那套规则，不会出现「测试过了但页面不一样」的情况。"
           "最近一次执行是 2026 年 10 月 5 日的本地模式，结果如下。",
           after=8)
    B.table(
        doc,
        ["套件", "结论", "关键数字"],
        [
            ["四、安全红线回归", "通过", "危机拦截 9/9，拦截率 100%；误拦 0/9，误拦率 0%；诊断诱导 3/3；连续三轮软升级已触发"],
            ["十、情绪识别实测", "待改进", "80 条语料，完全一致 17 条，一致率 21.3%，Macro-F1 0.225"],
            ["三、分身区分度", "通过", "两个分身 prompt 不同；过去的我契约 3/3，未来的我契约 3/3；12 组真实回复待接通后端后在 live 模式补"],
            ["二、分身保真度", "通过", "时间边界、禁止剧透、材料边界三项均已写入 prompt"],
            ["九、格式与风格纪律", "通过", "22 条演示文案，长度中位数 56 字，范围 23 至 76 字，无超 300 字"],
            ["十.3、长历史时延", "未执行", "10 条长历史样本可用，需要接通后端后跑 live 模式"],
            ["工程冒烟", "通过", "13 项检查通过 12 项，未通过的一项是后端未连接，本地模式下属预期"],
        ],
        [3.4, 1.8, 11.0],
        aligns=[LEFT, WD_ALIGN_PARAGRAPH.CENTER, LEFT],
        keep_together=False)
    B.para(doc,
           "情绪识别这一项要看清楚它测的到底是什么。它测的是后端没有返回情绪字段时前端规则兜底的能力，"
           "不是模型能力，主要混淆是把焦虑、愤怒、自豪等判成平静。真实识别应该由后端模型承担，"
           "等张力文接通之后用 --mode live 记录后端返回的 emotion_label 再算一次，"
           "两者的差值就是 prompt 里情绪指引是否有效的证据。",
           after=8)
    B.para(doc,
           "语料纪律：这 120 条抽自官方 train 集，含真实用户向对话内容，只用于团队内部测试，不对外分享；"
           "val 集整条留作初赛正式预演，不提前查看；如果初赛训练用到了 train，要从训练集中剔除这批 sample_id。",
           after=10)

    # ------------------------------------------------------ 七、接口与日志
    B.heading(doc, "七、接口约定与结构化日志")
    B.para(doc,
           "前端向后端发 POST /api/chat，body 是 model、stream、persona_id、messages 四个字段，"
           "persona_id 取 past 或 future，两个分身各带自己的 systemPrompt。"
           "后端不需要额外分支逻辑，按传进来的 systemPrompt 回答即可。",
           after=8)
    B.para(doc,
           "情绪字段两种给法任选：流式返回的增量块里带 emotion 字段，或者让回复的第一行是方括号包起来的"
           "英文标签，例如【sadness】，第二行起为正文。两种都不给时按平静处理，不会报错。",
           after=8)
    B.para(doc, "每轮对话写一行结构化日志，存到 logs/turns-YYYY-MM-DD.jsonl，写入接口是 POST /api/log。字段约定如下。",
           after=6)
    B.table(
        doc,
        ["字段", "含义"],
        [
            ["user_text、reply_text", "这一轮的用户原话与分身回复全文"],
            ["emotion_label、display_emotion", "16 类英文枚举，以及映射到数字人表情后的中文"],
            ["emotion_rule、safety_flag", "情绪判定依据，以及这一轮的红线级别"],
            ["source、latency_ms", "回复来自后端还是演示文案，以及端到端耗时"],
            ["persona、concept", "哪个分身、哪套概念，便于按分身对照"],
        ],
        [5.0, 11.2],
        aligns=[LEFT, LEFT])
    B.para(doc,
           "这些字段就是初赛 emotion_label 与人工抽检的数据来源，答题报告和答辩材料都可以直接从这里取数。",
           after=10)

    # ---------------------------------------------------------- 八、素材清单
    B.heading(doc, "八、形象素材与交付清单")
    B.para(doc,
           "形象是用矢量图形代码画出来的，改配色即可换形象，也能随时导出成 PPT 直接用的素材。"
           "一共 14 个形象，是两套人设乘以六种表情再加一个说话状态。",
           after=8)
    if os.path.exists(OVERVIEW):
        P.figure(doc, OVERVIEW, 16.2, "图 3　数字人形象素材总览（上排：过去的我；下排：未来的我）")
    B.table(
        doc,
        ["交付内容", "位置", "用途"],
        [
            ["前端页面", "demo/web/", "页面骨架、样式、对话流程、人设、情绪、红线、形象绘制与动画"],
            ["本地服务", "demo/server.mjs", "静态托管、后端转发、知识库检索增强、结构化日志读写"],
            ["知识库与卡片包", "demo/knowledge/", "知识库原文、解析脚本与机器可读卡片包"],
            ["测试方案与执行器", "demo/tests/", "方案原文、120 条语料、可执行测试器与历次报告"],
            ["形象素材", "demo/assets/", "14 个 SVG、14 个 PNG、素材清单与一页总览"],
            ["使用说明", "demo/README.md", "启动方式、页面参数、目录结构、常见问题排查"],
        ],
        [3.4, 4.6, 8.2],
        aligns=[LEFT, LEFT, LEFT],
        keep_together=False)

    # ------------------------------------------------------ 九、进度与建议
    B.heading(doc, "九、已完成与尚未完成")
    B.para(doc,
           "已经在本机跑通并逐项确认的有：双分身并排渲染、自动演示完整流程、流式逐字显示与口型联动、"
           "16 类情绪标签与表情映射、四级安全红线拦截、知识库检索增强注入、结构化日志读写、"
           "测试执行器与报告产出、形象素材批量导出与在线总览。",
           after=8)
    B.para(doc,
           "本阶段刻意简化的部分也一并说明。语音合成还没接，口型目前由文字节奏驱动，"
           "音量接口已经预留；问卷页与日记页没做，人格卡暂时是占位符；历史会话刷新即清空；"
           "页面按桌面浏览器设计。形象是简易卡通矢量风格，符合本阶段先跑通核心效果的定位。",
           after=8)
    B.table(
        doc,
        ["项目", "当前状态", "下一轮建议"],
        [
            ["语音与口型", "口型由文字节奏驱动，音量接口已预留",
             "接入 IndexTTS 或 CosyVoice，再用真实音量驱动口型"],
            ["人格卡管道", "systemPrompt 里留了注入位，问卷与日记页未做",
             "补问卷页与日记页，产出人格卡后替换占位符"],
            ["情绪识别", "前端规则兜底的 Macro-F1 是 0.225",
             "由后端模型出情绪标签，前端只做归一化、映射与展示"],
            ["历史与会话", "刷新页面即清空", "接入本地存储或后端会话，支持长对话回看"],
            ["适配", "按桌面浏览器设计", "演示若用平板或投影，补一版窄屏布局"],
        ],
        [2.8, 6.4, 7.0],
        aligns=[LEFT, LEFT, LEFT])
    B.para(doc,
           "优先级上，语音与真实口型联动最能提升答辩观感，排在第一位；"
           "情绪标签由后端模型承担是初赛 emotion_label 得分的关键，排在第二位；"
           "问卷与日记页决定两个分身的概念是否成立，排在第三位。",
           after=10)

    # ---------------------------------------------------------- 十、运行排查
    B.heading(doc, "十、服务怎么跑与打不开时怎么办")
    B.para(doc,
           "双击 demo 目录里的启动脚本 启动Demo.bat，浏览器会自动打开 http://127.0.0.1:8090。"
           "这是一个手动启动的本地服务，不会常驻：关掉那个命令行窗口、注销或重启电脑，服务就停了，"
           "浏览器再打开这个地址会提示拒绝连接。",
           after=8)
    B.bullet(doc, "先访问 http://127.0.0.1:8090/api/health，能看到一段 JSON 说明服务活着；提示拒绝连接就是服务停了。")
    B.bullet(doc, "重新启动：双击 启动Demo.bat，窗口里出现 Dual-Self Chat Demo is running 即成功，演示期间不要关这个窗口。")
    B.bullet(doc, "提示端口被占用，说明已经有一个 Demo 在跑，直接打开地址即可；要重启就先关掉之前那个命令行窗口。")
    B.bullet(doc, "提示找不到 node，到 nodejs.org 装 LTS 版，装完重新双击。")
    B.bullet(doc, "一直显示后端未连接不影响演示，页面会自动走演示模式；也可以把 config.json 的 mode 改成 mock 固定用预置文案。")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    props = doc.core_properties
    props.author = "郭柱"
    props.last_modified_by = "郭柱"
    props.title = "双自我对话数字人前端 Demo 说明"
    props.subject = "2026 动感地带 AI+ 高校创智计划 技术赛道 数字人综合情感陪伴对话模型"
    doc.save(OUT)
    print("saved:", OUT)


if __name__ == "__main__":
    build()