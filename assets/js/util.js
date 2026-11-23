/* =========================================================
   通用工具 & UI 原子组件
   ========================================================= */
(function () {
  const U = {};

  /* ---------- 基础 ---------- */
  U.uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  U.esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.debounce = (fn, ms = 400) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  U.clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  U.bytes = (n) => {
    if (!n) return '0 B';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(0) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  };
  U.trunc = (s, n = 60) => (String(s || '').replace(/\s+/g, ' ').trim().slice(0, n));

  /** Markdown / LaTeX → 纯文本，用于列表摘要 */
  U.textify = (s, n = 200) => {
    let t = String(s || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[#*`>|_~]/g, ' ')
      .replace(/\$\$?/g, '')
      .replace(/\\times/g, '×').replace(/\\cdot/g, '·').replace(/\\div/g, '÷')
      .replace(/\\neq/g, '≠').replace(/\\leq?/g, '≤').replace(/\\geq?/g, '≥')
      .replace(/\\pm/g, '±').replace(/\\pi/g, 'π').replace(/\\angle/g, '∠')
      .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\theta/g, 'θ')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return n ? t.slice(0, n) : t;
  };

  /* ---------- 日期 ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  U.iso = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  U.today = () => U.iso(new Date());
  U.parseDay = (s) => {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]);
  };
  U.fmtDay = (s) => {
    const d = U.parseDay(s);
    if (!d) return s || '—';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };
  U.fmtDayShort = (s) => {
    const d = U.parseDay(s);
    return d ? `${pad(d.getMonth() + 1)}.${pad(d.getDate())}` : '—';
  };
  const WD = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  U.weekday = (s) => {
    const d = U.parseDay(s);
    return d ? WD[d.getDay()] : '';
  };
  U.addDays = (dateStr, n) => {
    const d = U.parseDay(dateStr) || new Date();
    d.setDate(d.getDate() + n);
    return U.iso(d);
  };
  U.weekStart = (dateStr) => {
    const d = U.parseDay(dateStr) || new Date();
    const day = (d.getDay() + 6) % 7; // 周一为一周起点
    d.setDate(d.getDate() - day);
    return U.iso(d);
  };
  U.rel = (iso) => {
    if (!iso) return '';
    const t = new Date(iso).getTime();
    if (!t) return '';
    const diff = Date.now() - t;
    if (diff < 60e3) return '刚刚';
    if (diff < 3600e3) return `${Math.floor(diff / 60e3)} 分钟前`;
    if (diff < 86400e3) return `${Math.floor(diff / 3600e3)} 小时前`;
    if (diff < 30 * 86400e3) return `${Math.floor(diff / 86400e3)} 天前`;
    const d = new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  U.fmtStamp = (iso) => {
    const d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /* ---------- 展示 ---------- */
  const PALETTE = [
    ['#3c8169', '#24564a'],
    ['#5b7db1', '#3b5a86'],
    ['#b1735a', '#8a5238'],
    ['#8a6fae', '#63498a'],
    ['#a3894b', '#7d6733'],
    ['#4f8b9c', '#346270'],
    ['#a1657f', '#7d4560'],
  ];
  U.colorOf = (str) => {
    let h = 0;
    for (const ch of String(str || 'x')) h = (h * 31 + ch.charCodeAt(0)) % 9973;
    return PALETTE[h % PALETTE.length];
  };
  U.avatar = (name, size = 40) => {
    const [a, b] = U.colorOf(name);
    const initials = String(name || '?').trim().slice(0, 1) || '?';
    return `<div class="avatar" style="width:${size}px;height:${size}px;background:linear-gradient(150deg,${a},${b});font-size:${Math.round(size * 0.4)}px">${U.esc(initials)}</div>`;
  };
  U.stars = (n) => {
    const c = U.clamp(Number(n) || 0, 0, 5);
    return `<span style="letter-spacing:1px;color:var(--warn)">${'●'.repeat(c)}<span style="color:var(--line-strong)">${'●'.repeat(5 - c)}</span></span>`;
  };

  /* ---------- Markdown ---------- */
  if (window.marked) {
    window.marked.setOptions({ gfm: true, breaks: true });
    window.marked.use({
      renderer: {
        link(href, title, text) {
          const t = title ? ` title="${title}"` : '';
          return `<a href="${href}"${t} target="_blank" rel="noopener">${text}</a>`;
        },
      },
    });
  }
  U.md = (text) => {
    if (!text) return '';
    try {
      return window.marked ? window.marked.parse(String(text)) : `<pre>${U.esc(text)}</pre>`;
    } catch (e) {
      return `<pre>${U.esc(text)}</pre>`;
    }
  };
  U.renderMath = (el) => {
    if (!el || typeof window.renderMathInElement !== 'function') return;
    try {
      window.renderMathInElement(el, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        throwOnError: false,
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      });
    } catch (e) {}
  };
  /**
   * 把正文里的题库引用变成可点击的标签：
   *   #Q3 / Q3 / 题库第 3 题  →  <span class="qref" data-act="qref.open" data-code="Q3">#Q3</span>
   * 在 KaTeX 渲染之后执行，跳过公式、代码、链接内部。
   */
  U.linkifyQrefs = (root, qrefs) => {
    if (!root || typeof document === 'undefined') return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const targets = [];
    let n;
    while ((n = walker.nextNode())) {
      const v = n.nodeValue;
      if (!v || !/#\s?Q\s?\d+|题库第/.test(v)) continue;
      const p = n.parentElement;
      if (!p || p.closest('a, code, pre, .katex, script, textarea')) continue;
      targets.push(n);
    }
    const RE = /#\s*(Q\s?\d+)\b|题库第\s*(\d+)\s*题/g;
    for (const node of targets) {
      const text = node.nodeValue;
      RE.lastIndex = 0;
      let m;
      let last = 0;
      let frag = null;
      while ((m = RE.exec(text))) {
        // 直接写了 #Q3 → 用它；写「第 2 题」→ 取本次生成时候选列表的第 2 个编号，取不到再退回 Q2
        let code = m[1] ? m[1].replace(/\s+/g, '').toUpperCase() : '';
        if (!code) {
          const idx = Number(m[2]) - 1;
          code = (Array.isArray(qrefs) && qrefs[idx]) || `Q${m[2]}`;
        }
        if (!frag) frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement('span');
        span.className = 'qref';
        span.dataset.act = 'qref.open';
        span.dataset.code = code;
        span.setAttribute('role', 'button');
        span.title = `查看题库原题 #${code}`;
        span.textContent = m[0].trim();
        frag.appendChild(span);
        last = m.index + m[0].length;
      }
      if (frag) {
        frag.appendChild(document.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    }
  };

  U.fillMd = (el, text, qrefs) => {
    if (!el) return;
    el.innerHTML = U.md(text);
    U.renderMath(el);
    U.linkifyQrefs(el, qrefs);
  };

  /* ---------- Toast ---------- */
  U.toast = (msg, type = '') => {
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, type === 'err' ? 4200 : 2300);
  };

  /* ---------- 复制 / 下载 ---------- */
  U.copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      U.toast('已复制到剪贴板', 'ok');
      return true;
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        U.toast('已复制到剪贴板', 'ok');
        return true;
      } catch (e2) {
        U.toast('复制失败，请手动选择文本', 'err');
        return false;
      } finally {
        ta.remove();
      }
    }
  };
  U.download = (filename, content, mime = 'application/json') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime + ';charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  /* ---------- 文件 ---------- */
  U.pickFiles = (accept = '.pdf,.md,.markdown,.txt', multiple = true) =>
    new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept;
      inp.multiple = multiple;
      inp.onchange = () => resolve(Array.from(inp.files || []));
      inp.click();
    });

  U.fileToText = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ''));
      r.onerror = reject;
      r.readAsText(file, 'utf-8');
    });

  U.pdfToText = async (file, onProgress) => {
    if (!window.pdfjsLib) throw new Error('PDF 解析库未加载');
    const buf = await file.arrayBuffer();
    const task = window.pdfjsLib.getDocument({ data: new Uint8Array(buf), isEvalSupported: false });
    const pdf = await task.promise;
    const pages = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      // 按 y 坐标聚合成行
      const rows = new Map();
      for (const it of tc.items) {
        if (!it.str) continue;
        const y = Math.round(it.transform[5] / 3) * 3;
        const x = it.transform[4];
        if (!rows.has(y)) rows.set(y, []);
        rows.get(y).push({ x, w: it.width || 0, s: it.str });
      }
      const ys = [...rows.keys()].sort((a, b) => b - a);
      const lines = [];
      for (const y of ys) {
        const items = rows.get(y).sort((a, b) => a.x - b.x);
        let line = '';
        let endX = null;
        for (const it of items) {
          if (endX != null && it.x - endX > 6) line += ' ';
          line += it.s;
          endX = it.x + it.w;
        }
        lines.push(line.replace(/\s+$/, ''));
      }
      pages.push(lines.join('\n'));
      if (onProgress) onProgress(p, pdf.numPages);
    }
    return pages
      .join('\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  };

  U.readAny = async (file, onProgress) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.pdf')) return await U.pdfToText(file, onProgress);
    return await U.fileToText(file);
  };

  /* ---------- 文本切块（供 AI 检索） ---------- */
  U.chunk = (text, size = 700) => {
    const paras = String(text || '')
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const out = [];
    let cur = '';
    for (const p of paras) {
      // 标题 / 过短的段落不单独成块，跟随下一段
      const tiny = p.length < 30 || /^#{1,6}\s/.test(p);
      if (!tiny && (cur + '\n\n' + p).length > size && cur) {
        out.push(cur);
        cur = p;
      } else {
        cur = cur ? cur + '\n\n' + p : p;
      }
    }
    if (cur) out.push(cur);
    // 超长段落硬切
    const final = [];
    for (const c of out) {
      if (c.length <= size * 1.8) final.push(c);
      else for (let i = 0; i < c.length; i += size) final.push(c.slice(i, i + size));
    }
    return final;
  };

  /* =========================================================
     UI 层：抽屉 / 弹窗 / 确认
     ========================================================= */
  const UI = { stack: [] };
  const layer = () => document.getElementById('layer');

  UI.closeTop = () => {
    const top = UI.stack.pop();
    if (!top) return;
    const { scrim, panel, onClose } = top;
    scrim.classList.remove('show');
    panel.classList.remove('show');
    setTimeout(() => {
      scrim.remove();
      panel.remove();
    }, 240);
    if (onClose) onClose();
  };
  UI.closeAll = () => {
    while (UI.stack.length) UI.closeTop();
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && UI.stack.length) {
      UI.closeTop();
    }
  });

  function base({ panelClass, panel, onClose }) {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.addEventListener('click', UI.closeTop);
    layer().appendChild(scrim);
    layer().appendChild(panel);
    requestAnimationFrame(() => {
      scrim.classList.add('show');
      panel.classList.add('show');
    });
    const entry = { scrim, panel, onClose };
    UI.stack.push(entry);
    return entry;
  }

  UI.drawer = ({ title = '', sub = '', tools = '', body = '', foot = '', onClose, onMount }) => {
    const panel = document.createElement('div');
    panel.className = 'sheet';
    panel.innerHTML = `
      <div class="sheet-head">
        <div class="st">
          <h2>${title}</h2>
          ${sub ? `<div class="sub">${sub}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;align-items:center">${tools}
          <button class="icon-btn" data-close title="关闭">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
      </div>
      <div class="sheet-body">${body}</div>
      ${foot ? `<div class="sheet-foot">${foot}</div>` : ''}`;
    panel.querySelector('[data-close]').addEventListener('click', UI.closeTop);
    base({ panel, panelClass: 'sheet', onClose });
    if (onMount) onMount(panel);
    return panel;
  };

  UI.modal = ({ title = '', sub = '', body = '', foot = '', wide = false, closable = true, onClose, onMount }) => {
    const panel = document.createElement('div');
    panel.className = 'modal' + (wide ? ' wide' : '');
    panel.innerHTML = `
      ${title ? `<div class="modal-head"><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>` : ''}
      <div class="modal-body">${body}</div>
      ${foot ? `<div class="modal-foot">${foot}</div>` : ''}`;
    const entry = base({ panel, panelClass: 'modal', onClose });
    if (!closable) entry.scrim.style.pointerEvents = 'none';
    if (onMount) onMount(panel);
    return panel;
  };

  UI.confirm = (opts = {}) =>
    new Promise((resolve) => {
      const { title = '确认操作', message = '', confirmText = '确定', danger = false } = opts;
      let done = false;
      const panel = UI.modal({
        title,
        body: `<p style="font-size:13px;color:var(--ink-2);line-height:1.7;margin:2px 0 10px">${message}</p>`,
        foot: `<div class="spacer"></div>
          <button class="btn ghost" data-cancel>取消</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${confirmText}</button>`,
        onClose: () => !done && resolve(false),
      });
      panel.querySelector('[data-cancel]').onclick = () => {
        done = true;
        UI.closeTop();
        resolve(false);
      };
      panel.querySelector('[data-ok]').onclick = () => {
        done = true;
        UI.closeTop();
        resolve(true);
      };
    });

  /** 收集容器内所有 [name] 的值 */
  UI.values = (root) => {
    const out = {};
    root.querySelectorAll('[name]').forEach((el) => {
      const k = el.getAttribute('name');
      if (el.type === 'checkbox') {
        out[k] = out[k] || [];
        if (el.checked) out[k].push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) out[k] = el.value;
      } else {
        out[k] = el.value;
      }
    });
    return out;
  };

  /* ---------- 图标 ---------- */
  const I = {
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.7 5 5 1.7-5 1.7L12 16.4 10.3 11.4l-5-1.7 5-1.7z"/><path d="M18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
    dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M8 7.5h7"/></svg>',
    target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h4"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1.2" fill="currentColor" stroke="none"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.5a3 3 0 0 1 0 5.8"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  };
  U.icon = (n) => (I[n] ? I[n].replace('<svg', '<svg class="ic"') : '');

  window.U = U;
  window.UI = UI;
})();
