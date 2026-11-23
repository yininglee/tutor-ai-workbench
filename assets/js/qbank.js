/* =========================================================
   题库检索层：多维度筛选 + 相关度排序
   供「题库页筛选」与「AI 选题」共用同一套规则
   ========================================================= */
(function () {
  const QB = {};

  const STAGES = ['小学', '初中', '高中', '其他'];
  const GRADE_ORDER = [
    '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
    '七年级', '八年级', '九年级',
    '初一', '初二', '初三', '高一', '高二', '高三',
  ];

  /* ---------- 学段 / 年级归一 ---------- */
  QB.stageOf = (g) => {
    const s = String(g || '').trim();
    if (!s) return '未标注';
    if (/高[一二三]|高中/.test(s)) return '高中';
    if (/初[一二三]|初中/.test(s)) return '初中';
    if (/[七八九]年级/.test(s)) return '初中';
    if (/小学|^[一二三四五六]年级/.test(s)) return '小学';
    return '其他';
  };
  QB.gradeRank = (g) => {
    const s = String(g || '').trim();
    const i = GRADE_ORDER.indexOf(s);
    if (i >= 0) return i;
    for (let k = 0; k < GRADE_ORDER.length; k++) if (s.startsWith(GRADE_ORDER[k])) return k;
    return 99;
  };
  QB.STAGES = STAGES;
  QB.GRADE_ORDER = GRADE_ORDER;

  /* ---------- 文本相关度 ---------- */
  const bg = (s) => {
    const t = String(s || '').replace(/[\s\p{P}]/gu, '').toLowerCase();
    const out = new Set();
    for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
    return out;
  };
  const ov = (set, text) => {
    if (!set || !set.size) return 0;
    const b = bg(text);
    let n = 0;
    for (const g of set) if (b.has(g)) n++;
    return n;
  };
  QB.bigrams = bg;
  QB.overlap = ov;

  /* ---------- 筛选 ---------- */
  // f: { subject, stage, grade, type(字符串或数组), diff(数字/''/[min,max]), tags[], q }
  QB.filter = (list, f = {}) => {
    const tags = (f.tags || []).filter(Boolean);
    const kw = String(f.q || '').trim().toLowerCase();
    const types = f.type ? (Array.isArray(f.type) ? f.type : [f.type]).filter(Boolean) : null;
    return (list || []).filter((q) => {
      if (f.subject && q.subject !== f.subject) return false;
      if (f.stage && QB.stageOf(q.grade) !== f.stage) return false;
      if (f.grade && q.grade !== f.grade) return false;
      if (types && types.length && !types.includes(q.type)) return false;
      if (f.diff !== '' && f.diff != null) {
        const d = Number(q.difficulty) || 2;
        if (Array.isArray(f.diff)) {
          if (d < f.diff[0] || d > f.diff[1]) return false;
        } else if (d !== Number(f.diff)) return false;
      }
      if (tags.length && !(q.tags || []).some((t) => tags.includes(t))) return false;
      if (kw) {
        const hay = [q.stem, q.answer, q.analysis, (q.tags || []).join(' '), q.subject, q.grade, q.type]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });
  };

  /* ---------- 分面统计 ---------- */
  const tally = (arr, pick) => {
    const m = new Map();
    arr.forEach((x) => {
      const k = pick(x);
      if (!k) return;
      m.set(k, (m.get(k) || 0) + 1);
    });
    return [...m.entries()].map(([k, n]) => ({ k, n }));
  };

  QB.facets = (list) => {
    const arr = list || [];
    return {
      subjects: tally(arr, (q) => q.subject).sort((a, b) => b.n - a.n),
      stages: tally(arr, (q) => QB.stageOf(q.grade))
        .filter((x) => x.k !== '未标注')
        .sort((a, b) => STAGES.indexOf(a.k) - STAGES.indexOf(b.k)),
      grades: tally(arr, (q) => q.grade).sort((a, b) => QB.gradeRank(a.k) - QB.gradeRank(b.k)),
      types: tally(arr, (q) => q.type).sort((a, b) => b.n - a.n),
      tags: tally(
        arr.flatMap((q) => q.tags || []),
        (t) => t
      ).sort((a, b) => b.n - a.n),
    };
  };

  /* ---------- 相关度打分 ---------- */
  // ctx: { grade, subjects[], weakTags[], bigrams(Set), keyword }
  QB.score = (q, ctx = {}) => {
    let s = 0;
    const tags = q.tags || [];
    if (ctx.weakTags && ctx.weakTags.size) {
      tags.forEach((t) => {
        if (ctx.weakTags.has(t)) s += 6;
      });
    }
    if (ctx.bigrams) s += Math.min(6, ov(ctx.bigrams, `${tags.join(' ')} ${q.stem || ''}`));
    if (ctx.keyword) s += Math.min(5, ov(bg(ctx.keyword), `${q.stem || ''} ${tags.join(' ')}`));
    if (ctx.grade) {
      if (q.grade === ctx.grade) s += 5;
      else if (QB.stageOf(q.grade) === QB.stageOf(ctx.grade)) s += 3;
    }
    if (ctx.subjects && ctx.subjects.some((x) => x && (q.subject || '').includes(x))) s += 3;
    s += (Number(q.difficulty) || 2) * 0.6;
    return s;
  };

  /** 先按条件硬筛，再按与学生画像的相关度排序 */
  QB.search = (opts = {}) => {
    const all = Store.state.questions || [];
    const matched = QB.filter(all, opts);
    const soft = opts.soft || {};
    const ctx = {
      grade: soft.grade,
      subjects: soft.subjects || [],
      weakTags: new Set(soft.weakPoints || []),
      bigrams: soft.weakText ? bg(soft.weakText) : null,
      keyword: opts.q || soft.keyword || '',
    };
    return matched
      .map((q) => ({ q, s: QB.score(q, ctx) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, opts.limit || 8)
      .map((x) => x.q);
  };

  /* ---------- 稳定编号（AGENT / AI 引用用） ---------- */
  QB.code = (q) => {
    const i = (Store.state.questions || []).indexOf(q);
    return i >= 0 ? `Q${i + 1}` : 'Q?';
  };

  /* ---------- 给 AI 的单行描述 ---------- */
  QB.describe = (q) => {
    const meta = [q.subject, q.grade, q.type, `难度${q.difficulty || 2}`]
      .filter(Boolean)
      .join('/');
    const tags = (q.tags || []).length ? `/${q.tags.join(',')}` : '';
    const stem = String(q.stem || '').replace(/\s*\n\s*/g, ' ');
    return `#${QB.code(q)} [${meta}${tags}] ${stem}${q.answer ? `　参考答案：${q.answer}` : ''}`;
  };

  window.QB = QB;
})();
