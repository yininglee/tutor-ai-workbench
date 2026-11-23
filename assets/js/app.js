/* =========================================================
   应用入口：路由 / 事件分发 / 初始化
   ========================================================= */
(function () {
  const Router = {
    current: null,

    parse() {
      const h = location.hash || '#/students';
      const parts = h.replace(/^#\/?/, '').split('/').filter(Boolean);
      const name = parts[0] || 'students';
      return { name, params: { id: parts[1] ? decodeURIComponent(parts[1]) : '' } };
    },

    render(opts = {}) {
      const { name, params } = this.parse();
      const view = Views[name] || Views.students;
      const el = document.getElementById('view');
      const active = document.activeElement;
      const focusId = active && active.dataset ? active.dataset.focus : null;
      const caret = focusId && active.setSelectionRange ? active.selectionStart : null;

      const html = view.render(params);
      if (opts.keepScroll !== true) {
        const scrollTop = document.querySelector('.main').scrollTop;
        el.innerHTML = html;
        if (name === 'student' || this.current === name) document.querySelector('.main').scrollTop = scrollTop;
        else document.querySelector('.main').scrollTop = 0;
      } else {
        el.innerHTML = html;
      }
      this.current = name;

      // 导航高亮
      document.querySelectorAll('#nav a').forEach((a) => {
        const k = a.dataset.nav;
        a.classList.toggle('active', k === name || (k === 'students' && name === 'student'));
      });

      // 焦点还原
      if (focusId) {
        const nx = document.querySelector(`[data-focus="${focusId}"]`);
        if (nx) {
          nx.focus();
          if (caret != null && nx.setSelectionRange) {
            try {
              nx.setSelectionRange(caret, caret);
            } catch (e) {}
          }
        }
      }
    },

    go(hash) {
      if (location.hash === hash) this.render();
      else location.hash = hash;
    },
  };
  window.Router = Router;

  /* ---------- 点击分发 ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.tagName === 'A' && el.getAttribute('href')) return; // 带 href 的链接交给 hash 路由
    const act = el.dataset.act;
    if (act === 'go') {
      e.preventDefault();
      Router.go(el.dataset.go);
      return;
    }
    if (act === 'toggle-theme') {
      e.preventDefault();
      Actions['toggle-theme']();
      return;
    }
    if (typeof Actions[act] === 'function') {
      e.preventDefault();
      e.stopPropagation();
      try {
        Actions[act](el, e);
      } catch (err) {
        console.error(err);
        U.toast('操作出错：' + err.message, 'err');
      }
    }
  });

  /* ---------- 输入绑定 ---------- */
  const softRefresh = U.debounce(() => Router.render({ keepScroll: true }), 180);
  document.addEventListener('input', (e) => {
    const el = e.target.closest('[data-model]');
    if (!el) return;
    const key = el.dataset.model;
    if (el.dataset.commit === 'settings') {
      const val = el.value;
      const save = U.debounce(() => Store.commit((s) => (s.settings[key] = val)), 400);
      save();
      return;
    }
    UIState[key] = el.value;
    softRefresh();
  });

  /* ---------- 拖拽上传 ---------- */
  let dragDepth = 0;
  document.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes('Files')) return;
    dragDepth++;
    document.querySelectorAll('[data-dz="mat"]').forEach((z) => z.classList.add('over'));
  });
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
  });
  document.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (!dragDepth) document.querySelectorAll('[data-dz="mat"]').forEach((z) => z.classList.remove('over'));
  });
  document.addEventListener('drop', async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    dragDepth = 0;
    document.querySelectorAll('[data-dz="mat"]').forEach((z) => z.classList.remove('over'));
    const files = [...e.dataTransfer.files].filter((f) => /\.(pdf|md|markdown|txt)$/i.test(f.name));
    if (!files.length) return U.toast('只支持 PDF / Markdown / TXT', 'err');
    if (location.hash.includes('questions')) return U.toast('题库上传请点击「上传题库」按钮', 'err');
    if (window.uploadMaterials) await window.uploadMaterials(files);
  });

  /* ---------- 主题 ---------- */
  Actions['toggle-theme'] = () => {
    const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = t;
    Store.commit((s) => (s.settings.theme = t));
    if (location.hash.includes('settings')) Router.render();
  };

  /* ---------- 同步状态说明 ---------- */
  Actions['sync-info'] = () => {
    UI.modal({
      title: '数据存储',
      body: `<div class="md" style="font-size:13px">
        <p>当前模式：<b>${Store.mode === 'server' ? '文件模式（推荐）' : '浏览器本地模式'}</b></p>
        ${
          Store.mode === 'server'
            ? `<p>所有数据实时写入工作台目录下的 <code>data/workbench.json</code>。整个文件夹复制给别人，对方双击
               <code>启动工作台.command</code> 即可继续使用同一份数据。</p>
               <p>最后保存：${U.fmtStamp(Store.lastSaved) || '刚刚'}</p>`
            : `<p>未检测到本地服务，数据存在浏览器里（上限约 5MB，且无法保存 PDF 原文件）。</p>
               <p>双击工作台目录下的 <code>启动工作台.command</code> 可切换到文件模式。</p>`
        }
      </div>`,
      foot: `<div class="spacer"></div><button class="btn primary" data-ok>好</button>`,
      onMount: (p) => (p.querySelector('[data-ok]').onclick = UI.closeTop),
    });
  };

  /* ---------- 启动 ---------- */
  (async function boot() {
    if (!location.hash) location.hash = '#/students';
    await Store.init();
    document.getElementById('boot').remove();
    document.getElementById('app').hidden = false;
    Router.render();
    window.addEventListener('hashchange', () => Router.render());
    // 外部写入后自动重绘
    Store.subscribe(() => Router.render());
  })();
})();
