---
name: tutor-workbench
description: 家教老师 AI 工作台的数据读写与备课生成。当用户提到「家教工作台」「某个学生的学情分析 / 课前习题 / 教案 / 课后总结」「课次」「备课」「排期」，或当前工作空间存在 data/workbench.json 时使用本技能。
---

# 家教老师 AI 工作台 · Agent 操作手册

这个工作空间是一个**本地运行的网页工作台**，数据全部在一个 JSON 文件里。
Agent 的职责是：读上下文 → 生成高质量材料 → 写回去，用户在网页里立刻能看到。

## 一、数据在哪

```
数据/                      （相对工作空间根目录）
├── workbench.json         ← 唯一真相：{ rev, updatedAt, state }
├── secrets.json           ← API Key，禁止读取与写入
├── files/                 ← 上传的原始 PDF
└── workbench.backup-*.json
```

`state` 结构：

```jsonc
{
  "settings": { "theme": "light", "tutorName": "", "ai": { "mode": "builtin|agent", "baseUrl": "", "model": "" } },
  "students": [{
    "id": "stu_xxx", "name": "林小满", "createdAt": "ISO",
    "profile": { "grade": "初二", "school": "", "subjects": ["数学"], "progress": "",
                 "situation": "", "goal": "", "weakPoints": [], "habits": "",
                 "parentName": "", "parentPhone": "", "notes": "" },
    "logs": [{ "id": "", "date": "2026-10-29", "type": "家长沟通|课堂反馈", "content": "" }]
  }],
  "sessions": [{                       // 一个课次 = 课次看板的一列
    "id": "se_xxx", "studentId": "stu_xxx", "index": 3, "date": "2026-11-01",
    "topic": "一次函数的实际应用", "status": "planned|done",
    "artifacts": {
      "analysis": { "content": "Markdown", "updatedAt": "ISO", "source": "ai|agent|manual" },
      "prep":     { ... },   // 课前习题
      "plan":     { ... },   // 教案
      "summary":  { ... }    // 课后总结
    }
  }],
  "materials": [{ "id": "", "title": "", "subject": "", "grade": "", "text": "", "chunks": ["..."], "createdAt": "" }],
  "questions": [{ "id": "", "subject": "", "grade": "", "type": "选择|填空|解答", "difficulty": 1-5,
                  "stem": "Markdown", "answer": "", "analysis": "", "tags": [] }],
  "schedule": [{ "id": "", "studentId": "", "date": "2026-10-31", "start": "19:00", "end": "20:30",
                 "subject": "", "location": "", "status": "planned|done|canceled", "note": "" }]
}
```

## 二、优先用现成脚本，不要手改 JSON

```bash
S=.workbuddy/skills/tutor-workbench/scripts/tutor.mjs

node $S list                                     # 所有学生 + 课次 + 各栏完成情况
node $S context 林小满 3                          # 打印第 3 次课的完整上下文（档案/历史/教材片段/题库）
node $S write 林小满 3 plan --file /tmp/plan.md   # 写入教案（自动备份 + rev+1）
node $S write 林小满 3 prep --text "## 课前习题..."
node $S add-session 林小满 2026-11-08            # 新建课次

# 题库检索（多维度，与网页筛选同一套规则）
node $S questions --subject 数学 --stage 初中 --grade 初二 \
                   --type 解答,选择 --difficulty 1-3 --tag 一次函数,图像 \
                   --q 关键词 --student 林小满 --limit 10
node $S questions --subject 数学 --json          # 机器可读，含 code=Q12
```

脚本已经处理了：备份、原子写、`rev` 自增、`source: "agent"` 标记、课次不存在时自动创建。
**只有脚本做不到的批量改造（例如一次性重构多位学生档案）才手写 JSON**，并且必须先备份、保留所有既有字段。

### 题库的筛选维度

| 参数 | 取值 | 说明 |
| --- | --- | --- |
| `--subject` | 数学 / 英语 … | 精确匹配 `question.subject` |
| `--stage` | 小学 / 初中 / 高中 | 由年级推导（初二→初中，高一→高中） |
| `--grade` | 初二 … | 精确匹配年级 |
| `--type` | 选择 / 填空 / 解答 / 判断 / 实验 / 作文 / 其他 | 可逗号分隔多选（任一命中） |
| `--difficulty` | `3` 或 `1-3` | 单值精确，或区间 |
| `--tag` | 知识点标签 | 逗号分隔，命中任一即可 |
| `--q` | 关键词 | 题干/答案/解析/标签全文匹配 |
| `--student` | 学生姓名 | 不筛选，只按该生薄弱点/年级重排 |

