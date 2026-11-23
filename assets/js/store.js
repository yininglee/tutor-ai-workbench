/* =========================================================
   数据层：统一状态 + 自动保存（服务端文件 / 本地缓存双通道）
   ========================================================= */
(function () {
  const LS_KEY = 'tutor-workbench-v1';
  const ARTIFACTS = [
    { key: 'analysis', label: '课前学情分析', short: '学情', icon: 'target', hint: '上次课掌握情况 · 本次课切入点 · 重点关注' },
    { key: 'prep', label: '课前习题', short: '习题', icon: 'list', hint: '上次课复盘题 / 本次课热身题，含答案' },
    { key: 'plan', label: '教案', short: '教案', icon: 'book', hint: '教学目标 · 重难点 · 流程 · 例题' },
    { key: 'summary', label: '课后总结', short: '总结', icon: 'doc', hint: '课堂表现 · 掌握情况 · 下次课安排' },
  ];
  window.ARTIFACTS = ARTIFACTS;

  function blankState() {
    return {
      version: 1,
      settings: {
        theme: 'light',
        tutorName: '',
        ai: { mode: 'builtin', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temperature: 0.6 },
      },
      materials: [],
      questions: [],
      students: [],
      sessions: [],
      schedule: [],
    };
  }

  function normalize(s) {
    const b = blankState();
    if (!s || typeof s !== 'object') return b;
    b.settings = Object.assign(b.settings, s.settings || {});
    b.settings.ai = Object.assign(blankState().settings.ai, (s.settings || {}).ai || {});
    for (const k of ['materials', 'questions', 'students', 'sessions', 'schedule']) {
      b[k] = Array.isArray(s[k]) ? s[k] : [];
    }
    b.students = b.students.map((st) => ({
      profile: {},
      logs: [],
      ...st,
      profile: { subjects: [], weakPoints: [], ...(st.profile || {}) },
      logs: Array.isArray(st.logs) ? st.logs : [],
    }));
    b.sessions = b.sessions.map((se) => ({ artifacts: {}, ...se, artifacts: se.artifacts || {} }));
    return b;
  }

  const Store = {
    state: blankState(),
    rev: 0,
    mode: 'local',
    ai: { hasKey: false, baseUrl: '', model: '', keyHint: '' },
    saving: false,
    pending: false,
    lastSaved: null,
    _subs: [],

    /* ---------- 初始化 ---------- */
    async init() {
      try {
        const r = await fetch('/api/state', { cache: 'no-store' });
        if (!r.ok) throw new Error('no api');
        const d = await r.json();
        this.mode = 'server';
        this.rev = d.rev || 0;
        this.state = normalize(d.state);
        this.ai = d.ai || this.ai;
        if (!d.state) await this.flushNow(); // 首次运行落盘
      } catch (e) {
        this.mode = 'local';
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) this.state = normalize(JSON.parse(raw));
        } catch (e2) {}
      }
      // 主题
      const theme = this.state.settings.theme || 'light';
      document.documentElement.dataset.theme = theme;
      // 轮询外部变更（例如 WorkBuddy Agent 直接写入 data/workbench.json）
      if (this.mode === 'server') {
        setInterval(() => this.poll(), 5000);
        window.addEventListener('focus', () => this.poll());
      }
      this.renderSync();
      return this;
    },

    get() {
      return this.state;
    },

    subscribe(fn) {
      this._subs.push(fn);
    },
    emit() {
      this._subs.forEach((f) => {
        try {
          f(this.state);
        } catch (e) {
          console.error(e);
        }
      });
    },

    /* ---------- 保存 ---------- */
    markDirty() {
      this.renderSync('saving');
      if (this.mode === 'server') {
        if (this._t) clearTimeout(this._t);
        this._t = setTimeout(() => this.flushNow(), 450);
      } else {
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(this.state));
          this.lastSaved = new Date().toISOString();
          this.renderSync();
        } catch (e) {
          U.toast('本地存储空间不足，建议用「启动工作台」运行', 'err');
        }
      }
    },

    async flushNow() {
      if (this.mode !== 'server') return;
      if (this.saving) {
        this.pending = true;
        return;
      }
      this.saving = true;
      const body = JSON.stringify({ rev: this.rev, state: this.state });
      try {
        const r = await fetch('/api/state', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body,
        });
        if (r.status === 409) {
          const d = await r.json();
          this.rev = d.rev;
          this.state = normalize(d.state);
          this.emit();
          U.toast('数据已被外部更新，已重新载入');
        } else if (r.ok) {
          const d = await r.json();
          this.rev = d.rev;
          this.lastSaved = d.updatedAt;
        } else {
          U.toast('保存失败，请检查服务是否运行', 'err');
        }
      } catch (e) {
        U.toast('无法连接本地服务，已暂存浏览器', 'err');
        try {
          localStorage.setItem(LS_KEY, JSON.stringify(this.state));
        } catch (e2) {}
      } finally {
        this.saving = false;
        this.renderSync();
        if (this.pending) {
          this.pending = false;
          this.flushNow();
        }
      }
    },

    async poll() {
      if (this.mode !== 'server') return;
      try {
        const r = await fetch('/api/state', { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        if (d.rev && d.rev !== this.rev) {
          // 有弹窗/抽屉时不打断用户
          if (UI.stack.length) return;
          this.rev = d.rev;
          this.state = normalize(d.state);
          this.ai = d.ai || this.ai;
          this.emit();
        }
      } catch (e) {}
    },

    renderSync(force) {
      const el = document.getElementById('syncState');
      if (!el) return;
      let cls = '',
        txt = '';
      if (force === 'saving') {
        cls = '';
        txt = '保存中…';
      } else if (this.mode === 'server') {
        cls = 'ok';
        txt = '已保存 · 本机文件';
      } else {
        cls = 'warn';
        txt = '浏览器本地模式';
      }
      el.className = 'sync ' + cls;
      el.querySelector('span').textContent = txt;
      el.title =
        this.mode === 'server'
          ? '数据保存在 data/workbench.json，可随时打包/被 AI 读取'
          : '未检测到本地服务，数据存在浏览器缓存中';
    },

    /* ---------- 变更入口 ---------- */
    commit(fn) {
      fn(this.state);
      this.markDirty();
    },

    /* ---------- 常用查询 ---------- */
    student(id) {
      return this.state.students.find((s) => s.id === id) || null;
    },
    sessionsOf(studentId) {
      return this.state.sessions
        .filter((s) => s.studentId === studentId)
        .sort((a, b) => a.index - b.index);
    },
    sessionById(id) {
      return this.state.sessions.find((s) => s.id === id) || null;
    },
    nextIndex(studentId) {
      const list = this.sessionsOf(studentId);
      return list.length ? Math.max(...list.map((s) => s.index)) + 1 : 1;
    },
    ensureSession(studentId, date) {
      const idx = this.nextIndex(studentId);
      const se = {
        id: U.uid('se'),
        studentId,
        index: idx,
        date: date || U.today(),
        topic: '',
        status: 'planned',
        artifacts: {},
        createdAt: new Date().toISOString(),
      };
      this.state.sessions.push(se);
      return se;
    },
    material(id) {
      return this.state.materials.find((m) => m.id === id) || null;
    },
    question(id) {
      return this.state.questions.find((q) => q.id === id) || null;
    },
    lessonsOn(dateStr) {
      return this.state.schedule
        .filter((l) => l.date === dateStr)
        .sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    },

    /* ---------- 导入导出 ---------- */
    exportFile() {
      const stamp = new Date().toISOString().slice(0, 10);
      U.download(`家教工作台数据-${stamp}.json`, JSON.stringify(this.state, null, 2));
    },
    async importFile(file) {
      const text = await U.fileToText(file);
      const data = JSON.parse(text);
      const next = normalize(data.state && data.state.students ? data.state : data);
      this.state = next;
      document.documentElement.dataset.theme = next.settings.theme || 'light';
      this.markDirty();
      this.emit();
    },
  };

  window.Store = Store;

  /* =========================================================
     示例数据
     ========================================================= */
  window.demoState = function () {
    const now = new Date().toISOString();
    const day = (n) => U.addDays(U.today(), n);
    const stu1 = {
      id: 'stu_demo1',
      name: '林小满',
      createdAt: now,
      profile: {
        grade: '初二',
        school: '市第二实验中学',
        subjects: ['数学', '物理'],
        progress: '八年级上册 第 3 章「一次函数」',
        situation: '计算基础扎实，几何直观偏弱；做题快但书写步骤跳跃，常因步骤丢分。',
        goal: '期末数学进入班级前 10，物理稳定 85 分以上。',
        weakPoints: ['一次函数图像', '辅助线构造', '审题'],
        habits: '专注时长约 25 分钟，需要中途切换题型；对可视化讲解接受度高。',
        parentName: '林妈妈',
        parentPhone: '138****2210',
        notes: '家长关注度较高，每两节课沟通一次。',
      },
      logs: [
        { id: 'log1', date: day(-9), type: '家长沟通', content: '反馈最近作业完成度下降，约定每节课后发一条课堂小结。' },
        { id: 'log2', date: day(-2), type: '课堂反馈', content: '本次课函数图像理解明显提升，但应用题建模仍需引导。' },
      ],
    };
    const stu2 = {
      id: 'stu_demo2',
      name: '周予安',
      createdAt: now,
      profile: {
        grade: '高一',
        school: '外国语学校',
        subjects: ['英语'],
        progress: '必修一 Unit 3，语法：定语从句',
        situation: '词汇量尚可，长难句拆解吃力，写作缺少高级句式。',
        goal: '期中 120 分以上，作文稳定 20+。',
        weakPoints: ['定语从句', '长难句', '写作结构'],
        habits: '自律性好，喜欢按清单推进，适合给明确任务量。',
        parentName: '周爸爸',
        parentPhone: '139****8802',
        notes: '',
      },
      logs: [],
    };

    const s1 = { id: 'se1', studentId: 'stu_demo1', index: 1, date: day(-14), topic: '一次函数的概念与图像', status: 'done' };
    s1.artifacts = {
      analysis: { content: '## 学情分析\n\n- 上次课（方程与不等式）掌握良好，计算准确率约 90%。\n- 图像题读图习惯尚未建立，需要先建立「形 → 数」的对应直觉。\n- **本次课切入点**：从生活中的匀速运动引入 $y=kx+b$。', updatedAt: now, source: 'ai' },
      prep: { content: '## 课前习题\n\n1. 已知 $y=2x-3$，当 $x=1$ 时，$y=$ ____。\n2. 画出 $y=-x+2$ 的图像，并说出它与坐标轴的交点。\n\n> 答案见课后总结附录。', updatedAt: now, source: 'ai' },
      plan: { content: '## 教案\n\n### 教学目标\n1. 理解一次函数定义与 $k,b$ 的几何意义。\n2. 能由图像读出解析式。\n\n### 教学流程\n| 环节 | 时长 | 内容 |\n| --- | --- | --- |\n| 导入 | 8min | 出租车计费问题 |\n| 新授 | 25min | $k$ 与倾斜方向、$b$ 与截距 |\n| 练习 | 20min | 图像 ↔ 解析式互译 |\n| 小结 | 7min | 思维导图回顾 |', updatedAt: now, source: 'ai' },
      summary: { content: '## 课后总结\n\n- **完成度**：教案全部完成，练习正确率 8/10。\n- 学生能独立由图像读出 $k$ 的符号，但截距概念仍需强化。\n- 下次课先从「截距的几何意义」切入，再做 3 道综合题。', updatedAt: now, source: 'ai' },
    };
    const s2 = { id: 'se2', studentId: 'stu_demo1', index: 2, date: day(-7), topic: '一次函数与方程、不等式', status: 'done' };
    s2.artifacts = {
      analysis: { content: '## 学情分析\n\n- 上节课图像识别达标，截距概念模糊。\n- 本次课把「交点」与「方程解」打通。', updatedAt: now, source: 'ai' },
      prep: { content: '## 课前习题\n\n1. 求 $y=3x-6$ 与 $x$ 轴的交点坐标。\n2. 用图像法解 $2x+1 > 5$。', updatedAt: now, source: 'ai' },
      plan: { content: '## 教案\n\n### 重难点\n- 重点：图像交点与方程解的一一对应。\n- 难点：含参讨论。\n\n### 流程\n1. 复习截距（10min）\n2. 交点 → 方程解（20min）\n3. 图像法解不等式（20min）\n4. 当堂检测（10min）', updatedAt: now, source: 'ai' },
    };
    const s3 = { id: 'se3', studentId: 'stu_demo1', index: 3, date: day(1), topic: '一次函数的实际应用', status: 'planned' };
    s3.artifacts = {};
    const s4 = { id: 'se4', studentId: 'stu_demo2', index: 1, date: day(-5), topic: '定语从句入门', status: 'done' };
    s4.artifacts = {
      analysis: { content: '## 学情分析\n\n- 词汇基础 OK，句子成分识别不清。\n- 本次课先补「主谓宾」再讲关系代词。', updatedAt: now, source: 'manual' },
    };

    return normalize({
      settings: { theme: 'light', tutorName: '', ai: { mode: 'builtin', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', temperature: 0.6 } },
      materials: [
        {
          id: 'mat_demo1',
          title: '人教版八年级上册 · 一次函数（节选）',
          subject: '数学',
          grade: '初二',
          type: 'md',
          fileName: '一次函数.md',
          size: 3200,
          chars: 1200,
          createdAt: now,
          text:
            '## 19.2 一次函数\n\n一般地，形如 $y=kx+b$（$k\\neq 0$，$k,b$ 为常数）的函数，叫做一次函数。当 $b=0$ 时，$y=kx$ 是正比例函数。\n\n### 图像与性质\n\n一次函数的图像是一条直线。$k>0$ 时，$y$ 随 $x$ 增大而增大；$k<0$ 时，$y$ 随 $x$ 增大而减小。$b$ 是直线与 $y$ 轴交点的纵坐标，称为截距。\n\n### 待定系数法\n\n已知两点坐标，可设 $y=kx+b$，代入得到二元一次方程组，解出 $k,b$。\n\n### 与方程、不等式的联系\n\n直线 $y=kx+b$ 与 $x$ 轴交点的横坐标，就是方程 $kx+b=0$ 的解；图像在 $x$ 轴上方的部分对应不等式 $kx+b>0$ 的解集。',
          chunks: [],
        },
      ],
      questions: [
        { id: 'q1', subject: '数学', grade: '初二', type: '解答', difficulty: 2, stem: '已知一次函数 $y=2x-4$。\n(1) 求它与坐标轴的交点；\n(2) 画出图像。', answer: '(1) 与 $x$ 轴交于 $(2,0)$，与 $y$ 轴交于 $(0,-4)$。', analysis: '令 $y=0$ 求横截距，令 $x=0$ 求纵截距。', tags: ['截距', '图像'], source: 'demo', createdAt: now },
        { id: 'q2', subject: '数学', grade: '初二', type: '选择', difficulty: 1, stem: '下列函数中，$y$ 随 $x$ 增大而减小的是（ ）\nA. $y=3x+1$  B. $y=-2x+5$  C. $y=x$  D. $y=0.5x-2$', answer: 'B', analysis: '$k<0$ 时单调递减。', tags: ['单调性'], source: 'demo', createdAt: now },
        { id: 'q3', subject: '数学', grade: '初二', type: '解答', difficulty: 3, stem: '某出租车计费：起步价 10 元含 3 公里，超出部分每公里 2.4 元。写出车费 $y$（元）与里程 $x$（公里，$x\\ge 3$）的函数关系式。', answer: '$y=2.4x+2.8$', analysis: '超出部分为 $2.4(x-3)$，加上起步价：$10+2.4(x-3)=2.4x+2.8$。', tags: ['建模', '实际应用'], source: 'demo', createdAt: now },
        { id: 'q4', subject: '英语', grade: '高一', type: '选择', difficulty: 2, stem: 'The book ___ I bought yesterday is very interesting.\nA. who  B. whom  C. which  D. what', answer: 'C', analysis: '先行词 book 为物，关系代词作宾语用 which/that。', tags: ['定语从句'], source: 'demo', createdAt: now },
      ],
      students: [stu1, stu2],
      sessions: [s1, s2, s3, s4],
      schedule: [
        { id: 'l1', studentId: 'stu_demo1', date: day(1), start: '19:00', end: '20:30', subject: '数学', location: '线上 · 腾讯会议', status: 'planned', note: '一次函数实际应用' },
        { id: 'l2', studentId: 'stu_demo2', date: day(2), start: '16:00', end: '17:30', subject: '英语', location: '学生家', status: 'planned', note: '定语从句练习' },
        { id: 'l3', studentId: 'stu_demo1', date: day(-7), start: '19:00', end: '20:30', subject: '数学', location: '线上', status: 'done', note: '' },
      ],
    });
  };
})();
