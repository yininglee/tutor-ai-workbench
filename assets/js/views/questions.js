/* =========================================================
   模块二：题库管理
   ========================================================= */
(function () {
  const Views = (window.Views = window.Views || {});
  const Actions = (window.Actions = window.Actions || {});
  const UIState = (window.UIState = window.UIState || {});
  if (!Array.isArray(UIState.qTags)) UIState.qTags = [];

  const TYPES = ['选择', '填空', '解答', '判断', '实验', '作文', '其他'];

  const activeFilters = () =>
    ['qSubject', 'qStage', 'qGrade', 'qType', 'qDiff'].filter((k) => UIState[k]).length +
    (UIState.qTags.length ? 1 : 0);

  const DIFF_LABEL = { 1: '1 易', 2: '2', 3: '3 中', 4: '4', 5: '5 难' };

  function chipRow(label, items, key, opts = {}) {
    if (!items || !items.length) return '';
    const multi = !!opts.multi;
    const cur = UIState[key];
    const body = items
      .map((x) => {
        const v = x.k != null ? String(x.k) : String(x);
        const on = multi ? (cur || []).includes(v) : cur === v;
        const text = x.label != null ? x.label : v;
        return `<button type="button" class="chip ${on ? 'on' : ''}" data-act="${opts.act || 'q.filter'}" data-k="${key}" data-v="${U.esc(
          v
        )}">${U.esc(text)}${opts.count && x.n != null ? `<b>${x.n}</b>` : ''}</button>`;
      })
      .join('');
    return `<div class="frow"><span class="flab">${label}</span><div class="chips">${body}${opts.extra || ''}</div></div>`;
  }

  Views.questions = {
    render() {
      const S = Store.get();
      const facets = QB.facets(S.questions);

      const filters = {
        subject: UIState.qSubject,
        stage: UIState.qStage,
        grade: UIState.qGrade,
        type: UIState.qType,
        diff: UIState.qDiff,
        tags: UIState.qTags,
        q: UIState.qQ,
      };
      const list = QB.filter(S.questions, filters).sort((a, b) => {
        const c = (b.createdAt || '').localeCompare(a.createdAt || '');
        return c !== 0 ? c : QB.code(b).localeCompare(QB.code(a), 'en', { numeric: true });
      });

      const rows = list.length
        ? list
            .map(
              (x) => `<div class="row-card" data-act="q.open" data-id="${x.id}">
          <div class="ftype md" style="font-size:11px;font-weight:600">${U.esc((x.type || '题').slice(0, 2))}</div>
          <div class="rc-main">
            <div class="rc-title" style="font-weight:500"><span class="qcode">${QB.code(x)}</span>${U.esc(
                U.textify(String(x.stem || '').split('\n')[0], 70)
              )}${String(x.stem || '').length > 70 ? '…' : ''}</div>
            <div class="rc-sub">
              ${x.subject ? `<span class="badge">${U.esc(x.subject)}</span>` : ''}
              ${x.grade ? `<span class="badge outline">${U.esc(x.grade)}</span>` : ''}
              <span>难度 ${U.stars(x.difficulty || 2)}</span>
              ${(x.tags || []).slice(0, 3).map((t) => `<span class="chip">${U.esc(t)}</span>`).join('')}
            </div>
            ${x.answer ? `<div class="rc-excerpt">答案：${U.esc(U.textify(x.answer, 90))}</div>` : ''}
          </div>
          <div class="rc-actions">
            <button class="icon-btn" data-act="q.edit" data-id="${x.id}" title="编辑">${U.icon('edit')}</button>
            <button class="icon-btn" data-act="q.del" data-id="${x.id}" title="删除">${U.icon('trash')}</button>
          </div>
        </div>`
            )
            .join('')
        : `<div class="card"><div class="empty-state">
          <div class="ico">${U.icon('search')}</div>
          <h3>${activeFilters() || UIState.qQ ? '没有匹配的题目' : '题库还是空的'}</h3>
          <p>${activeFilters() || UIState.qQ ? '换个组合试试，或清空筛选条件' : '上传试卷 PDF / Markdown，或手动录入一道题'}</p>
          <div style="display:flex;gap:8px;justify-content:center">
            ${
              activeFilters() || UIState.qQ
                ? `<button class="btn primary" data-act="q.clear">清空筛选</button>`
                : `<button class="btn primary" data-act="q.upload">${U.icon('upload')}上传题库</button>
                   <button class="btn" data-act="q.new">${U.icon('plus')}手动录入</button>`
            }
          </div>
        </div></div>`;

      const gradeItems = facets.grades.filter((g) => !UIState.qStage || QB.stageOf(g.k) === UIState.qStage);
      const tagItems = UIState.qShowAllTags ? facets.tags : facets.tags.slice(0, 16);
      const tagMore =
        facets.tags.length > 16
          ? `<button type="button" class="chip more" data-act="q.tagmore">${
              UIState.qShowAllTags ? '收起' : `+${facets.tags.length - 16}`
            }</button>`
          : '';
      const hasAny = S.questions.length > 0;

      return `
      <div class="page-head">
        <div class="titles"><h1>题库</h1><div class="sub">AI 出题时会按学科、学段、题型、知识点筛选题库并优先改编</div></div>
        <div class="page-actions">
          <div class="search">${U.icon('search')}<input class="input" data-focus="qq" data-model="qQ" placeholder="搜索题干 / 答案 / 知识点" value="${U.esc(UIState.qQ)}"></div>
          <button class="btn" data-act="q.new">${U.icon('plus')}手动录入</button>
          <button class="btn primary" data-act="q.upload">${U.icon('upload')}上传题库</button>
        </div>
      </div>

      ${
        hasAny
          ? `<div class="filterbar">
        <div class="fbar-head">
          <span class="fbar-count">共 ${S.questions.length} 题${
              list.length !== S.questions.length ? ` · 命中 <b>${list.length}</b>` : ''
            }</span>
          ${activeFilters() || UIState.qQ ? `<button class="btn sm ghost" data-act="q.clear">清空筛选</button>` : ''}
          <span class="mini-label" style="margin-left:auto">点已选项可取消</span>
        </div>
        ${chipRow('学科', facets.subjects, 'qSubject', { count: true })}
        ${facets.stages.length > 1 ? chipRow('学习阶段', facets.stages, 'qStage', { count: true }) : ''}
        ${chipRow('年级', gradeItems, 'qGrade', { count: true })}
        ${chipRow('题型', facets.types, 'qType', { count: true })}
        ${chipRow('难度', [1, 2, 3, 4, 5].map((d) => ({ k: String(d), label: DIFF_LABEL[d] })), 'qDiff')}
        ${chipRow('知识点', tagItems, 'qTags', { multi: true, count: true, extra: tagMore })}
      </div>`
          : ''
      }
      <div class="list">${rows}</div>`;
    },
  };

  Actions['q.filter'] = (el) => {
    const k = el.dataset.k;
    const v = el.dataset.v;
    if (Array.isArray(UIState[k])) {
      const i = UIState[k].indexOf(v);
      if (i >= 0) UIState[k].splice(i, 1);
      else UIState[k].push(v);
    } else {
      UIState[k] = UIState[k] === v ? '' : v;
    }
    if (k === 'qStage' && UIState.qGrade && QB.stageOf(UIState.qGrade) !== UIState.qStage) UIState.qGrade = '';
    Router.render({ keepScroll: true });
  };

  Actions['q.tagmore'] = () => {
    UIState.qShowAllTags = !UIState.qShowAllTags;
    Router.render({ keepScroll: true });
  };

  Actions['q.clear'] = () => {
    Object.assign(UIState, { qQ: '', qSubject: '', qStage: '', qGrade: '', qType: '', qDiff: '' });
    UIState.qTags = [];
    Router.render({ keepScroll: true });
  };

  /* ---------------- 预览 ---------------- */
  const findByCode = (code) => {
    const m = String(code || '').match(/(\d+)/);
    if (!m) return null;
    return Store.state.questions[Number(m[1]) - 1] || null;
  };

  Actions['q.open'] = (el) => {
    const q = Store.question(el.dataset.id);
    if (q) openQuestionPanel(q, {});
  };

  // 正文里的「#Q3」引用 → 点开原题
  Actions['qref.open'] = (el) => {
    const code = el.dataset.code;
    const q = findByCode(code);
    if (!q) {
      U.toast(`题库里找不到 #${code}，可能已被删除`, 'err');
      return;
    }
    openQuestionPanel(q, { fromRef: true });
  };

  function openQuestionPanel(q, opts = {}) {
    const fromRef = !!opts.fromRef;
    let showAns = fromRef;
    const panel = UI.drawer({
      title: fromRef ? `原题回查 · ${QB.code(q)}` : '题目详情',
      sub: `<span><span class="qcode">${QB.code(q)}</span>${U.esc(q.subject || '未分类')} · ${U.esc(
        q.type || '题'
      )} · 难度 ${q.difficulty || 2}${q.grade ? ' · ' + U.esc(q.grade) : ''}${
        (q.tags || []).length ? ' · ' + U.esc(q.tags.join('、')) : ''
      }</span>`,
      body: `<div class="md" data-stem></div>
        <div style="margin-top:18px">
          <button class="btn sm" data-toggle>${U.icon('check')}显示答案与解析</button>
        </div>
        <div data-ans hidden style="margin-top:14px">
          <div class="hint-bar info" style="margin-bottom:10px">${U.icon('info')}<span>参考答案</span></div>
          <div class="md" data-answer></div>
          <div class="hint-bar info" style="margin:14px 0 10px">${U.icon('info')}<span>解析</span></div>
          <div class="md" data-analysis></div>
        </div>`,
      foot: `<button class="btn ghost sm danger" data-del>删除</button><div class="spacer"></div>
        <span class="mini-label">${fromRef ? '来自正文的题库引用' : ''}</span>
        <button class="btn sm" data-edit>编辑</button>`,
    });
    U.fillMd(panel.querySelector('[data-stem]'), q.stem || '');
    U.fillMd(panel.querySelector('[data-answer]'), q.answer || '（未填写）');
    U.fillMd(panel.querySelector('[data-analysis]'), q.analysis || '（未填写）');
    const toggle = panel.querySelector('[data-toggle]');
    const setAns = (v) => {
      showAns = v;
      panel.querySelector('[data-ans]').hidden = !showAns;
      toggle.innerHTML = showAns ? '隐藏答案' : `${U.icon('check')}显示答案与解析`;
    };
    setAns(fromRef);
    toggle.onclick = () => setAns(!showAns);
    panel.querySelector('[data-edit]').onclick = () => {
      UI.closeTop();
      Actions['q.edit']({ dataset: { id: q.id } });
    };
    panel.querySelector('[data-del]').onclick = async () => {
      const ok = await UI.confirm({ title: '删除题目', message: '该题目将从题库移除。', danger: true, confirmText: '删除' });
      if (!ok) return;
      Store.commit((s) => (s.questions = s.questions.filter((x) => x.id !== q.id)));
      UI.closeTop();
      Router.render();
      U.toast('已删除', 'ok');
    };
  };

  /* ---------------- 录入 / 编辑 ---------------- */
  function qForm(q) {
    return `<div class="grid-3">
        <div class="field"><label>学科</label><input class="input" name="subject" value="${U.esc(q?.subject || '')}" placeholder="数学"></div>
        <div class="field"><label>年级</label><input class="input" name="grade" value="${U.esc(q?.grade || '')}" placeholder="初二"></div>
        <div class="field"><label>题型</label><select class="select" name="type">${TYPES.map(
          (t) => `<option ${q?.type === t ? 'selected' : ''}>${t}</option>`
        ).join('')}</select></div>
      </div>
      <div class="field" style="margin-top:12px"><label>题干（Markdown，支持 $公式$）</label>
        <textarea class="textarea mono" name="stem" rows="6" placeholder="已知一次函数 $y=2x-4$，求……">${U.esc(q?.stem || '')}</textarea></div>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>参考答案</label><textarea class="textarea" name="answer" rows="3">${U.esc(q?.answer || '')}</textarea></div>
        <div class="field"><label>解析</label><textarea class="textarea" name="analysis" rows="3">${U.esc(q?.analysis || '')}</textarea></div>
      </div>
      <div class="grid-2" style="margin-top:12px">
        <div class="field"><label>难度（1-5）</label><input class="input" name="difficulty" type="number" min="1" max="5" value="${q?.difficulty || 2}"></div>
        <div class="field"><label>知识点标签</label><input class="input" name="tags" value="${U.esc((q?.tags || []).join('、'))}" placeholder="多个用、分隔"></div>
      </div>`;
  }

  Actions['q.new'] = () => {
    const panel = UI.modal({
      title: '手动录入题目',
      wide: true,
      sub: '支持 Markdown 与 LaTeX 公式',
      body: qForm(null),
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      if (!v.stem.trim()) return U.toast('请填写题干', 'err');
      const q = {
        id: U.uid('q'),
        subject: v.subject.trim(),
        grade: v.grade.trim(),
        type: v.type,
        difficulty: U.clamp(Number(v.difficulty) || 2, 1, 5),
        stem: v.stem.trim(),
        answer: v.answer.trim(),
        analysis: v.analysis.trim(),
        tags: splitList(v.tags),
        source: '手动录入',
        createdAt: new Date().toISOString(),
      };
      Store.commit((s) => s.questions.push(q));
      UI.closeTop();
      Router.render();
      U.toast('已加入题库', 'ok');
    };
  };

  Actions['q.edit'] = (el) => {
    const q = Store.question(el.dataset.id);
    if (!q) return;
    const panel = UI.modal({
      title: '编辑题目',
      wide: true,
      body: qForm(q),
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      Store.commit(() => {
        Object.assign(q, {
          subject: v.subject.trim(),
          grade: v.grade.trim(),
          type: v.type,
          difficulty: U.clamp(Number(v.difficulty) || 2, 1, 5),
          stem: v.stem.trim(),
          answer: v.answer.trim(),
          analysis: v.analysis.trim(),
          tags: splitList(v.tags),
        });
      });
      UI.closeTop();
      Router.render();
      U.toast('已保存', 'ok');
    };
  };

  Actions['q.del'] = async (el) => {
    const q = Store.question(el.dataset.id);
    if (!q) return;
    const ok = await UI.confirm({ title: '删除题目', message: '该题目将从题库移除。', danger: true, confirmText: '删除' });
    if (!ok) return;
    Store.commit((s) => (s.questions = s.questions.filter((x) => x.id !== q.id)));
    Router.render();
    U.toast('已删除', 'ok');
  };

  /* ---------------- 上传题库 ---------------- */
  Actions['q.upload'] = async () => {
    const files = await U.pickFiles('.pdf,.md,.markdown,.txt');
    if (!files.length) return;

    const panel = UI.modal({
      title: '解析题库文件',
      sub: files.map((f) => f.name).join('、'),
      body: `<div class="gen-overlay">
        ${files.map((f, i) => `<div class="gen-step" data-file="${i}"><i class="dot"></i><span>${U.esc(f.name)}</span><span class="st">等待</span></div>`).join('')}
      </div>`,
      closable: false,
      foot: `<div class="spacer"></div><button class="btn ghost" disabled>读取中…</button>`,
    });

    let all = [];
    for (let i = 0; i < files.length; i++) {
      const step = panel.querySelector(`[data-file="${i}"]`);
      step.classList.add('doing');
      step.querySelector('.st').textContent = '解析中';
      try {
        const t = await U.readAny(files[i], (p, total) => (step.querySelector('.st').textContent = `${p}/${total} 页`));
        all.push(t);
        step.classList.add('done');
        step.querySelector('.st').textContent = `${t.length.toLocaleString()} 字`;
      } catch (e) {
        step.querySelector('.st').textContent = '失败';
      }
    }
    UI.closeTop();
    const text = all.join('\n\n');
    if (!text.trim()) return U.toast('未提取到文本', 'err');
    openImport(text, files[0].name);
  };

  function openImport(text, fileName) {
    let parsed = splitQuestions(text);
    let mode = 'rule';
    let aiResult = null;
    const defaultSubject = guessSubject(text.slice(0, 500));

    const panel = UI.modal({
      wide: true,
      title: '导入题目',
      sub: `来源：${U.esc(fileName)} · 共 ${text.length.toLocaleString()} 字`,
      body: `
        <div class="toolbar" style="margin-bottom:10px">
          <div class="seg">
            <button class="on" data-mode="rule">按题号自动拆分</button>
            <button data-mode="ai">${U.icon('spark')} AI 智能拆分</button>
          </div>
          <span class="mini-label" data-count>识别到 ${parsed.length} 题</span>
        </div>
        <div class="grid-2" style="margin-bottom:12px">
          <div class="field"><label>学科</label><input class="input" name="subject" value="${U.esc(defaultSubject)}" placeholder="数学"></div>
          <div class="field"><label>年级</label><input class="input" name="grade" placeholder="初二"></div>
        </div>
        <div data-preview style="max-height:300px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:var(--surface-2)"></div>`,
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>导入</button>`,
    });

    const preview = panel.querySelector('[data-preview]');
    const countEl = panel.querySelector('[data-count]');
    const okBtn = panel.querySelector('[data-ok]');

    function paint() {
      const list = mode === 'ai' ? aiResult || [] : parsed;
      countEl.textContent = mode === 'ai' && !aiResult ? '未拆分' : `识别到 ${list.length} 题`;
      okBtn.disabled = !list.length;
      preview.innerHTML = list.length
        ? list
            .slice(0, 40)
            .map(
              (q, i) => `<div style="padding:7px 0;border-bottom:1px dashed var(--line)">
            <div style="font-size:12.5px;line-height:1.55">${i + 1}. ${U.esc(String(q.stem || '').slice(0, 120).replace(/\n/g, ' '))}</div>
            <div class="mini-label" style="margin-top:2px">${U.esc(q.type || '')}${q.answer ? ' · 含答案' : ' · 无答案'}</div>
          </div>`
            )
            .join('') + (list.length > 40 ? `<div class="mini-label" style="padding-top:8px">…另有 ${list.length - 40} 题</div>` : '')
        : `<div class="mini-label" style="padding:20px 0;text-align:center">未识别到题目，可换用 AI 拆分，或把题目整理成「1. 2. 3.」的编号格式</div>`;
    }
    paint();

    panel.querySelectorAll('[data-mode]').forEach((b) => {
      b.onclick = async () => {
        const m = b.dataset.mode;
        panel.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === b));
        mode = m;
        if (m === 'ai' && !aiResult) {
          if (!AI.ready()) {
            U.toast('未配置 AI，可先用「手动录入」或按题号拆分', 'err');
            mode = 'rule';
            panel.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x.dataset.mode === 'rule'));
            return paint();
          }
          b.classList.add('loading');
          b.innerHTML = `${U.icon('spark')}拆分中…`;
          try {
            const v = UI.values(panel);
            aiResult = await AI.structureQuestions(text, { subject: v.subject, grade: v.grade });
            if (!Array.isArray(aiResult)) throw new Error('返回格式不正确');
          } catch (e) {
            U.toast('AI 拆分失败：' + e.message, 'err');
            mode = 'rule';
            panel.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x.dataset.mode === 'rule'));
            aiResult = null;
          }
          b.classList.remove('loading');
          b.innerHTML = `${U.icon('spark')} AI 智能拆分`;
        }
        paint();
      };
    });

    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    okBtn.onclick = () => {
      const v = UI.values(panel);
      const list = mode === 'ai' ? aiResult || [] : parsed;
      if (!list.length) return;
      const now = new Date().toISOString();
      Store.commit((s) => {
        list.forEach((q) => {
          s.questions.push({
            id: U.uid('q'),
            subject: (q.subject || v.subject || '').trim(),
            grade: (q.grade || v.grade || '').trim(),
            type: q.type || '其他',
            difficulty: U.clamp(Number(q.difficulty) || 2, 1, 5),
            stem: q.stem || '',
            answer: q.answer || '',
            analysis: q.analysis || '',
            tags: Array.isArray(q.tags) ? q.tags : [],
            source: fileName,
            createdAt: now,
          });
        });
      });
      UI.closeTop();
      Router.render();
      U.toast(`已导入 ${list.length} 题`, 'ok');
    };
  }

  /* 按题号启发式拆分 */
  function splitQuestions(text) {
    const lines = String(text).split(/\r?\n/);
    const re = /^\s*(?:第\s*)?(\d{1,3})\s*[.、．)）]\s*(?=\S)/;
    const blocks = [];
    let cur = null;
    for (const line of lines) {
      const m = line.match(re);
      const isHeader = /^\s*(?:[一二三四五六七八九十]+[、.]|第[一二三四五六七八九十]+[章节部分])/.test(line);
      if (m && !isHeader && line.trim().length <= 200) {
        if (cur) blocks.push(cur);
        cur = { num: m[1], lines: [line.replace(re, '')] };
      } else if (cur) {
        cur.lines.push(line);
      }
    }
    if (cur) blocks.push(cur);

    const out = blocks
      .map((b) => {
        let body = b.lines.join('\n').trim();
        if (!body) return null;
        let answer = '';
        let analysis = '';
        const am = body.match(/\n\s*(?:【?\s*(?:参考)?答案\s*】?\s*[:：]?)([\s\S]*?)(?=\n\s*(?:解析|分析|【解析】)\s*[:：]|$)/);
        if (am) {
          answer = am[1].trim();
          body = body.replace(am[0], '').trim();
        }
        const jm = body.match(/\n\s*(?:【?\s*(?:解析|分析)\s*】?\s*[:：]?)([\s\S]*)$/);
        if (jm) {
          analysis = jm[1].trim();
          body = body.replace(jm[0], '').trim();
        }
        const type = /[A-D][.、．)]\s*\S/.test(body) ? '选择' : /_{2,}|（\s*）/.test(body) ? '填空' : '解答';
        return { stem: body, answer, analysis, type, difficulty: 2, tags: [] };
      })
      .filter(Boolean)
      .filter((x) => x.stem.length > 4);

    if (out.length <= 1 && text.length > 50) {
      // 没有编号：整份作为一个题组
      return [{ stem: text.trim().slice(0, 8000), answer: '', analysis: '', type: '其他', difficulty: 2, tags: [], subject: '' }];
    }
    return out;
  }
  window.splitQuestions = splitQuestions;
})();
