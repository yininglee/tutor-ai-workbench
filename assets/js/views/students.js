/* =========================================================
   模块三：学生管理
   ========================================================= */
(function () {
  const Views = (window.Views = window.Views || {});
  const Actions = (window.Actions = window.Actions || {});
  const UIState = (window.UIState = window.UIState || { studentsQ: '', studentsSort: 'recent' });

  const plain = (s, n = 220) => U.textify(s, n);

  function progressOf(st) {
    const list = Store.sessionsOf(st.id);
    const done = list.filter((s) => s.status === 'done').length;
    const planned = list.filter((s) => s.status !== 'done');
    return { list, done, total: list.length, planned };
  }
  function nextLesson(st) {
    const today = U.today();
    return Store.state.schedule
      .filter((l) => l.studentId === st.id && l.date >= today && l.status !== 'canceled')
      .sort((a, b) => (a.date + (a.start || '')).localeCompare(b.date + (b.start || '')))[0];
  }
  function lastSession(st) {
    const l = Store.sessionsOf(st.id);
    return l.length ? l[l.length - 1] : null;
  }
  function filledDots(st) {
    const se = lastSession(st);
    if (!se) return { html: `<span class="mini-label">尚未排课</span>` };
    const dots = ARTIFACTS.map((a) => {
      const c = se.artifacts?.[a.key]?.content;
      return `<i class="${c ? 'on' : ''}" title="${a.label}${c ? ' · 已生成' : ' · 待生成'}"></i>`;
    }).join('');
    return { html: `<span class="mini-label">第${se.index}次课</span><span class="dots">${dots}</span>` };
  }

  /* ---------------- 列表 ---------------- */
  Views.students = {
    render() {
      const S = Store.get();
      const q = String(UIState.studentsQ || '').trim().toLowerCase();
      let list = S.students.slice();
      if (q)
        list = list.filter((st) =>
          [st.name, st.profile?.grade, (st.profile?.subjects || []).join(''), st.profile?.school, st.profile?.goal]
            .join(' ')
            .toLowerCase()
            .includes(q)
        );
      if (UIState.studentsSort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
      else list.sort((a, b) => (lastSession(b)?.date || '').localeCompare(lastSession(a)?.date || ''));

      const ws = U.weekStart(U.today());
      const we = U.addDays(ws, 6);
      const weekLessons = S.schedule.filter((l) => l.date >= ws && l.date <= we && l.status !== 'canceled');
      const weekDone = weekLessons.filter((l) => l.status === 'done').length;

      const cards = list.length
        ? list
            .map((st) => {
              const p = st.profile || {};
              const pr = progressOf(st);
              const nl = nextLesson(st);
              const dots = filledDots(st);
              return `<button class="student-card" data-act="student.open" data-id="${st.id}">
          <div class="sc-top">
            ${U.avatar(st.name, 40)}
            <div style="min-width:0">
              <div class="sc-name">${U.esc(st.name)}</div>
              <div class="sc-meta">${U.esc([p.grade, (p.subjects || []).join('/')].filter(Boolean).join(' · ') || '未填写年级科目')}</div>
            </div>
            <div style="margin-left:auto;flex:none">${pr.total ? `<span class="badge ${pr.planned.length ? 'amber' : 'green'}">${pr.planned.length ? '进行中' : '已结课'}</span>` : ''}</div>
          </div>
          <div class="sc-body">
            <div class="sc-row"><span class="lab">进度</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${U.esc(
              p.progress || '—'
            )}</span></div>
            <div class="sc-row"><span class="lab">下次课</span><span>${nl ? `${U.fmtDay(nl.date)} ${U.weekday(nl.date)} ${nl.start || ''}` : '<span style="color:var(--ink-3)">未安排</span>'}</span></div>
            <div class="sc-row"><span class="lab">课次</span><span>已完成 ${pr.done} 次${pr.total ? ` · 共 ${pr.total} 次` : ''}</span></div>
          </div>
          <div class="sc-line"></div>
          <div class="sc-foot">${dots.html}<span class="sc-goal" title="${U.esc(p.goal || '')}">${U.esc(U.trunc(p.goal || '', 20))}</span></div>
        </button>`;
            })
            .join('')
        : `<div class="empty-state" style="grid-column:1/-1;border:1px dashed var(--line-strong);border-radius:14px">
        <div class="ico">${U.icon('users')}</div><h3>还没有学生</h3>
        <p>添加第一位学生后，就可以按课次记录学情、习题、教案与总结</p>
        <button class="btn primary" data-act="student.new">${U.icon('plus')}添加学生</button>
        <div class="alt">第一次用？可以先 <a data-act="set.demo">载入示例数据</a> 看看效果</div></div>`;

      return `
      <div class="page-head">
        <div class="titles"><h1>学生</h1><div class="sub">每位学生一张档案卡，点开即可查看课次看板</div></div>
        <div class="page-actions">
          <div class="search">${U.icon('search')}<input class="input" data-focus="sq" data-model="studentsQ" placeholder="搜索姓名 / 年级 / 科目" value="${U.esc(UIState.studentsQ)}"></div>
          <button class="btn primary" data-act="student.new">${U.icon('plus')}添加学生</button>
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="k">在读学生</div><div class="v">${S.students.length}<small>人</small></div></div>
        <div class="stat"><div class="k">累计课次</div><div class="v">${S.sessions.length}<small>次</small></div></div>
        <div class="stat"><div class="k">本周课程</div><div class="v">${weekLessons.length}<small>节</small></div></div>
        <div class="stat"><div class="k">本周已完成</div><div class="v">${weekDone}<small>/ ${weekLessons.length}</small></div></div>
        <div class="stat"><div class="k">教材 / 题目</div><div class="v">${S.materials.length}<small>/ ${S.questions.length}</small></div></div>
      </div>
      <div class="student-grid">${cards}</div>`;
    },
  };

  /* ---------------- 详情 ---------------- */
  Views.student = {
    render({ id }) {
      const st = Store.student(id);
      if (!st) return `<div class="empty-state"><h3>学生不存在</h3><p>可能已被删除</p><button class="btn" data-act="go" data-go="#/students">返回列表</button></div>`;
      const p = st.profile || {};
      const sessions = Store.sessionsOf(st.id);
      const pr = progressOf(st);

      const pf = (k, v, wide, empty = '未填写') =>
        `<div class="pf ${wide ? 'wide' : ''}"><div class="k">${k}</div><div class="v ${v ? '' : 'empty'}">${
          v ? U.esc(v) : empty
        }</div></div>`;

      const logs = (st.logs || [])
        .slice()
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
        .map(
          (l) => `<div class="set-row" style="align-items:flex-start">
        <div style="width:84px;flex:none"><span class="badge ${l.type === '家长沟通' ? 'blue' : 'green'}">${U.esc(l.type || '记录')}</span></div>
        <div class="k" style="font-size:12.5px"><small style="margin:0 0 2px">${U.fmtDay(l.date)} ${U.weekday(l.date)}</small>${U.esc(l.content)}</div>
        <button class="icon-btn" data-act="log.del" data-id="${st.id}" data-log="${l.id}" title="删除记录">${U.icon('trash')}</button>
      </div>`
        )
        .join('');

      return `
      <div class="back-link" data-act="go" data-go="#/students">${U.icon('arrow')}全部学生</div>
      <div class="page-head">
        <div style="display:flex;gap:14px;align-items:center;flex:1;min-width:0">
          ${U.avatar(st.name, 52)}
          <div style="min-width:0">
            <h1>${U.esc(st.name)}
              ${p.grade ? `<span class="badge">${U.esc(p.grade)}</span>` : ''}
              ${(p.subjects || []).map((s) => `<span class="badge green">${U.esc(s)}</span>`).join('')}
            </h1>
            <div class="sub">${U.esc(p.school || '')}${p.school ? ' · ' : ''}已完成 ${pr.done} 次课 / 共 ${pr.total} 次${
        p.parentName ? ` · 家长：${U.esc(p.parentName)}` : ''
      }</div>
          </div>
        </div>
        <div class="page-actions">
          <button class="btn" data-act="student.edit" data-id="${st.id}">${U.icon('edit')}编辑档案</button>
          <button class="btn primary" data-act="ai.prep" data-id="${st.id}">${U.icon('spark')}AI 备课</button>
        </div>
      </div>

      <div class="section-title">档案记录
        <span class="count">与家长沟通后录入，AI 生成时会完整参考</span>
        <span class="spacer"></span>
        <button class="btn sm ghost" data-act="log.new" data-id="${st.id}">${U.icon('plus')}沟通记录</button>
      </div>
      <div class="profile-grid" style="margin-bottom:20px">
        ${pf('辅导科目', (p.subjects || []).join('、'))}
        ${pf('年级阶段', p.grade)}
        ${pf('学习进度', p.progress)}
        ${pf('辅导目标', p.goal)}
        ${pf('学习情况', p.situation, true)}
        ${pf('薄弱点', (p.weakPoints || []).join('、'))}
        ${pf('学习习惯', p.habits)}
      </div>
      ${
        logs
          ? `<div class="card" style="margin-bottom:22px"><div class="set-body" style="padding:6px 16px">${logs}</div></div>`
          : ''
      }

      <div class="section-title">课次看板
        <span class="count">${sessions.length ? '横向按课次排列 · 点击单元格生成或编辑' : ''}</span>
        <span class="spacer"></span>
        <button class="btn sm" data-act="session.new" data-id="${st.id}">${U.icon('plus')}新增课次</button>
      </div>
      ${sessions.length ? renderMatrix(st, sessions) : `
        <div class="card"><div class="empty-state">
          <div class="ico">${U.icon('book')}</div><h3>还没有课次</h3>
          <p>新增第一次课，就能按「学情 → 习题 → 教案 → 总结」逐步生成材料</p>
          <button class="btn primary" data-act="session.new" data-id="${st.id}">${U.icon('plus')}创建第一次课</button>
        </div></div>`}
      `;
    },
  };

  function renderMatrix(st, sessions) {
    const head = sessions
      .map((se) => {
        const done = se.status === 'done';
        return `<th>
      <div class="th-in">
        <span>第 ${se.index} 次课</span>
        <span class="sess-date">${U.fmtDayShort(se.date)}</span>
        <span class="badge ${done ? 'green' : 'amber'}" style="height:18px;font-size:10px">${done ? '已完成' : '待上'}</span>
        <button class="icon-btn sess-menu" style="width:22px;height:22px" data-act="session.edit" data-id="${st.id}" data-se="${se.id}" title="课次设置">${U.icon('dots')}</button>
      </div>
      ${se.topic ? `<div style="font-size:11px;font-weight:400;color:var(--ink-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${U.esc(se.topic)}</div>` : ''}
    </th>`;
      })
      .join('');

    const rows = ARTIFACTS.map((a) => {
      const cells = sessions
        .map((se) => {
          const art = se.artifacts?.[a.key];
          const has = art && art.content;
          if (!has)
            return `<td><button class="cell empty" data-act="art.open" data-id="${st.id}" data-se="${se.id}" data-kind="${a.key}">
          <span class="plus">${U.icon('plus')}<span>AI 生成 / 手写</span></span></button></td>`;
          const src = art.source === 'ai' ? 'AI' : art.source === 'agent' ? 'Agent' : '手写';
          return `<td><button class="cell" data-act="art.open" data-id="${st.id}" data-se="${se.id}" data-kind="${a.key}">
          <div class="c-body">${U.esc(plain(art.content, 200))}</div>
          <div class="c-foot"><span class="src">${art.source === 'ai' || art.source === 'agent' ? '<i class="ai-dot"></i>' : ''}${src}</span><span>·</span><span>${U.rel(art.updatedAt)}</span></div>
        </button></td>`;
        })
        .join('');
      return `<tr><th><span class="rl-ico">${U.icon(a.icon)}</span>${a.label}</th>${cells}</tr>`;
    }).join('');

    return `<div class="matrix-wrap"><table class="matrix">
      <thead><tr><th class="corner">课次 →</th>${head}</tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  /* ---------------- 学生增删改 ---------------- */
  function studentForm(st) {
    const p = st?.profile || {};
    return `<div class="grid-2">
      <div class="field"><label>姓名 *</label><input class="input" name="name" value="${U.esc(st?.name || '')}" placeholder="例如：林小满"></div>
      <div class="field"><label>年级阶段</label><input class="input" name="grade" value="${U.esc(p.grade || '')}" placeholder="例如：初二"></div>
      <div class="field"><label>学校</label><input class="input" name="school" value="${U.esc(p.school || '')}" placeholder="选填"></div>
      <div class="field"><label>辅导科目</label><input class="input" name="subjects" value="${U.esc((p.subjects || []).join('、'))}" placeholder="多个用、分隔，如：数学、物理"></div>
      <div class="field span-2"><label>学习进度</label><input class="input" name="progress" value="${U.esc(p.progress || '')}" placeholder="例如：八年级上册 第 3 章「一次函数」"></div>
      <div class="field span-2"><label>学习情况</label><textarea class="textarea" name="situation" rows="2" placeholder="基础、习惯、态度、常见错误…">${U.esc(p.situation || '')}</textarea></div>
      <div class="field span-2"><label>辅导目标</label><textarea class="textarea" name="goal" rows="2" placeholder="可量化的目标，例如期末进入班级前 10">${U.esc(p.goal || '')}</textarea></div>
      <div class="field"><label>薄弱点</label><input class="input" name="weakPoints" value="${U.esc((p.weakPoints || []).join('、'))}" placeholder="多个用、分隔"></div>
      <div class="field"><label>学习习惯</label><input class="input" name="habits" value="${U.esc(p.habits || '')}" placeholder="专注时长、偏好方式…"></div>
      <div class="field"><label>家长称呼</label><input class="input" name="parentName" value="${U.esc(p.parentName || '')}"></div>
      <div class="field"><label>家长联系方式</label><input class="input" name="parentPhone" value="${U.esc(p.parentPhone || '')}"></div>
      <div class="field span-2"><label>备注</label><input class="input" name="notes" value="${U.esc(p.notes || '')}"></div>
    </div>`;
  }

  Actions['student.open'] = (el) => {
    const id = el.dataset.id;
    if (!id) return;
    location.hash = `#/student/${id}`;
  };

  Actions['student.new'] = () => {
    const panel = UI.modal({
      title: '添加学生',
      sub: '档案越完整，AI 生成的材料越贴合',
      wide: true,
      body: studentForm(null),
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      if (!v.name.trim()) return U.toast('请填写姓名', 'err');
      const st = {
        id: U.uid('stu'),
        name: v.name.trim(),
        createdAt: new Date().toISOString(),
        profile: {
          grade: v.grade.trim(),
          school: v.school.trim(),
          subjects: splitList(v.subjects),
          progress: v.progress.trim(),
          situation: v.situation.trim(),
          goal: v.goal.trim(),
          weakPoints: splitList(v.weakPoints),
          habits: v.habits.trim(),
          parentName: v.parentName.trim(),
          parentPhone: v.parentPhone.trim(),
          notes: v.notes.trim(),
        },
        logs: [],
      };
      Store.commit((s) => s.students.push(st));
      UI.closeTop();
      location.hash = `#/student/${st.id}`;
      U.toast('已添加学生', 'ok');
    };
  };

  function splitList(s) {
    return String(s || '')
      .split(/[、,，;；]/)
      .map((x) => x.trim())
      .filter(Boolean);
  }
  window.splitList = splitList;

  Actions['student.edit'] = (el) => {
    const st = Store.student(el.dataset.id);
    if (!st) return;
    const panel = UI.modal({
      title: `编辑档案 · ${U.esc(st.name)}`,
      wide: true,
      body: studentForm(st),
      foot: `<button class="btn danger" data-del>删除学生</button><div class="spacer"></div>
        <button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-del]').onclick = async () => {
      const ok = await UI.confirm({
        title: '删除学生',
        message: `将删除「${U.esc(st.name)}」及其 ${Store.sessionsOf(st.id).length} 个课次记录，不可恢复。`,
        confirmText: '删除',
        danger: true,
      });
      if (!ok) return;
      Store.commit((s) => {
        s.students = s.students.filter((x) => x.id !== st.id);
        s.sessions = s.sessions.filter((x) => x.studentId !== st.id);
        s.schedule = s.schedule.filter((x) => x.studentId !== st.id);
      });
      UI.closeAll();
      location.hash = '#/students';
      U.toast('已删除', 'ok');
      Router.render();
    };
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      if (!v.name.trim()) return U.toast('请填写姓名', 'err');
      Store.commit(() => {
        st.name = v.name.trim();
        st.profile = {
          ...st.profile,
          grade: v.grade.trim(),
          school: v.school.trim(),
          subjects: splitList(v.subjects),
          progress: v.progress.trim(),
          situation: v.situation.trim(),
          goal: v.goal.trim(),
          weakPoints: splitList(v.weakPoints),
          habits: v.habits.trim(),
          parentName: v.parentName.trim(),
          parentPhone: v.parentPhone.trim(),
          notes: v.notes.trim(),
        };
      });
      UI.closeTop();
      Router.render();
      U.toast('已保存', 'ok');
    };
  };

  Actions['log.new'] = (el) => {
    const st = Store.student(el.dataset.id);
    const panel = UI.modal({
      title: '添加沟通记录',
      sub: '和家长沟通后立刻记一笔，下次备课 AI 会参考',
      body: `<div class="grid-2">
        <div class="field"><label>日期</label><input class="input" type="date" name="date" value="${U.today()}"></div>
        <div class="field"><label>类型</label><select class="select" name="type">
          <option>家长沟通</option><option>课堂反馈</option><option>阶段测评</option><option>其他</option></select></div>
        <div class="field span-2"><label>内容</label><textarea class="textarea" name="content" rows="4" placeholder="家长反馈 / 约定事项 / 学生状态变化…"></textarea></div>
      </div>`,
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      if (!v.content.trim()) return U.toast('请填写内容', 'err');
      Store.commit(() => {
        st.logs = st.logs || [];
        st.logs.push({ id: U.uid('log'), date: v.date, type: v.type, content: v.content.trim() });
      });
      UI.closeTop();
      Router.render();
      U.toast('已记录', 'ok');
    };
  };

  Actions['log.del'] = (el) => {
    const st = Store.student(el.dataset.id);
    Store.commit(() => {
      st.logs = (st.logs || []).filter((l) => l.id !== el.dataset.log);
    });
    Router.render();
  };

  /* ---------------- 课次 ---------------- */
  Actions['session.new'] = (el) => {
    const stId = el.dataset.id;
    const idx = Store.nextIndex(stId);
    const nextLesson = Store.state.schedule
      .filter((l) => l.studentId === stId && l.date >= U.today())
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    const panel = UI.modal({
      title: `新增第 ${idx} 次课`,
      sub: '课次是横向看板的一列，生成的材料都会归档到这一列',
      body: `<div class="grid-2">
        <div class="field"><label>上课日期</label><input class="input" type="date" name="date" value="${nextLesson?.date || U.today()}"></div>
        <div class="field"><label>状态</label><select class="select" name="status"><option value="planned">待上课</option><option value="done">已完成</option></select></div>
        <div class="field span-2"><label>本节课主题</label><input class="input" name="topic" placeholder="例如：一次函数与方程、不等式"></div>
        <div class="field span-2"><label>课前备注（选填）</label><textarea class="textarea" name="note" rows="2" placeholder="本次课特别想解决的问题…"></textarea></div>
      </div>`,
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn" data-ok-gen>${U.icon('spark')}创建并 AI 备课</button><button class="btn primary" data-ok>仅创建</button>`,
    });
    const create = () => {
      const v = UI.values(panel);
      const se = Store.ensureSession(stId, v.date);
      se.index = idx;
      se.topic = v.topic.trim();
      se.status = v.status;
      if (v.note.trim()) se.note = v.note.trim();
      Store.markDirty();
      return se;
    };
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      create();
      UI.closeTop();
      Router.render();
      U.toast('已新增课次', 'ok');
    };
    panel.querySelector('[data-ok-gen]').onclick = () => {
      const se = create();
      UI.closeTop();
      Router.render();
      setTimeout(() => openAIPrep(stId, se.id), 120);
    };
  };

  Actions['session.edit'] = (el) => {
    const stId = el.dataset.id;
    const se = Store.sessionById(el.dataset.se);
    if (!se) return;
    const panel = UI.modal({
      title: `第 ${se.index} 次课 · 设置`,
      body: `<div class="grid-2">
        <div class="field"><label>上课日期</label><input class="input" type="date" name="date" value="${se.date}"></div>
        <div class="field"><label>状态</label><select class="select" name="status">
          <option value="planned" ${se.status !== 'done' ? 'selected' : ''}>待上课</option>
          <option value="done" ${se.status === 'done' ? 'selected' : ''}>已完成</option></select></div>
        <div class="field span-2"><label>本节课主题</label><input class="input" name="topic" value="${U.esc(se.topic || '')}"></div>
      </div>`,
      foot: `<button class="btn danger" data-del>删除课次</button><div class="spacer"></div>
        <button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      Store.commit(() => {
        se.date = v.date;
        se.status = v.status;
        se.topic = v.topic.trim();
      });
      UI.closeTop();
      Router.render();
      U.toast('已保存', 'ok');
    };
    panel.querySelector('[data-del]').onclick = async () => {
      const ok = await UI.confirm({
        title: '删除课次',
        message: `删除后，该课次下的 4 份材料将一并移除。`,
        confirmText: '删除课次',
        danger: true,
      });
      if (!ok) return;
      Store.commit((s) => {
        s.sessions = s.sessions.filter((x) => x.id !== se.id);
      });
      UI.closeAll();
      Router.render();
      U.toast('已删除课次', 'ok');
    };
  };

  /* ---------------- 材料抽屉 ---------------- */
  Actions['art.open'] = (el) => openArtifact(el.dataset.id, el.dataset.se, el.dataset.kind);

  function openArtifact(studentId, sessionId, kind) {
    const st = Store.student(studentId);
    const se = Store.sessionById(sessionId);
    if (!st || !se) return;
    const def = ARTIFACTS.find((a) => a.key === kind);
    const art = se.artifacts?.[kind];
    let editing = false;
    let draft = art?.content || '';
    let pendingSource = null;
    let pendingQrefs = art?.qrefs || [];

    const panel = UI.drawer({
      title: `第 ${se.index} 次课 · ${def.label}`,
      sub: `${U.esc(st.name)} · ${U.fmtDay(se.date)} ${U.weekday(se.date)}${se.topic ? ' · ' + U.esc(se.topic) : ''}`,
      tools: `<button class="btn sm" data-ai>${U.icon('spark')}AI 生成</button>`,
      body: `<div data-viewpane></div>
        <div data-editpane hidden>
          <textarea class="textarea mono editor" data-text placeholder="用 Markdown 书写，支持 $公式$"></textarea>
        </div>
        <div class="hint-bar" data-hint hidden style="margin-top:12px">${U.icon('info')}<span>内容尚未保存，确认无误后点右下角「保存」。</span></div>`,
      foot: `<button class="btn ghost sm danger" data-del>删除内容</button>
        <div class="spacer"></div>
        <span class="mini-label" data-stamp></span>
        <button class="btn sm" data-toggle>${U.icon('edit')}编辑</button>
        <button class="btn primary sm" data-save hidden>保存</button>`,
    });

    const viewPane = panel.querySelector('[data-viewpane]');
    const editPane = panel.querySelector('[data-editpane]');
    const ta = panel.querySelector('[data-text]');
    const toggleBtn = panel.querySelector('[data-toggle]');
    const saveBtn = panel.querySelector('[data-save]');
    const hint = panel.querySelector('[data-hint]');
    const stamp = panel.querySelector('[data-stamp]');

    const paint = () => {
      if (editing) {
        viewPane.hidden = true;
        editPane.hidden = false;
        toggleBtn.innerHTML = `${U.icon('book')}预览`;
        saveBtn.hidden = false;
      } else {
        viewPane.hidden = false;
        editPane.hidden = true;
        toggleBtn.innerHTML = `${U.icon('edit')}编辑`;
        saveBtn.hidden = true;
        if (draft) {
          viewPane.innerHTML = `<div class="md"></div>`;
          U.fillMd(viewPane.firstElementChild, draft, pendingQrefs);
        } else {
          viewPane.innerHTML = `<div class="empty-state" style="padding:60px 10px">
            <div class="ico">${U.icon(def.icon)}</div>
            <h3>还没有${def.label}</h3>
            <p>${def.hint}</p>
            <button class="btn primary" data-ai2>${U.icon('spark')}让 AI 生成这一栏</button>
          </div>`;
          viewPane.querySelector('[data-ai2]')?.addEventListener('click', () => runAI());
        }
      }
      const cur = se.artifacts?.[kind];
      panel.querySelector('[data-del]').style.visibility = draft ? 'visible' : 'hidden';
      stamp.textContent = pendingSource
        ? 'AI 生成 · 未保存'
        : cur
        ? `${cur.source === 'ai' ? 'AI 生成' : cur.source === 'agent' ? 'Agent 写入' : '手写'} · ${U.rel(cur.updatedAt)}`
        : draft
        ? '未保存'
        : '尚未生成';
    };

    async function runAI() {
      if (!AI.ready()) {
        UI.closeTop();
        location.hash = '#/settings';
        U.toast('请先在设置中配置 AI 通道', 'err');
        return;
      }
      const btn = panel.querySelector('[data-ai]');
      btn.classList.add('loading');
      btn.innerHTML = `${U.icon('spark')}生成中…`;
      try {
        const res = await AI.generateArtifact(st, se, kind);
        draft = res.content;
        pendingQrefs = res.qrefs || [];
        pendingSource = 'ai';
        editing = true;
        ta.value = res.content;
        hint.hidden = false;
        paint();
        U.toast('已生成，请检查后保存', 'ok');
      } catch (e) {
        U.toast('生成失败：' + e.message, 'err');
      } finally {
        btn.classList.remove('loading');
        btn.innerHTML = `${U.icon('spark')}AI 生成`;
      }
    }

    panel.querySelector('[data-ai]').onclick = runAI;
    panel.querySelector('[data-del]').onclick = async () => {
      if (!se.artifacts?.[kind]) return UI.closeTop();
      const ok = await UI.confirm({ title: `删除${def.label}`, message: '该内容将被清空，不可恢复。', danger: true, confirmText: '删除' });
      if (!ok) return;
      Store.commit(() => {
        delete se.artifacts[kind];
      });
      UI.closeTop();
      Router.render();
      U.toast('已删除', 'ok');
    };
    toggleBtn.onclick = () => {
      if (editing) {
        draft = ta.value;
      } else {
        ta.value = draft;
      }
      editing = !editing;
      hint.hidden = !editing;
      paint();
    };
    saveBtn.onclick = () => {
      const v = ta.value;
      const src = pendingSource || (art?.source === 'agent' ? 'agent' : 'manual');
      Store.commit(() => {
        se.artifacts = se.artifacts || {};
        se.artifacts[kind] = {
          content: v,
          qrefs: pendingQrefs || [],
          updatedAt: new Date().toISOString(),
          source: src,
        };
      });
      draft = v;
      pendingSource = null;
      hint.hidden = true;
      stamp.textContent = `${src === 'ai' ? 'AI 生成' : src === 'agent' ? 'Agent 写入' : '手写'} · 刚刚`;
      Router.render();
      U.toast('已保存', 'ok');
    };
    ta.addEventListener('input', () => {
      hint.hidden = false;
    });
    paint();
  }

  /* ---------------- AI 备课 ---------------- */
  Actions['ai.prep'] = (el) => openAIPrep(el.dataset.id);

  function openAIPrep(studentId, sessionId) {
    const st = Store.student(studentId);
    if (!st) return;
    const sessions = Store.sessionsOf(studentId);
    let se = sessionId ? Store.sessionById(sessionId) : sessions.filter((s) => s.status !== 'done').slice(-1)[0];
    if (!se) se = sessions[sessions.length - 1];

    const sessionOptions = sessions.length
      ? sessions
          .map(
            (s) =>
              `<option value="${s.id}" ${s.id === se?.id ? 'selected' : ''}>第 ${s.index} 次课 · ${U.fmtDay(s.date)}${
                s.topic ? ' · ' + U.esc(s.topic) : ''
              }</option>`
          )
          .join('')
      : '';

    const panel = UI.modal({
      wide: true,
      title: 'AI 备课',
      sub: `${U.esc(st.name)} · 结合学生档案、教材、题库生成`,
      body: `
        <div class="field" style="margin-bottom:12px">
          <label>课次</label>
          <div style="display:flex;gap:8px">
            <select class="select" name="session">${sessionOptions || '<option value="">（将创建第一次课）</option>'}</select>
            <button class="btn" data-newsession style="flex:none">新建课次</button>
          </div>
        </div>
        <div class="field" style="margin-bottom:12px">
          <label>生成本次课的</label>
          <div id="kinds" style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            ${ARTIFACTS.map(
              (a) => `<label class="opt-card on" data-kind-card="${a.key}" style="display:flex;gap:8px;align-items:flex-start">
              <input type="checkbox" name="kinds" value="${a.key}" checked style="margin-top:2px">
              <span><b>${a.label}</b><p>${a.hint}</p></span>
            </label>`
            ).join('')}
          </div>
        </div>
        <div class="field" style="margin-bottom:14px">
          <label>补充要求（选填）</label>
          <textarea class="textarea" name="extra" rows="2" placeholder="例如：这次课重点讲图像平移；家长希望作业少而精"></textarea>
        </div>
        <div class="set-block" style="margin:0 0 14px">
          <div class="set-head"><h3>出题偏好</h3><span class="sub">影响「课前习题」与「教案例题」的选题</span></div>
          <div class="set-body" style="padding:10px 14px 12px">
            <div class="frow"><span class="flab">年级</span><div class="chips">
              <select class="select sm" name="qgrade" style="width:130px">
                <option value="">跟随学生（${U.esc(st.profile?.grade || '未填写')}）</option>
                ${QB.facets(Store.state.questions)
                  .grades.map(
                    (g) => `<option value="${U.esc(g.k)}">${U.esc(g.k)}（${g.n}）</option>`
                  )
                  .join('')}
              </select>
            </div></div>
            <div class="frow"><span class="flab">题型</span><div class="chips">
              ${
                QB.facets(Store.state.questions).types.length
                  ? QB.facets(Store.state.questions)
                      .types.map((t) => `<button type="button" class="chip" data-qtype="${U.esc(t.k)}">${U.esc(t.k)}<b>${t.n}</b></button>`)
                      .join('')
                  : '<span class="mini-label">题库里还没有题目</span>'
              }
            </div></div>
            <div class="frow"><span class="flab">难度</span><div class="chips">
              <button type="button" class="chip on" data-qdiff="">不限</button>
              <button type="button" class="chip" data-qdiff="1-2">1-2 易</button>
              <button type="button" class="chip" data-qdiff="3">3 中</button>
              <button type="button" class="chip" data-qdiff="4-5">4-5 难</button>
            </div></div>
            <div class="frow"><span class="flab">知识点</span><div class="chips" style="flex:1">
              <input class="input sm" name="qkw" style="width:100%" placeholder="如：一次函数图像（题目与教材都会按它加权）">
            </div></div>
          </div>
        </div>
        <div data-progress hidden></div>
        <div class="set-block" style="margin:0">
          <div class="set-head"><h3>外部 Agent 协作</h3><span class="sub">不想配 API Key 就走这条</span></div>
          <div class="set-body">
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn sm" data-pack>${U.icon('doc')}复制任务包给 WorkBuddy</button>
              <button class="btn sm" data-import>${U.icon('upload')}导入 AI 结果</button>
            </div>
            <div class="mini-label" style="margin-top:8px;line-height:1.55">任务包已含学生档案、教材片段与题库参考；Agent 返回 JSON 后点「导入 AI 结果」即可写回对应课次。</div>
          </div>
        </div>`,
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>关闭</button>
        <button class="btn primary" data-run>${U.icon('spark')}开始生成</button>`,
    });

    const prog = panel.querySelector('[data-progress]');
    const runBtn = panel.querySelector('[data-run]');

    /* ---- 出题偏好 ---- */
    const qTypes = new Set();
    const readQuiz = () => {
      const diffRaw = panel.querySelector('[data-qdiff].on')?.dataset.qdiff || '';
      let diff = '';
      if (diffRaw === '1-2') diff = [1, 2];
      else if (diffRaw === '4-5') diff = [4, 5];
      else if (diffRaw) diff = Number(diffRaw);
      return {
        grade: panel.querySelector('[name="qgrade"]').value,
        type: [...qTypes],
        diff,
        keyword: panel.querySelector('[name="qkw"]').value.trim(),
      };
    };
    panel.querySelectorAll('[data-qtype]').forEach((b) => {
      b.onclick = () => {
        const v = b.dataset.qtype;
        if (qTypes.has(v)) qTypes.delete(v);
        else qTypes.add(v);
        b.classList.toggle('on', qTypes.has(v));
      };
    });
    panel.querySelectorAll('[data-qdiff]').forEach((b) => {
      b.onclick = () => {
        panel.querySelectorAll('[data-qdiff]').forEach((x) => x.classList.toggle('on', x === b));
      };
    });

    panel.querySelector('[data-cancel]').onclick = () => {
      UI.closeTop();
      Router.render();
    };
    panel.querySelectorAll('[data-kind-card]').forEach((card) => {
      const cb = card.querySelector('input');
      card.addEventListener('click', (e) => {
        if (e.target !== cb) return;
        setTimeout(() => card.classList.toggle('on', cb.checked), 0);
      });
    });
    panel.querySelector('[data-newsession]').onclick = () => {
      const s = Store.ensureSession(studentId, U.today());
      Store.markDirty();
      UI.closeTop();
      Router.render();
      setTimeout(() => openAIPrep(studentId, s.id), 150);
    };
    panel.querySelector('[data-pack]').onclick = () => {
      const kinds = [...panel.querySelectorAll('input[name="kinds"]:checked')].map((x) => x.value);
      if (!kinds.length) return U.toast('请至少选择一项', 'err');
      const sel = panel.querySelector('select[name="session"]');
      const sess = sel.value ? Store.sessionById(sel.value) : se;
      if (!sess) return U.toast('请先创建课次', 'err');
      const pack = AI.promptPack(st, sess, kinds, panel.querySelector('[name="extra"]').value, { quiz: readQuiz() });
      U.copy(pack);
    };
    panel.querySelector('[data-import]').onclick = () => importAIResult(studentId, se?.id);

    panel.querySelector('[data-run]').onclick = async () => {
      const sel = panel.querySelector('select[name="session"]');
      const sess = sel.value ? Store.sessionById(sel.value) : se;
      if (!sess) return U.toast('请先创建课次', 'err');
      if (!AI.ready()) {
        U.toast('尚未配置 AI，可先用「复制任务包」交给 WorkBuddy', 'err');
        return;
      }
      const kinds = [...panel.querySelectorAll('input[name="kinds"]:checked')].map((x) => x.value);
      if (!kinds.length) return U.toast('请至少选择一项', 'err');
      const extra = panel.querySelector('[name="extra"]').value;
      const quiz = readQuiz();

      runBtn.disabled = true;
      runBtn.innerHTML = `${U.icon('spark')}生成中…`;
      prog.hidden = false;
      prog.innerHTML = `<div class="gen-overlay">${kinds
        .map((k) => {
          const a = ARTIFACTS.find((x) => x.key === k);
          return `<div class="gen-step" data-step="${k}"><i class="dot"></i><span>${a.label}</span><span class="st">等待</span></div>`;
        })
        .join('')}<div class="progress-line"><i style="width:0%"></i></div></div>`;
      const bar = prog.querySelector('.progress-line i');

      let ok = 0;
      for (let i = 0; i < kinds.length; i++) {
        const k = kinds[i];
        const step = prog.querySelector(`[data-step="${k}"]`);
        step.classList.add('doing');
        step.querySelector('.st').textContent = '生成中…';
        try {
          const res = await AI.generateArtifact(st, sess, k, { quiz, extra });
          Store.commit(() => {
            sess.artifacts = sess.artifacts || {};
            sess.artifacts[k] = {
              content: res.content,
              qrefs: res.qrefs || [],
              updatedAt: new Date().toISOString(),
              source: 'ai',
            };
          });
          step.classList.add('done');
          step.querySelector('.st').textContent = '完成';
          ok++;
        } catch (e) {
          step.querySelector('.st').textContent = '失败';
          step.querySelector('.st').style.color = 'var(--danger)';
          step.title = e.message;
          U.toast(`${ARTIFACTS.find((x) => x.key === k).label} 生成失败：${e.message}`, 'err');
        }
        bar.style.width = `${Math.round(((i + 1) / kinds.length) * 100)}%`;
      }
      runBtn.disabled = false;
      runBtn.innerHTML = `${U.icon('spark')}再次生成`;
      if (ok) {
        U.toast(`已生成 ${ok} 项，关闭后可查看`, 'ok');
        Router.render();
      }
    };
  }

  /* ---------------- 导入外部 AI 结果 ---------------- */
  function importAIResult(studentId, sessionId) {
    const sessions = Store.sessionsOf(studentId);
    const se = sessionId ? Store.sessionById(sessionId) : sessions[sessions.length - 1];
    if (!se) return U.toast('请先创建课次', 'err');
    const panel = UI.modal({
      wide: true,
      title: '导入 AI 结果',
      sub: `将写入「第 ${se.index} 次课」· ${U.fmtDay(se.date)}`,
      body: `<div class="hint-bar info" style="margin-bottom:12px">${U.icon('info')}<span>
        支持两种格式：① 只含 <code>{"analysis":"...","prep":"...","plan":"...","summary":"..."}</code> 的 JSON；② 直接粘贴某个栏目的 Markdown 正文（下方选择写入哪一栏）。</span></div>
      <div class="field" style="margin-bottom:10px">
        <label>写入栏目（粘贴纯 Markdown 时生效）</label>
        <select class="select" name="kind">${ARTIFACTS.map((a) => `<option value="${a.key}">${a.label}</option>`).join('')}</select>
      </div>
      <div class="field"><label>AI 输出内容</label>
        <textarea class="textarea mono" name="payload" rows="14" placeholder='{"analysis":"## 学情分析\\n..."}'></textarea></div>`,
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>写入</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      const raw = v.payload.trim();
      if (!raw) return U.toast('内容为空', 'err');
      let obj = null;
      try {
        obj = AI.parseJSON(raw);
      } catch (e) {
        obj = null;
      }
      Store.commit(() => {
        se.artifacts = se.artifacts || {};
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          for (const a of ARTIFACTS) {
            if (typeof obj[a.key] === 'string' && obj[a.key].trim())
              se.artifacts[a.key] = { content: obj[a.key], updatedAt: new Date().toISOString(), source: 'agent' };
          }
        } else {
          se.artifacts[v.kind] = { content: raw, updatedAt: new Date().toISOString(), source: 'agent' };
        }
      });
      UI.closeTop();
      Router.render();
      U.toast('已写入课次', 'ok');
    };
  }
  window.openAIPrep = openAIPrep;
})();
