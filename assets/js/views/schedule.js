/* =========================================================
   模块四：学生排期
   ========================================================= */
(function () {
  const Views = (window.Views = window.Views || {});
  const Actions = (window.Actions = window.Actions || {});
  const UIState = (window.UIState = window.UIState || { schedWeek: '' });

  function weekStart() {
    if (!UIState.schedWeek) UIState.schedWeek = U.weekStart(U.today());
    return UIState.schedWeek;
  }

  Views.schedule = {
    render() {
      const S = Store.get();
      const ws = weekStart();
      const days = Array.from({ length: 7 }, (_, i) => U.addDays(ws, i));
      const today = U.today();

      const weekLessons = S.schedule.filter((l) => l.date >= ws && l.date <= U.addDays(ws, 6));
      const active = weekLessons.filter((l) => l.status !== 'canceled');
      const done = active.filter((l) => l.status === 'done').length;
      const hours = active.reduce((n, l) => {
        const [h1, m1] = (l.start || '0:0').split(':').map(Number);
        const [h2, m2] = (l.end || '0:0').split(':').map(Number);
        return n + Math.max(0, (h2 * 60 + m2 - h1 * 60 - m1) / 60);
      }, 0);

      const cols = days
        .map((d) => {
          const list = Store.lessonsOn(d);
          const isToday = d === today;
          return `<div class="day-col ${isToday ? 'today' : ''}" data-day="${d}">
          <div class="day-head">
            <span>${U.weekday(d)}</span><b>${U.fmtDayShort(d)}</b>
            <span class="add" data-act="lesson.new" data-date="${d}" title="添加课程">${U.icon('plus')}</span>
          </div>
          ${
            list.length
              ? list
                  .map((l) => {
                    const st = Store.student(l.studentId);
                    return `<div class="lesson ${l.status}" data-act="lesson.edit" data-id="${l.id}">
                  <div class="l-time">${U.esc(l.start || '')}${l.end ? ' - ' + U.esc(l.end) : ''}</div>
                  <div class="l-name">${U.esc(st?.name || '未指定学生')}</div>
                  <div class="l-sub">${U.esc([l.subject, l.location].filter(Boolean).join(' · '))}</div>
                </div>`;
                  })
                  .join('')
              : `<div class="day-empty">—</div>`
          }
        </div>`;
        })
        .join('');

      const upcoming = S.schedule
        .filter((l) => l.date >= today && l.status === 'planned')
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .slice(0, 5);

      return `
      <div class="page-head">
        <div class="titles"><h1>排期</h1><div class="sub">按周排课，课程可关联学生与课次</div></div>
        <div class="page-actions">
          <div class="week-nav">
            <button class="icon-btn" data-act="sched.prev" title="上一周" style="border:1px solid var(--line-strong)">${U.icon('arrow')}</button>
            <span class="week-label">${U.fmtDay(ws)} - ${U.fmtDay(U.addDays(ws, 6))}</span>
            <button class="icon-btn" data-act="sched.next" title="下一周" style="border:1px solid var(--line-strong);transform:rotate(180deg)">${U.icon('arrow')}</button>
          </div>
          <button class="btn" data-act="sched.today">本周</button>
          <button class="btn primary" data-act="lesson.new">${U.icon('plus')}新增课程</button>
        </div>
      </div>

      <div class="week-grid">${cols}</div>

      <div class="sched-summary">
        <div class="sum-card"><div class="k">本周课程</div><div class="v">${active.length} 节 <small style="font-size:11px;color:var(--ink-3);font-weight:400">已完成 ${done}</small></div></div>
        <div class="sum-card"><div class="k">总课时</div><div class="v">${hours.toFixed(1)} 小时</div></div>
        <div class="sum-card"><div class="k">涉及学生</div><div class="v">${new Set(active.map((l) => l.studentId)).size} 人</div></div>
        <div class="sum-card" style="flex:1.6">
          <div class="k">接下来</div>
          <div class="lesson-list">
            ${
              upcoming.length
                ? upcoming
                    .map((l) => {
                      const st = Store.student(l.studentId);
                      return `<div class="lesson-line" data-act="lesson.edit" data-id="${l.id}" style="cursor:pointer">
                      <span class="t">${U.fmtDayShort(l.date)} ${U.esc(l.start || '')}</span>
                      <span style="font-weight:500">${U.esc(st?.name || '—')}</span>
                      <span class="mini-label">${U.esc(l.subject || '')}</span>
                    </div>`;
                    })
                    .join('')
                : `<span class="mini-label">暂无待上课程</span>`
            }
          </div>
        </div>
      </div>`;
    },
  };

  Actions['sched.prev'] = () => {
    UIState.schedWeek = U.addDays(weekStart(), -7);
    Router.render();
  };
  Actions['sched.next'] = () => {
    UIState.schedWeek = U.addDays(weekStart(), 7);
    Router.render();
  };
  Actions['sched.today'] = () => {
    UIState.schedWeek = U.weekStart(U.today());
    Router.render();
  };

  function lessonForm(l) {
    const S = Store.get();
    return `<div class="grid-2">
      <div class="field"><label>学生</label><select class="select" name="studentId">
        <option value="">（未指定）</option>
        ${S.students.map((s) => `<option value="${s.id}" ${l?.studentId === s.id ? 'selected' : ''}>${U.esc(s.name)}</option>`).join('')}
      </select></div>
      <div class="field"><label>日期</label><input class="input" type="date" name="date" value="${l?.date || U.today()}"></div>
      <div class="field"><label>开始</label><input class="input" type="time" name="start" value="${l?.start || '19:00'}"></div>
      <div class="field"><label>结束</label><input class="input" type="time" name="end" value="${l?.end || '20:30'}"></div>
      <div class="field"><label>科目</label><input class="input" name="subject" value="${U.esc(l?.subject || '')}" placeholder="数学"></div>
      <div class="field"><label>地点</label><input class="input" name="location" value="${U.esc(l?.location || '')}" placeholder="线上 / 学生家"></div>
      <div class="field"><label>状态</label><select class="select" name="status">
        <option value="planned" ${l?.status !== 'done' && l?.status !== 'canceled' ? 'selected' : ''}>待上课</option>
        <option value="done" ${l?.status === 'done' ? 'selected' : ''}>已完成</option>
        <option value="canceled" ${l?.status === 'canceled' ? 'selected' : ''}>已取消</option>
      </select></div>
      <div class="field"><label>备注</label><input class="input" name="note" value="${U.esc(l?.note || '')}"></div>
    </div>`;
  }

  Actions['lesson.new'] = (el) => {
    const date = el.dataset.date || U.today();
    const panel = UI.modal({
      title: '新增课程',
      body: lessonForm({ date }),
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      if (!v.studentId) return U.toast('请选择学生', 'err');
      const st = Store.student(v.studentId);
      Store.commit((s) =>
        s.schedule.push({
          id: U.uid('ls'),
          studentId: v.studentId,
          date: v.date,
          start: v.start,
          end: v.end,
          subject: v.subject.trim() || (st?.profile?.subjects || [])[0] || '',
          location: v.location.trim(),
          status: v.status,
          note: v.note.trim(),
        })
      );
      UI.closeTop();
      Router.render();
      U.toast('已排课', 'ok');
    };
  };

  Actions['lesson.edit'] = (el) => {
    const l = Store.state.schedule.find((x) => x.id === el.dataset.id);
    if (!l) return;
    const panel = UI.modal({
      title: '编辑课程',
      sub: `${U.fmtDay(l.date)} ${U.weekday(l.date)} · ${U.esc(Store.student(l.studentId)?.name || '')}`,
      body: lessonForm(l),
      foot: `<button class="btn danger" data-del>删除</button>
        <button class="btn ghost" data-goto>学生档案</button>
        <div class="spacer"></div>
        <button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-goto]').onclick = () => {
      UI.closeTop();
      if (l.studentId) location.hash = `#/student/${l.studentId}`;
      else U.toast('该课程未关联学生', 'err');
    };
    panel.querySelector('[data-del]').onclick = async () => {
      const ok = await UI.confirm({ title: '删除课程', message: '仅删除排期，不影响已有的课次记录。', danger: true, confirmText: '删除' });
      if (!ok) return;
      Store.commit((s) => (s.schedule = s.schedule.filter((x) => x.id !== l.id)));
      UI.closeAll();
      Router.render();
      U.toast('已删除', 'ok');
    };
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      Store.commit(() => {
        Object.assign(l, {
          studentId: v.studentId,
          date: v.date,
          start: v.start,
          end: v.end,
          subject: v.subject.trim(),
          location: v.location.trim(),
          status: v.status,
          note: v.note.trim(),
        });
      });
      UI.closeTop();
      Router.render();
      U.toast('已保存', 'ok');
    };
  };
})();
