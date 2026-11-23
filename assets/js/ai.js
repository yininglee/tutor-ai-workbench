/* =========================================================
   AI 层：上下文拼装 · 教材检索 · 生成 · Prompt 包导出
   ========================================================= */
(function () {
  const AI = {};

  const SYS_BASE = `你是一位有 10 年经验的一对一家教老师，擅长{SUBJECTS}，同时也是一名严谨的教研员。
你的输出会被直接放进家教工作台的文档里给老师使用，请遵守：
1. 只输出 Markdown 正文，不要开场白、不要"以下是"、不要整体代码块包裹；
2. 用二级标题（##）分节，需要时使用表格或有序列表；
3. 内容要具体、可执行，拒绝"要认真学习""多加练习"这类空话；
4. 数学/物理公式用 $...$ 行内、$$...$$ 独立成行（LaTeX 语法）；
5. 面向的对象是老师，可以直接写指令性语言。`;

  /* ---------- 教材检索 ---------- */
  function bigrams(s) {
    const t = String(s || '').replace(/[\s\p{P}]/gu, '').toLowerCase();
    const out = new Set();
    for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
    return out;
  }
  function overlap(aSet, text) {
    const b = bigrams(text);
    let n = 0;
    for (const g of aSet) if (b.has(g)) n++;
    return n;
  }

  AI.retrieveMaterial = (student, query, limit = 3) => {
    const subjects = (student?.profile?.subjects || []).map((s) => String(s).trim());
    const qset = bigrams(query);
    const scored = [];
    for (const m of Store.state.materials) {
      const chunks = (m.chunks && m.chunks.length ? m.chunks : U.chunk(m.text || '')) || [];
      const subjBias = subjects.some((s) => s && (m.subject || '').includes(s)) ? 40 : 0;
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        let s = overlap(qset, c) + subjBias;
        if (!s) continue;
        if (i === 0) s += 3;
        scored.push({ s, text: c, title: m.title, subject: m.subject });
      }
    }
    scored.sort((a, b) => b.s - a.s);
    return scored.slice(0, limit);
  };

  /**
   * 选题：先用硬条件（学科/学段/年级/题型/难度/知识点）筛，再按学生画像排序
   * opts: { subject, stage, grade, type, type[] , diff, tags[], keyword, limit }
   */
  AI.pickQuestions = (student, opts = {}) => {
    const p = student?.profile || {};
    const soft = {
      grade: p.grade,
      subjects: (p.subjects || []).map((s) => String(s).trim()),
      weakPoints: p.weakPoints || [],
      weakText: `${(p.weakPoints || []).join(' ')} ${opts.keyword || ''}`,
      keyword: opts.keyword || '',
    };
    const base = {
      subject: opts.subject || '',
      stage: opts.stage || '',
      grade: opts.grade || '',
      type: opts.type || '',
      diff: opts.diff === '' || opts.diff == null ? '' : opts.diff,
      tags: Array.isArray(opts.tags) ? opts.tags : [],
      q: opts.keyword || '',
      limit: opts.limit || 8,
      soft,
    };
    let list = QB.search(base);
    // 条件过严导致没有结果时，退回到「只按学生画像排序」，保证备课不被卡住
    if (!list.length && (base.q || base.tags.length || base.type || base.grade || base.stage || base.subject)) {
      list = QB.search({
        limit: base.limit,
        soft: { ...soft, keyword: opts.keyword || '' },
      });
    }
    return list;
  };

  /* ---------- 上下文 ---------- */
  function profileBlock(st) {
    const p = st.profile || {};
    const rows = [
      ['姓名', st.name],
      ['年级', p.grade],
      ['学校', p.school],
      ['辅导科目', (p.subjects || []).join('、')],
      ['学习进度', p.progress],
      ['学习情况', p.situation],
      ['辅导目标', p.goal],
      ['薄弱点', (p.weakPoints || []).join('、')],
      ['学习习惯', p.habits],
      ['备注', p.notes],
    ].filter(([, v]) => v && String(v).trim());
    return rows.map(([k, v]) => `- ${k}：${String(v).trim()}`).join('\n');
  }

  function historyBlock(st, current) {
    const list = Store.sessionsOf(st.id).filter((s) => s.index < current.index && s.artifacts);
    const recent = list.slice(-3);
    if (!recent.length) return '（这是第一次课，没有历史记录）';
    return recent
      .map((s) => {
        const sum = s.artifacts.summary?.content || '';
        const an = s.artifacts.analysis?.content || '';
        const txt = (sum || an || '').replace(/[#*`>|-]/g, ' ').replace(/\s+/g, ' ').trim();
        return `- 第 ${s.index} 次课（${s.date}）${s.topic ? '主题：' + s.topic + '；' : ''}${
          txt ? '摘要：' + txt.slice(0, 260) : '无记录'
        }`;
      })
      .join('\n');
  }

  AI.buildContext = (st, session, kind, opts = {}) => {
    const quiz = opts.quiz || {};
    const parts = [];
    parts.push(`# 学生档案\n${profileBlock(st)}`);
    parts.push(
      `# 本次课\n- 第 ${session.index} 次课\n- 日期：${session.date}${
        session.topic ? `\n- 计划主题：${session.topic}` : ''
      }\n- 学科：${(st.profile?.subjects || []).join('、') || '未填写'}`
    );
    parts.push(`# 历史课次\n${historyBlock(st, session)}`);

    // 同一课次已生成的其他材料，保证前后一致
    const siblings = ARTIFACTS.filter((a) => a.key !== kind && session.artifacts?.[a.key]?.content);
    if (siblings.length) {
      parts.push(
        `# 本次课已生成的其他材料（保持衔接，不要重复）\n` +
          siblings
            .map((a) => `## ${a.label}\n${String(session.artifacts[a.key].content).slice(0, 1200)}`)
            .join('\n\n')
      );
    }

    const query = `${session.topic || ''} ${(st.profile?.weakPoints || []).join(' ')} ${(st.profile?.subjects || []).join(
      ' '
    )} ${quiz.keyword || ''} ${
      session.artifacts?.analysis?.content ? String(session.artifacts.analysis.content).slice(0, 200) : ''
    }`;
    const mats = AI.retrieveMaterial(st, query, 3);
    parts.push(
      `# 可参考教材片段（老师上传的教材，请优先与教材口径一致）\n` +
        (mats.length
          ? mats.map((m, i) => `【片段 ${i + 1} ·《${m.title}》】\n${m.text}`).join('\n\n')
          : '（题库/教材中暂无匹配内容，请依据通用课标口径撰写）')
    );

    if (kind === 'prep' || kind === 'plan') {
      const pref = [];
      if (quiz.grade) pref.push(`- 年级：${quiz.grade}`);
      if (quiz.type && (Array.isArray(quiz.type) ? quiz.type.length : quiz.type)) {
        pref.push(`- 题型：${Array.isArray(quiz.type) ? quiz.type.join('、') : quiz.type}`);
      }
      if (quiz.diff !== '' && quiz.diff != null) {
        const d = quiz.diff;
        pref.push(`- 难度：${Array.isArray(d) ? `${d[0]}-${d[1]}（1 最易 / 5 最难）` : d}`);
      }
      if (quiz.keyword) pref.push(`- 知识点关键词：${quiz.keyword}`);
      if (pref.length) parts.push(`# 老师指定的出题偏好（必须遵守）\n${pref.join('\n')}`);

      const qs = AI.pickQuestions(st, { ...quiz, limit: 8 });
      parts.push(
        `# 题库候选题目（已按上面的条件与学情筛过，可直接原题使用或改编）\n` +
          (qs.length
            ? qs.map((q) => `- ${QB.describe(q)}`).join('\n')
            : '（题库暂无匹配题目，请自行命题，不要编造题库编号）')
      );
    }
    return parts.join('\n\n');
  };

  const TASKS = {
    analysis: `请写这次课的《课前学情分析》，面向即将上课的老师。要求包含：
## 一、上次课掌握情况
（结合历史记录判断，指出具体知识点掌握到什么程度，不要泛泛而谈）
## 二、本次课起点诊断
（学生现有基础能支撑哪些内容、会在哪里卡住，给出判断依据）
## 三、本次课教学切入点
（一句话主线 + 3 条具体做法，要能直接照着上课）
## 四、需要重点关注
（2-3 条，含可能的错误类型与应对）
## 五、建议的课堂节奏
（用表格：环节 / 时长 / 要点）
篇幅 600-900 字。`,
    prep: `请出这次课的《课前习题》，用于上课前 10 分钟热身或上次课复盘。要求：
- 共 4-6 题，由易到难，覆盖上次课的薄弱点与本次课的前置知识；
- 题型搭配：至少 1 道基础计算、2 道典型题、1 道易错辨析；
- 题干用 Markdown 有序列表，每题标注【难度★】；
- 每题必须给出「参考答案」与「一句话思路」，放在文末"## 参考答案与思路"小节；
- 只要某题来自题库（原题或改编），必须在该题末尾单独一行写：（改自题库 #Q3），
  编号只能取自候选题目列表里的 #Q 编号，不要编造；这句会被工作台转成可点击的回查入口（点开即看原题与答案）；
开头用 "## 课前习题" 作标题，可加一行说明适用范围。`,
    plan: `请写这次课的《教案》，老师会照着上课。要求：
## 一、教学目标
（知识 / 能力 / 习惯，各 1-2 条，可检测）
## 二、重难点
（重点 2 条、难点 2 条，各配一句突破策略）
## 三、教学流程
（必须用表格：时间 / 环节 / 教师动作 / 学生活动 / 预期产出，总时长按 90 分钟安排）
## 四、例题与讲解脚本
（2-3 道，写出关键提问与板书要点，含易错提醒）
## 五、课堂检测
（3 道，附答案）
## 六、分层作业
（基础 / 提升 / 挑战三档，各 1-2 题）
篇幅不限，但必须具体到可以直接执行。`,
    summary: `请写这次课的《课后总结》，用于发给家长 + 归档。要求：
## 一、本次课内容
（3-5 条，写清讲到了什么）
## 二、学生课堂表现
（专注度、互动、书写规范，客观描述，有具体细节）
## 三、掌握情况评估
（用表格：知识点 / 掌握程度【熟练/基本掌握/待巩固】/ 证据）
## 四、存在的问题
（1-3 条，指出具体错误类型）
## 五、下次课计划
（3 条，要具体到知识点与题量）
## 六、给家长的一句话
（不超过 60 字，正向、可执行，不用营销腔）
篇幅 400-700 字。`,
  };

  AI.buildMessages = (st, session, kind, opts = {}) => {
    const subjects = (st.profile?.subjects || []).join('、') || '中学各科';
    const extra = String(opts.extra || '').trim();
    return [
      { role: 'system', content: SYS_BASE.replace('{SUBJECTS}', subjects) },
      {
        role: 'user',
        content: `${AI.buildContext(st, session, kind, opts)}\n\n---\n\n# 任务\n${TASKS[kind] || ''}${
          extra ? `\n\n# 老师补充要求（优先满足）\n${extra}` : ''
        }`,
      },
    ];
  };

  /* ---------- 调用 ---------- */
  AI.mode = () => {
    if (Store.mode === 'server') return 'server';
    return 'direct';
  };
  AI.ready = () => (Store.mode === 'server' ? Store.ai.hasKey : Boolean(Store.state.settings.ai.apiKey));

  AI.chat = async ({ messages, temperature, model }) => {
    const cfg = Store.state.settings.ai || {};
    if (Store.mode === 'server') {
      const r = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, temperature: temperature ?? cfg.temperature ?? 0.6, model: model || undefined }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || d.error || `请求失败(${r.status})`);
      return d.content || '';
    }
    // 直连（file:// 模式）：多数服务商会被 CORS 拦截
    const key = cfg.apiKey;
    if (!key) throw new Error('未配置 API Key');
    const base = String(cfg.baseUrl || '').replace(/\/+$/, '');
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: cfg.model || 'deepseek-chat', messages, temperature: temperature ?? cfg.temperature ?? 0.6 }),
    });
    if (!r.ok) throw new Error(`请求失败(${r.status})：${(await r.text()).slice(0, 200)}`);
    const d = await r.json();
    return d?.choices?.[0]?.message?.content || '';
  };

  /**
   * 生成一栏内容
   * 返回 { content, qrefs }：qrefs 是本次给模型的候选题目编号（顺序即提示词里的顺序），
   * 用于把模型写的「第 2 题」这类位置式引用换算回真实题库编号。
   */
  AI.generateArtifact = async (st, session, kind, opts = {}) => {
    const qrefs =
      kind === 'prep' || kind === 'plan'
        ? AI.pickQuestions(st, { ...(opts.quiz || {}), limit: 8 }).map((q) => QB.code(q))
        : [];
    const content = await AI.chat({ messages: AI.buildMessages(st, session, kind, opts) });
    return { content: String(content || '').trim(), qrefs };
  };

  /* ---------- 题目结构化 ---------- */
  AI.structureQuestions = async (rawText, { subject = '', grade = '' } = {}) => {
    const sys = `你是教研员，负责把老师提供的试题文本整理成结构化数据。
只输出 JSON 数组，不要任何解释、不要 markdown 代码块。
每个元素字段：
{"stem":"题干(markdown，保留选项换行)","answer":"参考答案","analysis":"解析","type":"选择|填空|解答|实验|作文","difficulty":1-5,"tags":["知识点"],"subject":"学科","grade":"年级"}
要求：题干完整不丢公式；没有答案就留空字符串；难度按 1 易 5 难估计；标签 1-3 个。`;
    const user = `学科：${subject || '推断'}；年级：${grade || '推断'}。\n\n试题原文：\n${rawText.slice(0, 12000)}`;
    const out = await AI.chat({ messages: [{ role: 'system', content: sys }, { role: 'user', content: user }], temperature: 0.2 });
    return AI.parseJSON(out);
  };

  AI.parseJSON = (text) => {
    let t = String(text || '').trim();
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    const s = t.search(/\[/);
    const e = t.lastIndexOf(']');
    if (s >= 0 && e > s) t = t.slice(s, e + 1);
    return JSON.parse(t);
  };

  /* ---------- Prompt 包（交给 WorkBuddy / 任意 Agent） ---------- */
  AI.promptPack = (st, session, kinds, extra = '', opts = {}) => {
    const list = kinds && kinds.length ? kinds : ARTIFACTS.map((a) => a.key);
    const blocks = list.map((k) => {
      const a = ARTIFACTS.find((x) => x.key === k);
      return `\n\n===== 任务：生成《${a.label}》=====\n${TASKS[k]}`;
    });
    const schemaHint = list
      .map((k) => `  "${k}": "该栏目的 Markdown 正文"`)
      .join(',\n');
    // 只要任务里含习题/教案，上下文就按「需要选题」的模式拼（带上题库候选）
    const ctxKind = list.includes('prep') ? 'prep' : list.includes('plan') ? 'plan' : list[0];
    return `# 家教备课任务包

你是我的家教备课助手。请基于下面的真实资料，为指定学生生成本次课的材料。

## 输出要求（重要）
1. 直接输出一个 JSON 对象，不要任何解释、不要代码块包裹，结构如下：
{
${schemaHint}
}
2. 每个字段的值是 Markdown 正文（用 \\n 换行），不要包含最外层标题以外的多余说明。
3. 生成完后我会把它导入「家教老师 AI 工作台」。

${AI.buildContext(st, session, ctxKind, opts)}
${blocks.join('')}
${extra ? `\n\n# 老师补充要求\n${extra}` : ''}
`;
  };

  /* ---------- 连接测试 ---------- */
  AI.test = async (cfg) => {
    if (Store.mode === 'server') {
      await fetch('/api/ai/config', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(cfg),
      });
      const r = await fetch('/api/state', { cache: 'no-store' });
      const d = await r.json();
      Store.ai = d.ai;
    }
    const out = await AI.chat({
      messages: [
        { role: 'system', content: '你是一个连通性测试助手。' },
        { role: 'user', content: '只回复两个字：正常' },
      ],
      temperature: 0,
    });
    return out;
  };

  window.AI = AI;
})();
