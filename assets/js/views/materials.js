/* =========================================================
   模块一：教材管理
   ========================================================= */
(function () {
  const Views = (window.Views = window.Views || {});
  const Actions = (window.Actions = window.Actions || {});
  const UIState = (window.UIState = window.UIState || { matQ: '', matSubject: '' });

  function subjectsOf() {
    const set = new Set();
    Store.state.materials.forEach((m) => m.subject && set.add(m.subject));
    return [...set];
  }

  Views.materials = {
    render() {
      const S = Store.get();
      const q = String(UIState.matQ || '').trim().toLowerCase();
      let list = S.materials.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      if (UIState.matSubject) list = list.filter((m) => m.subject === UIState.matSubject);
      if (q)
        list = list.filter((m) =>
          [m.title, m.subject, m.grade, (m.text || '').slice(0, 400)].join(' ').toLowerCase().includes(q)
        );

      const rows = list.length
        ? list
            .map((m) => {
              const type = (m.type || 'md').toLowerCase();
              return `<div class="row-card" data-act="mat.open" data-id="${m.id}">
          <div class="ftype ${type}">${type.toUpperCase()}</div>
          <div class="rc-main">
            <div class="rc-title">${U.esc(m.title)}
              ${m.subject ? `<span class="badge">${U.esc(m.subject)}</span>` : ''}
              ${m.grade ? `<span class="badge outline">${U.esc(m.grade)}</span>` : ''}
            </div>
            <div class="rc-sub">
              <span>${U.esc(m.fileName || '')}</span>
              <span>·</span><span>${m.chars ? m.chars.toLocaleString() : (m.text || '').length} 字</span>
              <span>·</span><span>${(m.chunks || []).length || Math.ceil((m.text || '').length / 700)} 段</span>
              <span>·</span><span>${U.rel(m.createdAt)}</span>
            </div>
            <div class="rc-excerpt">${U.esc(U.textify(m.text || '', 160) || '（无文本内容）')}</div>
          </div>
          <div class="rc-actions">
            <button class="icon-btn" data-act="mat.edit" data-id="${m.id}" title="编辑信息">${U.icon('edit')}</button>
            <button class="icon-btn" data-act="mat.del" data-id="${m.id}" title="删除">${U.icon('trash')}</button>
          </div>
        </div>`;
            })
            .join('')
        : `<div class="card"><div class="empty-state">
          <div class="ico">${U.icon('book')}</div>
          <h3>${q || UIState.matSubject ? '没有匹配的教材' : '还没有教材'}</h3>
          <p>上传 PDF 或 Markdown，AI 备课时会自动检索相关片段</p>
          <button class="btn primary" data-act="mat.upload">${U.icon('upload')}上传教材</button>
        </div></div>`;

      const subs = subjectsOf();
      return `
      <div class="page-head">
        <div class="titles"><h1>教材</h1><div class="sub">支持 PDF / Markdown，上传后自动切段，供 AI 备课时检索引用</div></div>
        <div class="page-actions">
          <div class="search">${U.icon('search')}<input class="input" data-focus="mq" data-model="matQ" placeholder="搜索教材内容" value="${U.esc(UIState.matQ)}"></div>
          <button class="btn primary" data-act="mat.upload">${U.icon('upload')}上传教材</button>
        </div>
      </div>

      <div class="dropzone" data-act="mat.upload" data-dz="mat">
        <div class="dz-ico">${U.icon('upload')}</div>
        <b>把 PDF / .md 拖到这里</b>，或点击选择文件
        <div class="mini-label" style="margin-top:4px">PDF 会自动提取文字（扫描版需先 OCR）；原始文件保存在 data/files</div>
      </div>

      ${
        subs.length > 1
          ? `<div class="toolbar" style="margin-top:14px"><div class="seg">
          <button class="${!UIState.matSubject ? 'on' : ''}" data-act="mat.filter" data-v="">全部</button>
          ${subs.map((s) => `<button class="${UIState.matSubject === s ? 'on' : ''}" data-act="mat.filter" data-v="${U.esc(s)}">${U.esc(s)}</button>`).join('')}
        </div><span class="mini-label">共 ${list.length} 份</span></div>`
          : `<div class="toolbar" style="margin-top:14px"><span class="mini-label">共 ${list.length} 份教材</span></div>`
      }
      <div class="list">${rows}</div>`;
    },
  };

  Actions['mat.filter'] = (el) => {
    UIState.matSubject = el.dataset.v;
    Router.render();
  };

  /* ---------------- 上传 ---------------- */
  Actions['mat.upload'] = async () => {
    const files = await U.pickFiles('.pdf,.md,.markdown,.txt');
    if (!files.length) return;
    await uploadMaterials(files);
  };

  async function uploadMaterials(files) {    const panel = UI.modal({
      title: `导入 ${files.length} 份教材`,
      sub: '正在解析文本…',
      body: `<div class="gen-overlay">
        ${files
          .map(
            (f, i) =>
              `<div class="gen-step" data-file="${i}"><i class="dot"></i><span>${U.esc(f.name)}</span><span class="st">等待</span></div>`
          )
          .join('')}
        <div class="progress-line"><i style="width:0%"></i></div>
        <div class="mini-label" data-tip></div>
      </div>`,
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel disabled>导入中…</button>`,
      closable: false,
    });
    const bar = panel.querySelector('.progress-line i');
    const tip = panel.querySelector('[data-tip]');
    let done = 0;

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const step = panel.querySelector(`[data-file="${i}"]`);
      step.classList.add('doing');
      step.querySelector('.st').textContent = '解析中';
      try {
        const text = await U.readAny(f, (p, total) => {
          step.querySelector('.st').textContent = `第 ${p}/${total} 页`;
        });
        if (!text || text.trim().length < 10) throw new Error('未提取到文字（可能是扫描版 PDF）');

        let fileUrl = '';
        if (Store.mode === 'server') {
          step.querySelector('.st').textContent = '保存原文件';
          const r = await fetch(`/api/file?name=${encodeURIComponent(f.name)}`, { method: 'POST', body: f });
          if (r.ok) {
            const d = await r.json();
            fileUrl = d.url;
          }
        }
        const name = f.name.replace(/\.[^.]+$/, '');
        const mat = {
          id: U.uid('mat'),
          title: name,
          subject: guessSubject(name + ' ' + text.slice(0, 300)),
          grade: guessGrade(name + ' ' + text.slice(0, 300)),
          type: f.name.toLowerCase().endsWith('.pdf') ? 'pdf' : f.name.toLowerCase().endsWith('.md') ? 'md' : 'txt',
          fileName: f.name,
          size: f.size,
          chars: text.length,
          text,
          chunks: U.chunk(text),
          fileUrl,
          createdAt: new Date().toISOString(),
        };
        Store.commit((s) => s.materials.push(mat));
        step.classList.add('done');
        step.querySelector('.st').textContent = `${text.length.toLocaleString()} 字`;
        done++;
      } catch (e) {
        step.querySelector('.st').textContent = '失败';
        step.querySelector('.st').style.color = 'var(--danger)';
        step.title = e.message;
        tip.textContent = `${f.name}：${e.message}`;
      }
      bar.style.width = `${Math.round(((i + 1) / files.length) * 100)}%`;
    }

    const btn = panel.querySelector('[data-cancel]');
    btn.disabled = false;
    btn.textContent = '完成';
    btn.className = 'btn primary';
    btn.onclick = () => {
      UI.closeTop();
      Router.render();
    };
    if (done) U.toast(`已导入 ${done} 份教材`, 'ok');
  }

  window.uploadMaterials = uploadMaterials;

  function guessSubject(t) {
    const MAP = [
      ['数学', /数学|函数|方程|几何|三角|集合|数列/],
      ['语文', /语文|古诗|文言文|阅读|作文|拼音/],
      ['英语', /英语|English|grammar|reading|unit\s*\d/i],
      ['物理', /物理|力学|电磁|牛顿|电路|运动学/],
      ['化学', /化学|元素|化学式|反应|mol|溶液/],
      ['生物', /生物|细胞|遗传|生态/],
      ['历史', /历史|朝代|革命|战争/],
      ['地理', /地理|气候|地形|经纬/],
    ];
    for (const [k, re] of MAP) if (re.test(t)) return k;
    return '';
  }
  function guessGrade(t) {
    const m = String(t).match(/([一二三四五六七八九]|高一|高二|高三|初一|初二|初三|小学)[上下]?年级|(初|高)[一二三]/);
    if (!m) return '';
    if (/(初|高)[一二三]/.test(t)) return (t.match(/(初|高)[一二三]/) || [''])[0];
    return m[0].replace('年级', '') + (m[0].includes('年级') ? '' : '年级');
  }
  window.guessSubject = guessSubject;

  /* ---------------- 预览 / 编辑 / 删除 ---------------- */
  Actions['mat.open'] = (el) => {
    const m = Store.material(el.dataset.id);
    if (!m) return;
    const panel = UI.drawer({
      title: U.esc(m.title),
      sub: `${m.subject ? U.esc(m.subject) + ' · ' : ''}${m.chars ? m.chars.toLocaleString() + ' 字' : ''} · ${
        (m.chunks || []).length
      } 段 · ${U.rel(m.createdAt)}`,
      tools: m.fileUrl
        ? `<a class="btn sm" href="${m.fileUrl}" target="_blank">${U.icon('doc')}原文件</a>`
        : `<span class="badge outline">仅文本</span>`,
      body: `<div class="md" data-md></div>`,
      foot: `<button class="btn ghost sm danger" data-del>删除</button><div class="spacer"></div>
        <span class="mini-label">检索切段 ${(m.chunks || []).length} 段</span>
        <button class="btn sm" data-edit>编辑信息</button>`,
    });
    U.fillMd(panel.querySelector('[data-md]'), m.text || '（无内容）');
    panel.querySelector('[data-edit]').onclick = () => {
      UI.closeTop();
      Actions['mat.edit']({ dataset: { id: m.id } });
    };
    panel.querySelector('[data-del]').onclick = async () => {
      const ok = await UI.confirm({ title: '删除教材', message: `「${U.esc(m.title)}」将被移除，AI 备课不再引用。`, danger: true, confirmText: '删除' });
      if (!ok) return;
      removeMaterial(m);
      UI.closeTop();
      Router.render();
    };
  };

  function removeMaterial(m) {
    Store.commit((s) => {
      s.materials = s.materials.filter((x) => x.id !== m.id);
    });
    if (m.fileUrl && Store.mode === 'server') {
      const name = m.fileUrl.split('/').pop();
      fetch(`/api/file/${encodeURIComponent(name)}`, { method: 'DELETE' }).catch(() => {});
    }
    U.toast('已删除教材', 'ok');
  }

  Actions['mat.del'] = async (el) => {
    const m = Store.material(el.dataset.id);
    if (!m) return;
    const ok = await UI.confirm({
      title: '删除教材',
      message: `「${U.esc(m.title)}」将被移除，AI 备课不再引用其内容。`,
      danger: true,
      confirmText: '删除',
    });
    if (!ok) return;
    removeMaterial(m);
    Router.render();
  };

  Actions['mat.edit'] = (el) => {
    const m = Store.material(el.dataset.id);
    if (!m) return;
    const panel = UI.modal({
      title: '教材信息',
      body: `<div class="grid-2">
        <div class="field span-2"><label>标题</label><input class="input" name="title" value="${U.esc(m.title)}"></div>
        <div class="field"><label>学科</label><input class="input" name="subject" value="${U.esc(m.subject || '')}" placeholder="数学"></div>
        <div class="field"><label>适用年级</label><input class="input" name="grade" value="${U.esc(m.grade || '')}" placeholder="初二"></div>
      </div>`,
      foot: `<div class="spacer"></div><button class="btn ghost" data-cancel>取消</button><button class="btn primary" data-ok>保存</button>`,
    });
    panel.querySelector('[data-cancel]').onclick = UI.closeTop;
    panel.querySelector('[data-ok]').onclick = () => {
      const v = UI.values(panel);
      Store.commit(() => {
        m.title = v.title.trim() || m.title;
        m.subject = v.subject.trim();
        m.grade = v.grade.trim();
      });
      UI.closeTop();
      Router.render();
      U.toast('已保存', 'ok');
    };
  };
})();
