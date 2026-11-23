#!/usr/bin/env node
/**
 * 家教工作台 · Agent 命令行工具
 * 让 WorkBuddy / 任意 Agent 直接读写 data/workbench.json，生成的材料会自动出现在工作台里。
 *
 * 用法：
 *   node tutor.mjs list
 *   node tutor.mjs context 林小满 3
 *   node tutor.mjs write 林小满 3 plan --file /tmp/plan.md
 *   node tutor.mjs write 林小满 3 analysis --text "## 学情分析..."
 *   node tutor.mjs add-session 林小满 2026-11-08
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
const DATA = path.join(ROOT, 'data');
const FILE = path.join(DATA, 'workbench.json');

const KINDS = {
  analysis: '课前学情分析',
  prep: '课前习题',
  plan: '教案',
  summary: '课后总结',
};

const argv = process.argv.slice(2);
const cmd = argv[0];

async function load() {
  const raw = await fsp.readFile(FILE, 'utf8');
  const d = JSON.parse(raw);
  if (!d.state) throw new Error('workbench.json 结构异常（缺少 state）');
  return d;
}

async function save(d) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  await fsp.copyFile(FILE, path.join(DATA, `workbench.backup-${ts}.json`)).catch(() => {});
  const next = { ...d, rev: (d.rev || 0) + 1, updatedAt: new Date().toISOString() };
  const tmp = `${FILE}.agent.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(next, null, 2), 'utf8');
  await fsp.rename(tmp, FILE);
  console.log(`已写入 · rev ${next.rev}（工作台 5 秒内自动刷新）`);
}

function findStudent(state, key) {
  const byId = state.students.find((s) => s.id === key);
  if (byId) return byId;
  const exact = state.students.find((s) => s.name === key);
  if (exact) return exact;
  const fuzzy = state.students.filter((s) => s.name.includes(key));
  if (fuzzy.length === 1) return fuzzy[0];
  if (fuzzy.length > 1) throw new Error(`「${key}」匹配到多位学生：${fuzzy.map((s) => s.name).join('、')}`);
  throw new Error(`找不到学生「${key}」`);
}

function sessionsOf(state, sid) {
  return state.sessions.filter((s) => s.studentId === sid).sort((a, b) => a.index - b.index);
}

function bigrams(s) {
  const t = String(s || '').replace(/[\s\p{P}]/gu, '').toLowerCase();
  const out = new Set();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}
function overlap(set, text) {
  const b = bigrams(text);
  let n = 0;
  for (const g of set) if (b.has(g)) n++;
  return n;
}

/** 与前端一致的切段：标题/短段落跟随下一段，避免碎块 */
function chunkText(text, size = 700) {  const paras = String(text || '')
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out = [];
  let cur = '';
  for (const p of paras) {
    const tiny = p.length < 30 || /^#{1,6}\s/.test(p);
    if (!tiny && (cur + '\n\n' + p).length > size && cur) {
      out.push(cur);
      cur = p;
    } else {
      cur = cur ? cur + '\n\n' + p : p;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/* ---------- 题库筛选（与前端 QB 同规则） ---------- */
const stageOf = (g) => {
  const s = String(g || '').trim();
  if (!s) return '未标注';
  if (/高[一二三]|高中/.test(s)) return '高中';
  if (/初[一二三]|初中/.test(s)) return '初中';
  if (/[七八九]年级/.test(s)) return '初中';
  if (/小学|^[一二三四五六]年级/.test(s)) return '小学';
  return '其他';
};

function parseDiff(v) {
  if (v == null || v === '' || v === 'true') return '';
  const s = String(v);
  if (s.includes('-')) {
    const [a, b] = s.split('-').map(Number);
    return [a || 1, b || 5];
  }
  return Number(s) || '';
}

function filterQuestions(list, f = {}) {
  const tags = (f.tags || []).filter(Boolean);
  const kw = String(f.q || '').trim().toLowerCase();
  const types = f.type ? String(f.type).split(/[,，、]/).filter(Boolean) : null;
  return (list || []).filter((q) => {
    if (f.subject && q.subject !== f.subject) return false;
    if (f.stage && stageOf(q.grade) !== f.stage) return false;
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
}

function scoreQuestion(q, st) {
  const p = st?.profile || {};
  let s = (Number(q.difficulty) || 2) * 0.6;
  const tags = q.tags || [];
  const weak = p.weakPoints || [];
  tags.forEach((t) => weak.includes(t) && (s += 6));
  if (p.grade && q.grade === p.grade) s += 5;
  else if (p.grade && stageOf(q.grade) === stageOf(p.grade)) s += 3;
  if ((p.subjects || []).some((x) => x && (q.subject || '').includes(x))) s += 3;
  if (weak.length) s += Math.min(6, overlap(bigrams(weak.join(' ')), `${tags.join(' ')} ${q.stem || ''}`));
  return s;
}

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const k = a.slice(2);
    const next = args[i + 1];
    if (next && !next.startsWith('--')) {
      out[k] = next;
      i++;
    } else out[k] = 'true';
  }
  return out;
}

function questionLine(state, q) {
  const meta = [q.subject, q.grade, q.type, `难度${q.difficulty || 2}`].filter(Boolean).join('/');
  const tags = (q.tags || []).length ? `/${q.tags.join(',')}` : '';
  const stem = String(q.stem || '').replace(/\s*\n\s*/g, ' ').slice(0, 140);
  const code = `Q${state.questions.indexOf(q) + 1}`;
  return `#${code} [${meta}${tags}] ${stem}${q.answer ? `　答案：${q.answer}` : ''}`;
}

function buildContext(state, st, se) {
  const p = st.profile || {};
  const lines = [];
  lines.push('# 学生档案');
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
  lines.push(rows.map(([k, v]) => `- ${k}：${v}`).join('\n'));

  if ((st.logs || []).length) {
    lines.push('\n# 家长沟通 / 课堂反馈记录');
    lines.push(
      st.logs
        .slice()
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .slice(0, 6)
        .map((l) => `- ${l.date}【${l.type}】${l.content}`)
        .join('\n')
    );
  }

  if (se) {
    lines.push('\n# 本次课');
    lines.push(`- 第 ${se.index} 次课\n- 日期：${se.date}\n- 计划主题：${se.topic || '（未填写）'}`);
    const hist = sessionsOf(state, st.id).filter((s) => s.index < se.index).slice(-3);
    lines.push('\n# 历史课次');
    lines.push(
      hist.length
        ? hist
            .map((s) => {
              const t = (s.artifacts?.summary?.content || s.artifacts?.analysis?.content || '')
                .replace(/[#*`>|-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              return `- 第 ${s.index} 次（${s.date}）${s.topic ? '主题：' + s.topic + '；' : ''}${t ? '摘要：' + t.slice(0, 260) : '无记录'}`;
            })
            .join('\n')
        : '（第一次课）'
    );
    const sibling = Object.entries(se.artifacts || {})
      .filter(([, v]) => v?.content)
      .map(([k, v]) => `## ${KINDS[k] || k}\n${String(v.content).slice(0, 1200)}`);
    if (sibling.length) lines.push('\n# 本次课已生成的其他材料\n' + sibling.join('\n\n'));
  }

  // 教材检索
  const query = `${se?.topic || ''} ${(p.weakPoints || []).join(' ')} ${(p.subjects || []).join(' ')}`;
  const qset = bigrams(query);
  const scored = [];
  for (const m of state.materials || []) {
    const chunks = m.chunks && m.chunks.length ? m.chunks : chunkText(m.text);
    const bias = (p.subjects || []).some((s) => (m.subject || '').includes(s)) ? 40 : 0;
    chunks.forEach((c, i) => {
      const s = overlap(qset, c) + bias;
      if (s) scored.push({ s, c, title: m.title });
    });
  }
  scored.sort((a, b) => b.s - a.s);
  lines.push('\n# 可参考教材片段');
  lines.push(
    scored.length
      ? scored
          .slice(0, 4)
          .map((x, i) => `【片段 ${i + 1} ·《${x.title}》】\n${x.c}`)
          .join('\n\n')
      : '（无匹配教材）'
  );

  // 题库参考
  const qs = (state.questions || [])
    .filter((q) => !(p.subjects || []).length || (p.subjects || []).some((s) => (q.subject || '').includes(s)))
    .slice(0, 8);
  if (qs.length) {
    lines.push('\n# 题库可用题目');
    lines.push(
      qs
        .map(
          (q, i) =>
            `${i + 1}. [${q.subject || ''}/${q.type || '题'}/难度${q.difficulty || 2}] ${String(q.stem || '').replace(/\n/g, ' ')}${
              q.answer ? `　参考答案：${q.answer}` : ''
            }`
        )
        .join('\n')
    );
  }
  return lines.join('\n');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

async function main() {
  if (!cmd || cmd === 'help' || cmd === '-h') {
    console.log(`家教工作台 Agent 工具

  node tutor.mjs list
  node tutor.mjs context <学生姓名|id> [课次序号]
  node tutor.mjs write <学生姓名|id> <课次序号> <${Object.keys(KINDS).join('|')}> --file <路径> | --text "<内容>"
  node tutor.mjs add-session <学生姓名|id> [YYYY-MM-DD]
  node tutor.mjs questions [--subject 数学] [--stage 初中] [--grade 初二] [--type 解答,选择]
                           [--difficulty 3|1-2] [--tag 一次函数,图像] [--q 关键词]
                           [--student 林小满] [--limit 10] [--json]
`);
    return;
  }

  const d = await load();
  const state = d.state;

  if (cmd === 'list') {
    if (!state.students.length) return console.log('（还没有学生）');
    state.students.forEach((s) => {
      const p = s.profile || {};
      const list = sessionsOf(state, s.id);
      console.log(`\n● ${s.name}  [${s.id}]  ${p.grade || ''} ${(p.subjects || []).join('/')}`);
      console.log(`  进度：${p.progress || '—'}`);
      list.forEach((se) => {
        const done = Object.keys(se.artifacts || {}).filter((k) => se.artifacts[k]?.content);
        console.log(
          `  第 ${se.index} 次课 ${se.date} ${se.status === 'done' ? '已完成' : '待上'}  ${
            se.topic || ''
          }  [${done.map((k) => KINDS[k]).join('/') || '空'}]`
        );
      });
    });
    return;
  }

  if (cmd === 'questions') {
    const f = parseFlags(argv.slice(1));
    const all = state.questions || [];
    const matched = filterQuestions(all, {
      subject: f.subject,
      stage: f.stage,
      grade: f.grade,
      type: f.type,
      diff: parseDiff(f.difficulty),
      tags: f.tag ? String(f.tag).split(/[,，、]/).filter(Boolean) : [],
      q: f.q,
    });
    let ranked = matched;
    if (f.student && f.student !== 'true') {
      const st = findStudent(state, f.student);
      ranked = matched.slice().sort((a, b) => scoreQuestion(b, st) - scoreQuestion(a, st));
    }
    const limit = Number(f.limit) || ranked.length;
    const out = ranked.slice(0, limit);
    if (f.json === 'true') {
      console.log(JSON.stringify(out.map((q) => ({ code: `Q${all.indexOf(q) + 1}`, ...q })), null, 2));
      return;
    }
    console.log(
      `题库共 ${all.length} 题，命中 ${matched.length} 题${out.length < matched.length ? `，显示前 ${out.length} 题` : ''}`
    );
    out.forEach((q) => console.log(questionLine(state, q)));
    return;
  }

  if (cmd === 'context') {
    const st = findStudent(state, argv[1]);
    const list = sessionsOf(state, st.id);
    const idx = Number(argv[2]) || (list.length ? list[list.length - 1].index : 1);
    const se = list.find((s) => s.index === idx) || list[list.length - 1];
    console.log(buildContext(state, st, se));
    return;
  }

  if (cmd === 'write') {
    const st = findStudent(state, argv[1]);
    const idx = Number(argv[2]);
    const kind = argv[3];
    if (!KINDS[kind]) throw new Error(`栏目只能是：${Object.keys(KINDS).join(' / ')}`);
    const fi = argv.indexOf('--file');
    const ti = argv.indexOf('--text');
    let content = '';
    if (fi > -1) content = await fsp.readFile(argv[fi + 1], 'utf8');
    else if (ti > -1) content = argv[ti + 1];
    if (!content.trim()) throw new Error('内容为空：用 --file 或 --text 传入');
    let se = sessionsOf(state, st.id).find((s) => s.index === idx);
    if (!se) {
      se = {
        id: `se_${Date.now().toString(36)}`,
        studentId: st.id,
        index: idx,
        date: `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`,
        topic: '',
        status: 'planned',
        artifacts: {},
        createdAt: new Date().toISOString(),
      };
      state.sessions.push(se);
    }
    se.artifacts = se.artifacts || {};
    se.artifacts[kind] = { content, updatedAt: new Date().toISOString(), source: 'agent' };
    await save(d);
    console.log(`已写入 ${st.name} 第 ${idx} 次课《${KINDS[kind]}》${content.length} 字`);
    return;
  }

  if (cmd === 'add-session') {
    const st = findStudent(state, argv[1]);
    const list = sessionsOf(state, st.id);
    const idx = list.length ? Math.max(...list.map((s) => s.index)) + 1 : 1;
    const date = argv[2] || `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;
    state.sessions.push({
      id: `se_${Date.now().toString(36)}`,
      studentId: st.id,
      index: idx,
      date,
      topic: argv[3] || '',
      status: 'planned',
      artifacts: {},
      createdAt: new Date().toISOString(),
    });
    await save(d);
    console.log(`已为 ${st.name} 创建第 ${idx} 次课（${date}）`);
    return;
  }

  throw new Error(`未知命令：${cmd}`);
}

main().catch((e) => {
  console.error('错误：' + e.message);
  process.exit(1);
});
