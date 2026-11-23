/* =========================================================
   设置：AI 通道 / 数据 / 外观
   ========================================================= */
(function () {
  const Views = (window.Views = window.Views || {});
  const Actions = (window.Actions = window.Actions || {});

  Views.settings = {
    render() {
      const S = Store.get();
      const cfg = S.settings.ai || {};
      const mode = cfg.mode || 'builtin';
      const server = Store.mode === 'server';
      const hasKey = Store.ai.hasKey || Boolean(cfg.apiKey);

      return `
      <div class="page-head">
        <div class="titles"><h1>设置</h1><div class="sub">AI 通道、数据位置与外观</div></div>
      </div>

      <div class="set-block">
        <div class="set-head"><h3>AI 生成方式</h3><span class="sub">两种都可用，推荐先用「外部 Agent」试效果</span></div>
        <div class="set-body" id="aiForm">
          <div class="opt-cards">
            <div class="opt-card ${mode === 'builtin' ? 'on' : ''}" data-act="set.ai.mode" data-v="builtin">
              <b>${U.icon('spark')}内置 AI 直连</b>
              <p>在工作台里点一下就生成，结果直接落到课次里。需要一个 OpenAI 兼容的 API Key。</p>
            </div>
            <div class="opt-card ${mode === 'agent' ? 'on' : ''}" data-act="set.ai.mode" data-v="agent">
              <b>${U.icon('doc')}外部 Agent 协作</b>
              <p>工作台生成「任务包」，交给 WorkBuddy 等 Agent 生成，再粘回/写回。不需要 API Key。</p>
            </div>
          </div>

          ${
            mode === 'agent'
              ? `<div class="hint-bar info">${U.icon('info')}<span>
              在「学生 → AI 备课」里点「复制任务包给 WorkBuddy」，把整段内容粘给 Agent；它返回 JSON 后，点「导入 AI 结果」写回对应课次。
              也可让 Agent 直接修改 <code>data/workbench.json</code>（详见工作台根目录 <code>技能说明</code>），工作台会自动刷新。
            </span></div>`
              : `<div class="grid-2">
              <div class="field"><label>接口地址（OpenAI 兼容）</label>
                <input class="input" name="baseUrl" value="${U.esc(cfg.baseUrl || 'https://api.deepseek.com/v1')}" placeholder="https://api.deepseek.com/v1">
                <span class="hint">DeepSeek / 通义 / Kimi / 智谱 / OpenAI / 本地 Ollama 均可</span></div>
              <div class="field"><label>模型</label>
                <input class="input" name="model" value="${U.esc(cfg.model || 'deepseek-chat')}" placeholder="deepseek-chat"></div>
              <div class="field span-2"><label>API Key</label>
                <input class="input" name="apiKey" type="password" placeholder="${
                  hasKey ? `已配置 ${U.esc(Store.ai.keyHint || '')}（留空则不修改）` : 'sk-...'
                }">
                <span class="hint">${server ? 'Key 只保存在本机 data/secrets.json，不写进数据文件、不上传任何服务器' : '浏览器本地模式下 Key 会存在 localStorage，建议用「启动工作台」运行'}</span></div>
            </div>
            <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
              <button class="btn primary" data-act="set.saveAI">${U.icon('check')}保存并测试连接</button>
              <button class="btn" data-act="set.test">测试</button>
              ${hasKey ? `<button class="btn ghost danger" data-act="set.clearKey">清除 Key</button>` : ''}
              <span class="mini-label" data-ai-status></span>
            </div>`
          }
        </div>
      </div>

      <div class="set-block">
        <div class="set-head"><h3>数据</h3><span class="sub">${server ? '文件模式' : '浏览器模式'}</span></div>
        <div class="set-body">
          <div class="set-row">
            <div class="k">存储位置<small>${
              server
                ? 'data/workbench.json（随文件夹一起打包即可复用）'
                : '浏览器 localStorage（关闭浏览器仍在，但换电脑/清缓存会丢）'
            }</small></div>
            ${server ? `<button class="btn sm" data-act="set.openData">在访达中显示</button>` : `<button class="btn sm" data-act="set.help">如何切换到文件模式</button>`}
          </div>
          <div class="set-row">
            <div class="k">备份与迁移<small>导出的 JSON 可在另一台电脑导入</small></div>
            <div style="display:flex;gap:8px">
              <button class="btn sm" data-act="set.export">导出数据</button>
              <button class="btn sm" data-act="set.import">导入数据</button>
            </div>
          </div>
          <div class="set-row">
            <div class="k">示例数据<small>载入 2 位学生、3 个课次与示例教材题库，方便先看效果</small></div>
            <button class="btn sm" data-act="set.demo">载入示例</button>
          </div>
          <div class="set-row">
            <div class="k">清空<small>删除全部学生、课次、教材、题库与排期</small></div>
            <button class="btn sm ghost danger" data-act="set.clear">清空所有数据</button>
          </div>
        </div>
      </div>

      <div class="set-block">
        <div class="set-head"><h3>外观</h3></div>
        <div class="set-body">
          <div class="set-row">
            <div class="k">主题<small>当前：${S.settings.theme === 'dark' ? '深色' : '浅色'}</small></div>
            <button class="btn sm" data-act="toggle-theme">切换深浅色</button>
          </div>
          <div class="set-row">
            <div class="k">老师称呼<small>显示在文档署名处，可留空</small></div>
            <input class="input sm" style="width:200px" data-model="tutorName" data-commit="settings" value="${U.esc(S.settings.tutorName || '')}" placeholder="例如：李老师">
          </div>
        </div>
      </div>

      <div class="set-block">
        <div class="set-head"><h3>快捷键与小技巧</h3></div>
        <div class="set-body" style="font-size:12.5px;color:var(--ink-2);line-height:2">
          <div>· 在课次看板里点空白格 → 直接让 AI 生成该栏目；点已有内容 → 预览/编辑</div>
          <div>· 教材上传后自动切段，AI 备课只检索相关片段，不会把整本书塞进上下文</div>
          <div>· 题库里选中的题会被优先改编进「课前习题」</div>
          <div>· <span class="kbd">Esc</span> 关闭抽屉 / 弹窗</div>
        </div>
      </div>`;
    },
  };

  Actions['set.ai.mode'] = (el) => {
    Store.commit((s) => (s.settings.ai.mode = el.dataset.v));
    Router.render();
  };

  Actions['set.saveAI'] = async (el) => {
    const body = document.getElementById('aiForm');
    const v = UI.values(body);
    const status = document.querySelector('[data-ai-status]');
    try {
      if (Store.mode === 'server') {
        const r = await fetch('/api/ai/config', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ baseUrl: v.baseUrl, model: v.model, apiKey: v.apiKey }),
        });
        const d = await r.json();
        Store.ai = d.ai || Store.ai;
        Store.commit((s) => {
          s.settings.ai.baseUrl = v.baseUrl;
          s.settings.ai.model = v.model;
          s.settings.ai.mode = 'builtin';
        });
      } else {
        Store.commit((s) => {
          s.settings.ai.baseUrl = v.baseUrl;
          s.settings.ai.model = v.model;
          s.settings.ai.mode = 'builtin';
          if (v.apiKey) s.settings.ai.apiKey = v.apiKey;
        });
      }
      if (status) status.textContent = '连接中…';
      const out = await AI.test({ baseUrl: v.baseUrl, model: v.model });
      if (status) status.textContent = '连接正常 · ' + (out || '').slice(0, 20);
      U.toast('已保存，连接正常', 'ok');
    } catch (e) {
      if (status) status.textContent = '连接失败';
      U.toast('连接失败：' + e.message, 'err');
    }
  };

  Actions['set.test'] = async (el) => {
    const v = UI.values(document.getElementById('aiForm'));
    const status = document.querySelector('[data-ai-status]');
    if (status) status.textContent = '连接中…';
    try {
      const out = await AI.test({ baseUrl: v.baseUrl, model: v.model });
      if (status) status.textContent = '正常 · ' + (out || '').slice(0, 20);
      U.toast('连接正常', 'ok');
    } catch (e) {
      if (status) status.textContent = '失败';
      U.toast(e.message, 'err');
    }
  };

  Actions['set.clearKey'] = async () => {
    if (Store.mode === 'server') {
      await fetch('/api/ai/config', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clearKey: true }) });
      Store.ai.hasKey = false;
    } else {
      Store.commit((s) => delete s.settings.ai.apiKey);
    }
    Router.render();
    U.toast('已清除 Key', 'ok');
  };

  Actions['set.openData'] = async () => {
    try {
      const r = await fetch('/api/open-data', { method: 'POST' });
      const d = await r.json();
      U.toast('已打开 ' + d.dir, 'ok');
    } catch (e) {
      U.toast('无法打开文件夹', 'err');
    }
  };

  Actions['set.export'] = () => {
    Store.exportFile();
    U.toast('已导出 JSON', 'ok');
  };

  Actions['set.import'] = async () => {
    const files = await U.pickFiles('.json', false);
    if (!files.length) return;
    const ok = await UI.confirm({
      title: '导入数据',
      message: '当前工作台的数据将被导入文件覆盖，建议先导出备份。',
      confirmText: '继续导入',
      danger: true,
    });
    if (!ok) return;
    try {
      await Store.importFile(files[0]);
      Router.render();
      U.toast('导入成功', 'ok');
    } catch (e) {
      U.toast('导入失败：' + e.message, 'err');
    }
  };

  Actions['set.demo'] = async () => {
    const ok = await UI.confirm({
      title: '载入示例数据',
      message: '将覆盖当前数据（建议先导出备份）。示例含 2 位学生、4 个课次与教材题库样例。',
      confirmText: '载入',
      danger: true,
    });
    if (!ok) return;
    Store.state = window.demoState();
    Store.markDirty();
    location.hash = '#/students';
    Router.render();
    U.toast('示例已载入', 'ok');
  };

  Actions['set.clear'] = async () => {
    const ok = await UI.confirm({
      title: '清空所有数据',
      message: '学生、课次、教材、题库、排期都会被删除，且不可恢复。建议先导出备份。',
      confirmText: '确认清空',
      danger: true,
    });
    if (!ok) return;
    const keep = Store.state.settings;
    Store.state = {
      version: 1,
      settings: keep,
      materials: [],
      questions: [],
      students: [],
      sessions: [],
      schedule: [],
    };
    Store.markDirty();
    location.hash = '#/students';
    Router.render();
    U.toast('已清空', 'ok');
  };

  Actions['set.help'] = () => {
    UI.modal({
      title: '切换到文件模式',
      body: `<div class="md" style="font-size:13px">
        <p>浏览器本地模式受 5MB 存储限制，且无法保存 PDF 原文件。用文件模式可以获得完整能力：</p>
        <ol>
          <li>在访达里双击工作台目录下的 <code>启动工作台.command</code></li>
          <li>浏览器会自动打开 <code>http://127.0.0.1:5173</code></li>
          <li>数据会写入 <code>data/workbench.json</code>，可随文件夹打包给其他人</li>
        </ol>
        <p>如果双击没反应，在终端里执行：</p>
        <pre><code>cd "${location.pathname.replace(/\/index\.html$/, '')}"\nnode server.mjs</code></pre>
      </div>`,
      foot: `<div class="spacer"></div><button class="btn primary" data-ok>知道了</button>`,
      onMount: (p) => (p.querySelector('[data-ok]').onclick = UI.closeTop),
    });
  };
})();
