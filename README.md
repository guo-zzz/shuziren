# 数字人综合情感陪伴对话 Demo — 团队协作仓库

2026 动感地带 AI+ 高校创智计划 · AI 技术赛道｜命题方向二：数字人综合情感陪伴对话模型

分工：郭柱（数字人前端交互 Demo）｜张力文（后端大模型 + Skill 知识库）｜
唐应杰（知识库整理 + Demo 测试）｜王如怡（场景脚本）｜邹艾融（统筹）

> **本仓库请保持私有（private）。** 里面有竞赛内部资料（知识库原文、测试口径），
> 不要改成公开仓库，也不要把链接发到群里之外的地方。

## 目录

| 路径 | 说明 |
| --- | --- |
| `demo/` | 可运行的数字人 Demo（零依赖 Node 服务 + 原生前端），细节看 `demo/README.md` |
| `build/` | 生成说明文档（Word/PDF）的 Python 脚本与配图 |
| `deliverables/` | 交付成品（说明文档、调研笔记；工程包 zip 不入库，按需重新打包） |

## 30 秒跑起来

1. 装 Node LTS：https://nodejs.org
2. 进 `demo/` 双击 `启动Demo.bat`（或命令行 `node server.mjs`）
3. 浏览器打开 http://127.0.0.1:8090

功能说明、接口约定、测试命令、常见故障，全部写在 [demo/README.md](demo/README.md)。

## 一起改的流程

```bash
git clone <仓库地址>
cd <仓库目录>

# 方式一（推荐）：每人开自己的分支，改完发起合并请求
git checkout -b 你的分支名
# ……改代码……
git add -A
git commit -m "说明你改了什么"
git pull --rebase
git push -u origin 你的分支名
# 然后在网页上发起 Pull Request，由郭柱合并

# 方式二（小改动、图省事）：直接推 main
git pull
# ……改代码……
git add -A && git commit -m "说明你改了什么" && git push
```

**改完记得跑一遍自检**：

```bash
cd demo
node tests/run-tests.mjs
```

## 仓库里没有的东西（需要单独拿）

| 文件 | 为什么不在仓库里 | 怎么补 |
| --- | --- | --- |
| `demo/tests/corpus/测试语料-官方抽样.jsonl` | 官方抽样语料，**禁止外传**，不进协作仓库 | 由唐应杰单独发给要跑测试的人，放回原路径 |
| `demo/logs/`、`demo/data/` | 运行日志 + 个人问卷/日记数据 | 运行服务时自动生成；**不要提交个人数据** |
| `deliverables/*.zip` | 可重新打包生成 | 需要提交时按 `demo/README.md` 的排除规则重新打包 |

## 两条容易踩的坑

- 工程文件**混用 CRLF/LF**：`app.js` 是 CRLF，其余多为 LF。仓库已设成不做换行符转换
  （`.gitattributes` 里 `* -text`），请保持原样；`启动Demo.bat` 是 GBK+CRLF，别用编辑器另存成 UTF-8。
- 改 `demo/web/*.js` 做字符串替换时，先确认目标文件的换行符，否则替换会静默失败。