网页端同一套规则：题库页的 学科 / 学习阶段 / 年级 / 题型 / 难度 / 知识点 六个筛选维度。
每题有稳定编号 `#Q12`（= 在 `state.questions` 中的序号），**AI 引用题目时必须用这个编号**，
写进 `prep` 时标注「改自题库 #Q12」。


## 三、标准工作流

用户说「给林小满备下次课」时：

1. `node $S list` 找到学生与未完成课次（`status: planned`）。
2. `node $S context <姓名> <课次序号>` 拿到全部上下文——**这就是唯一可信的事实来源**，不要凭空补充学生信息。
3. 按下面的结构写四份材料（可只写用户要的那几份），落到 `/tmp/*.md`。
4. `node $S write ...` 逐份写入。
5. 告诉用户：已写入哪些栏目、工作台 5 秒内自动刷新（若未刷新，让用户切回窗口或按 F5）。

如果用户只要「看一下」而不改数据，用 `context` 输出即可，**不要写文件**。

## 四、四类材料的写法

所有内容都是 **Markdown**，公式用 `$...$` / `$$...$$`。写入的是正文，不要带任何"以下是…"的前言。
篇幅：学情分析 600-900 字；课前习题 4-6 题；教案不限但要能照着上；课后总结 400-700 字。

### analysis（课前学情分析）
```
## 一、上次课掌握情况      ← 引用上次课的 summary/analysis，指出具体知识点掌握程度
## 二、本次课起点诊断      ← 现有基础能支撑什么、会卡在哪，给判断依据
## 三、本次课教学切入点    ← 一句话主线 + 3 条具体做法
## 四、需要重点关注        ← 2-3 条，含错误类型与应对
## 五、建议的课堂节奏      ← 表格：环节 / 时长 / 要点
```

### prep（课前习题）
`## 课前习题` 开头，4-6 题由易到难，覆盖上次课薄弱点 + 本次课前置知识；每题标【难度★】；
先题干，最后 `## 参考答案与思路` 统一给答案与一句话思路。
**优先改编题库里的题**，并在该题末尾单独一行写（改自题库 #Q12）——
编号来自 `questions` 或 `context` 的输出，格式必须是 `#Q数字`：工作台会把这种写法渲染成可点击的回查入口，
点开直接看原题、答案与解析。写「第 2 题」这类位置说法在网页里只能按序号猜，可能指错题。

### plan（教案）
```
## 一、教学目标          （知识/能力/习惯，可检测）
## 二、重难点            （各 2 条，配突破策略）
## 三、教学流程          （表格：时间/环节/教师动作/学生活动/预期产出，按 90 分钟）
## 四、例题与讲解脚本    （2-3 道，含关键提问、板书要点、易错提醒）
## 五、课堂检测          （3 道，附答案）
## 六、分层作业          （基础/提升/挑战）
```

### summary（课后总结）
```
## 一、本次课内容        ## 二、学生课堂表现
## 三、掌握情况评估（表格：知识点/掌握程度/证据）
## 四、存在的问题        ## 五、下次课计划
## 六、给家长的一句话（≤60 字，正向可执行，不要营销腔）
```

## 五、铁律

1. **绝不改** `settings`、`secrets.json`、`files/`。
2. 写回时 `rev` 必须 +1（脚本已处理），否则网页不会刷新。
3. 只增改目标字段，**保留** `artifacts` 里的其他栏目、`id`、`createdAt`。
4. `index` 是课次序号，从 1 开始、连续；删除课次后不要自动重排（会让历史记录错位）。
5. 日期一律 `YYYY-MM-DD`，时间 `HH:mm`。
6. 事实只能来自 `context` 输出或用户口述。**不要编造**学生的成绩、家长的话、教材内容。
7. 写之前先确认学生姓名唯一；重名时用 `id`。
8. 涉及删除数据（学生/课次/教材）时，先向用户确认，并提示可在网页「设置 → 导出数据」备份。

## 六、与网页内 AI 通道的关系

网页「设置 → AI 生成方式」有两个选项：
- `builtin`：网页自己调模型，结果 `source: "ai"`；
- `agent`：用户复制「任务包」给 Agent（也就是你），由你生成后写回，`source: "agent"`。

两条通道写同一份数据，**不要同时操作同一个课次的同一栏**。如果用户在网页里正开着抽屉编辑，
写回后网页可能提示"数据已被外部更新"——这是正常的乐观锁保护。
