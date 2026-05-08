/* ==============================================================
   Prototype Design Tokens · JS-injected
   ----------------------------------------------------------------
   为什么是 JS：在 file:// 模式下 Chrome 把每个文件当作独立 opaque
   origin —— 用 <link> 加载的 prototype-tokens.css 的 cssRules 会
   被禁止读取。SVG-foreignObject 截图工具依赖 cssRules 提取所有
   样式来内嵌进 SVG，外链 CSS 因此在截图里失踪。
   把 tokens 改成 <script> 在文档内动态创建 <style> 元素 —— 该
   元素属于"同文档来源"，cssRules 可读，截图可见。
   ============================================================== */
(function () {
  if (document.querySelector('style[data-prototype-tokens]')) return;

  const css = `
:root {
  /* ─── Brand / Primary ─── */
  --color-primary:        #368FFF;
  --color-primary-dark:   #1F82FF;
  --color-primary-bg:     #EDF4FF;
  --color-primary-soft:   #F6FBFF;
  --color-primary-border: #7EAFF1;
  --color-primary-shadow: rgba(54,143,255,0.12);
  --color-primary-glow:   rgba(54,143,255,0.08);

  --brand-primary:        #368FFF;
  --brand-hover:          #1F82FF;
  --brand-pressed:        #006FEE;
  --brand-disabled:       #7EAFF1;
  --brand-bg:             #EDF4FF;
  --brand-bg-light:       #F6FBFF;
  --brand-bg-active:      #EAF3FF;

  /* ─── Debate / Danger ─── */
  --color-debate:         #F53B3B;
  --color-debate-dark:    #D42929;
  --color-debate-bg:      rgba(245,59,59,0.08);
  --color-debate-soft:    rgba(245,59,59,0.3);

  --danger-primary:       #F53B3B;
  --danger-bg:            rgba(245,59,59,0.08);
  --danger-border:        rgba(245,59,59,0.3);

  /* ─── Discussion / Info ─── */
  --color-discussion:     #00A9F9;
  --color-discussion-dark:#0088D0;
  --color-discussion-bg:  rgba(0,169,249,0.1);
  --color-discussion-soft:rgba(0,169,249,0.3);

  --info-primary:         #00A9F9;
  --info-bg:              rgba(0,169,249,0.1);
  --info-border:          rgba(0,169,249,0.3);

  /* ─── Success ─── */
  --success-primary:      #24C366;
  --success-bg:           rgba(37,202,106,0.11);
  --success-border:       rgba(37,202,106,0.3);

  /* ─── Warning (state) ─── */
  --warning-primary:      #DEA21D;
  --warning-bg:           #FFFBF2;
  --warning-bg-medium:    #FFEFCD;
  --warning-accent:       #FFCB01;
  --warning-border:       rgba(222,162,29,0.3);

  /* ─── Prep / Mine (prototype-specific) ─── */
  --color-prep:           #b86b00;
  --color-prep-bg:        #fff5e8;
  --color-prep-soft:      #f0d878;

  --color-mine:           #7c5fc8;
  --color-mine-bg:        #efe8fb;
  --color-mine-soft:      #d8c8f0;

  /* ─── Meta bar (prototype UI chrome) ─── */
  --color-warn:           #6d5200;
  --color-warn-bg:        #fffbe8;
  --color-warn-border:    #f0d878;
  --color-warn-code:      #b35900;

  /* ─── Text ─── */
  --color-text:   #262626;
  --color-text-2: #556377;
  --color-text-3: #747884;
  --color-text-4: #8C8C8C;
  --color-text-5: #BFBFBF;
  --color-text-6: #aaa;
  --color-text-7: #ccc;

  --text-1:       #262626;
  --text-2:       #556377;
  --text-3:       #747884;
  --text-4:       #8C8C8C;
  --text-5:       #BFBFBF;
  --text-link:    #368FFF;
  --text-darkbg:  #FFFFFF;

  /* ─── Background ─── */
  --color-bg:      #F7F8FA;
  --color-bg-card: #FFFFFF;
  --color-bg-soft: #FAFAFA;
  --color-bg-mute: #F7F8FA;

  --bg-white:       #FFFFFF;
  --bg-page:        #F6FBFF;
  --bg-gray:        #F0F1F4;
  --bg-gray-light:  #F7F8FA;
  --bg-section:     #F6F6F6;
  --bg-hover:       #FAFAFA;
  --bg-selected:    #EAF3FF;
  --bg-tag:         #F1F6FF;
  --bg-info:        #EDF4FF;

  /* ─── Border / Mask ─── */
  --color-border:       #E5E6EB;
  --color-border-soft:  #F0F1F4;
  --color-border-faint: #F0F1F4;

  --border-primary: #E5E6EB;
  --border-light:   #F0F1F4;
  --border-input:   #DCDFE6;

  --mask-primary: rgba(0,0,0,0.5);
  --mask-heavy:   rgba(0,0,0,0.6);

  /* ─── Font Family ─── */
  --font-family:        'Source Han Sans SC', 'Source Han Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
  --font-family-base:   'Source Han Sans SC', 'Source Han Sans', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
  --font-family-number: 'D-DIN', 'Inter', 'Helvetica Neue', sans-serif;
  --font-mono:          ui-monospace, 'SF Mono', Menlo, Consolas, monospace;

  /* ─── Font Size (legacy px vars) ─── */
  --font-xs:   11px;
  --font-sm:   12px;
  --font-base: 13px;
  --font-md:   14px;
  --font-lg:   15px;
  --font-xl:   16px;
  --font-2xl:  18px;
  --font-3xl:  22px;

  /* ─── Semantic Typography ─── */
  --font-title-xl: 700 24px / 32px var(--font-family-base);
  --font-title-lg: 700 20px / 28px var(--font-family-base);
  --font-title-md: 500 18px / 26px var(--font-family-base);
  --font-title-sm: 500 16px / 28px var(--font-family-base);
  --font-body-lg:  400 16px / 28px var(--font-family-base);
  --font-body-md:  400 14px / 22px var(--font-family-base);
  --font-body-sm:  400 12px / 20px var(--font-family-base);
  --font-label-md: 500 14px / 22px var(--font-family-base);
  --font-label-sm: 500 12px / 18px var(--font-family-base);

  /* ─── Spacing ─── */
  --spacing-1:  2px;
  --spacing-2:  4px;
  --spacing-3:  6px;
  --spacing-4:  8px;
  --spacing-5:  10px;
  --spacing-6:  12px;
  --spacing-7:  14px;
  --spacing-8:  16px;
  --spacing-9:  20px;
  --spacing-10: 24px;
  --spacing-11: 28px;
  --spacing-12: 32px;
  --spacing-13: 40px;
  --spacing-14: 48px;
  --spacing-15: 72px;

  /* ─── Radius ─── */
  --radius-xs:      4px;
  --radius-sm:      6px;
  --radius-md:      8px;
  --radius-lg:      12px;
  --radius-xl:      14px;
  --radius-pill:    30px;
  --radius-round:   9999px;
  --radius-default: 8px;
  --radius-2xl:     16px;
  --radius-3xl:     20px;
  --radius-full:    30px;

  /* ─── Shadow ─── */
  --shadow-sm:         0px 1px 2px 0px rgba(0,0,0,0.05);
  --shadow-card:       0px 0px 10px 0px rgba(69,78,97,0.1);
  --shadow-card-hover: 0px 2px 8px 0px rgba(73,77,82,0.1);
  --shadow-md:         0px 2px 8px 0px rgba(73,77,82,0.1);
  --shadow-lg:         0px 0px 10px 0px rgba(69,78,97,0.1);
  --shadow-modal:      0px 20px 50px 0px rgba(0,0,0,0.1);
  --shadow-xl:         0px 20px 50px 0px rgba(0,0,0,0.1);
  --shadow-fab:        0px 8px 22px rgba(54,143,255,0.28);

  /* ─── Z-index ─── */
  --z-base:     0;
  --z-float:    10;
  --z-dropdown: 100;
  --z-drawer:   200;
  --z-modal:    300;
  --z-toast:    400;
  --z-loading:  500;
  --z-tooltip:  600;

  /* ─── Layout ─── */
  --topbar-height:  60px;
  --container-grid: 1200px;
  --container-wide: 1180px;
  --container-mid:  1080px;
  --container-list: 960px;
  --container-form: 820px;
}

*, *::before, *::after { box-sizing: border-box; }
* { margin: 0; padding: 0; }
body {
  font-family: var(--font-family);
  font-size: var(--font-md);
  line-height: 1.5;
  color: var(--color-text);
  background: var(--color-bg);
  min-height: 100vh;
}
a { color: inherit; text-decoration: none; }
button { font-family: inherit; cursor: pointer; border: none; background: none; }
input, textarea, select { font-family: inherit; }
code { font-family: var(--font-mono); font-size: var(--font-xs); }

.meta-bar {
  background: var(--color-warn-bg);
  border-bottom: 1px solid var(--color-warn-border);
  padding: 8px 32px;
  font-size: var(--font-sm);
  color: var(--color-warn);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.meta-bar code {
  background: var(--color-bg-card);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: var(--font-xs);
  color: var(--color-warn-code);
}

.topbar {
  position: sticky; top: 0; z-index: var(--z-float);
  display: flex;
  align-items: center;
  height: var(--topbar-height);
  padding: 0 32px;
  background: var(--color-bg-card);
  border-bottom: 1px solid var(--color-border);
  gap: 12px;
}
.topbar.topbar-grid {
  display: grid;
  grid-template-columns: 200px 1fr 180px;
  align-items: center;
}
.brand { font-size: 17px; font-weight: 600; color: var(--color-primary); }
.back-link {
  font-size: var(--font-base);
  color: var(--color-primary);
  padding: 6px 10px;
  border-radius: var(--radius-sm);
  transition: background 0.15s;
}
.back-link:hover { background: var(--color-primary-bg); }
.crumb-sep { color: var(--color-text-7); font-size: var(--font-sm); }
.crumb { font-size: var(--font-base); color: var(--color-text-3); }
.page-title { font-size: var(--font-xl); font-weight: 600; color: var(--color-text); }
.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 14px;
}
.topbar-action {
  padding: 6px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  color: var(--color-text-3);
  background: var(--color-bg-card);
  transition: all 0.15s;
}
.topbar-action:hover { border-color: var(--color-primary); color: var(--color-primary); }
.topbar-action.primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.topbar-action.primary:hover { background: var(--color-primary-dark); border-color: var(--color-primary-dark); }
.topbar-action.danger:hover { border-color: var(--color-debate); color: var(--color-debate); }

.type-badge {
  display: inline-block;
  font-size: var(--font-xs);
  padding: 3px 9px;
  border-radius: var(--radius-lg);
  font-weight: 500;
  letter-spacing: 0.2px;
  line-height: 1.5;
}
.type-badge.dialogue   { background: var(--color-primary-bg);    color: var(--color-primary); }
.type-badge.scenario   { background: var(--color-debate-bg);     color: var(--color-debate); }
.type-badge.debate     { background: var(--color-debate-bg);     color: var(--color-debate); }
.type-badge.discussion { background: var(--color-discussion-bg); color: var(--color-discussion); }
.type-badge.prep       { background: var(--color-prep-bg);       color: var(--color-prep); }
.type-badge.mine       { background: var(--color-mine-bg);       color: var(--color-mine); }
.subject-badge {
  display: inline-block;
  font-size: var(--font-xs);
  padding: 2px 8px;
  border-radius: var(--radius-md);
  background: var(--color-bg);
  color: var(--color-text-4);
  font-weight: 500;
  line-height: 1.5;
}

.section-title {
  font-size: var(--font-md);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.section-title::before {
  content: "";
  width: 3px; height: 14px;
  background: var(--color-primary);
}
.section-title.discussion::before { background: var(--color-discussion); }
.section-title.debate::before     { background: var(--color-debate); }
.section-tag, .section-title .tag {
  font-size: var(--font-xs);
  color: var(--color-text-5);
  font-weight: normal;
  padding: 2px 8px;
  background: var(--color-border-soft);
  border-radius: var(--radius-pill);
}

.btn-primary {
  padding: 10px 24px;
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: var(--font-base);
  font-weight: 500;
  transition: all 0.15s;
}
.btn-primary:hover {
  background: var(--color-primary-dark);
  box-shadow: 0 4px 12px var(--color-primary-shadow);
}
.btn-secondary {
  padding: 10px 24px;
  background: var(--color-bg-card);
  color: var(--color-text-3);
  border-radius: var(--radius-sm);
  font-size: var(--font-base);
  border: 1px solid var(--color-border);
  transition: all 0.15s;
}
.btn-secondary:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.btn-ghost {
  padding: 10px 18px;
  background: transparent;
  color: var(--color-text-5);
  font-size: var(--font-base);
}
.btn-ghost:hover { color: var(--color-debate); }
.btn-danger {
  padding: 7px 14px;
  background: var(--color-bg-card);
  color: var(--color-debate);
  border: 1px solid var(--color-debate-soft);
  border-radius: var(--radius-sm);
  font-size: var(--font-sm);
  transition: all 0.15s;
}
.btn-danger:hover {
  background: var(--color-debate-bg);
  border-color: var(--color-debate);
}

.filter-chip {
  padding: 5px 14px;
  font-size: var(--font-sm);
  color: var(--color-text-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-bg-card);
  transition: all 0.15s;
}
.filter-chip:hover { color: var(--color-primary); border-color: var(--color-primary); }
.filter-chip.active {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.filter-chip.mine-chip:hover { color: var(--color-mine); border-color: var(--color-mine); }
.filter-chip.mine-chip.active {
  background: var(--color-mine);
  border-color: var(--color-mine);
}

.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 10px 20px;
  background: var(--color-text);
  color: #fff;
  border-radius: var(--radius-sm);
  font-size: var(--font-base);
  opacity: 0;
  pointer-events: none;
  transition: all 0.25s;
  z-index: var(--z-toast);
}
.toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

.modal-mask {
  position: fixed;
  inset: 0;
  background: var(--mask-primary);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
}
.modal-mask.show { display: flex; }
.modal {
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  width: 360px;
  padding: 24px;
  box-shadow: var(--shadow-xl);
}
.modal h3 {
  font-size: var(--font-xl);
  margin-bottom: 8px;
}
.modal p {
  font-size: var(--font-base);
  color: var(--color-text-3);
  margin-bottom: 18px;
}

.form-field {
  margin-bottom: 24px;
}
.form-field > label {
  display: block;
  font-size: var(--font-base);
  font-weight: 500;
  margin-bottom: 6px;
  color: #444;
}
.required { color: var(--color-debate); }
.form-field input[type="text"],
.form-field input[type="number"],
.form-field select,
.form-field textarea {
  width: 100%;
  padding: 9px 12px;
  border: 1px solid var(--border-input);
  border-radius: var(--radius-md);
  font-family: inherit;
  font-size: var(--font-base);
  outline: none;
  transition: border-color 0.15s;
  background: var(--color-bg-card);
  color: var(--color-text);
}
.form-field input[type="text"]:focus,
.form-field input[type="number"]:focus,
.form-field select:focus,
.form-field textarea:focus { border-color: var(--color-primary); }
.form-field textarea {
  resize: vertical;
  min-height: 90px;
  line-height: 1.6;
}
.hint { font-size: var(--font-xs); color: var(--color-text-5); margin-top: 6px; }
.hint-inline { font-size: var(--font-sm); color: var(--color-text-4); white-space: nowrap; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

.step-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 24px;
  margin-top: 28px;
  border-top: 1px solid var(--color-border-soft);
}
.step-actions .left,
.step-actions .right { display: flex; gap: 8px; }

/* ============ 线上界面参考图（使用页评审用）============ */
.reference-image {
  background: var(--color-bg-soft);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  margin-bottom: 16px;
  font-size: var(--font-sm);
  color: var(--color-text-3);
}
.reference-image > summary {
  cursor: pointer;
  font-weight: 500;
  user-select: none;
  padding: 4px 0;
  list-style: none;
}
.reference-image > summary::-webkit-details-marker { display: none; }
.reference-image > summary::before {
  content: '▸';
  margin-right: 6px;
  display: inline-block;
  transition: transform 0.15s;
  color: var(--color-text-5);
}
.reference-image[open] > summary::before { transform: rotate(90deg); }
.reference-image img {
  margin-top: 12px;
  max-width: 480px;
  width: 100%;
  border-radius: var(--radius-md);
  display: block;
  border: 1px solid var(--color-border);
}
.reference-image .ref-note {
  margin-top: 8px;
  color: var(--color-text-5);
  font-size: var(--font-xs);
  line-height: 1.5;
}
body.proto-capturing .reference-image { display: none !important; }
`;

  const style = document.createElement('style');
  style.setAttribute('data-prototype-tokens', '');
  style.textContent = css;
  // 同步插入到 head 末尾，但仍位于内联 <style> 之前（因为内联还没解析到）
  // 最终顺序：tokens-style → 页面 inline <style>，inline 后加载赢，
  // 可以覆盖 tokens（如讨论页 :root 重绑主色）
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.documentElement.appendChild(style);
  }
})();
