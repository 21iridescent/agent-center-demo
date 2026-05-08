/**
 * 评审用 PRD 侧边栏（自注入式）
 *
 * 用法：在每个页面里
 *   1. <script src="prototype-review-panel.js"></script>
 *   2. <script>window.PRD_REVIEW_DATA = { pageName, groups: [...] }</script>
 *
 * 数据结构（以"功能 → 子项"两层组织）：
 *   {
 *     pageName: '智能体广场',
 *     groups: [
 *       {
 *         title: '大 Banner 位',
 *         items: [
 *           {
 *             target: '.banner-card.moke',  // 可选，CSS 选择器；点项目时高亮该元素
 *             title: '智能导师·磨课 Banner',
 *             how:  '点击大卡任意位置',
 *             what: '新窗口打开外链；本期先做链接，后续做数据保存',
 *             from: '固定占位 1；右上"外链"角标提醒教师将跳出本系统'
 *           }
 *         ]
 *       }
 *     ]
 *   }
 */
(function () {
  if (window.__prdPanelInjected) return;
  window.__prdPanelInjected = true;

  // -------- CSS 注入 --------
  const css = document.createElement('style');
  css.textContent = `
    .prd-panel-toggle {
      position: fixed; right: 0; top: 50%;
      transform: translateY(-50%);
      writing-mode: vertical-rl;
      text-orientation: mixed;
      background: #2a8c85;
      color: #fff;
      padding: 16px 9px;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      z-index: 480;
      font-size: 13px;
      letter-spacing: 3px;
      font-weight: 500;
      box-shadow: -2px 4px 12px rgba(0,0,0,0.18);
      border: none;
      font-family: inherit;
      transition: right 0.25s ease-out, background 0.15s;
    }
    .prd-panel-toggle:hover { background: #226e68; }
    .prd-panel.open ~ .prd-panel-toggle { right: 380px; }

    .prd-panel {
      position: fixed; right: -380px; top: 0; bottom: 0;
      width: 380px;
      background: #fff;
      border-left: 1px solid #e0dcd6;
      box-shadow: -4px 0 24px rgba(0,0,0,0.10);
      z-index: 490;
      transition: right 0.25s ease-out;
      display: flex; flex-direction: column;
      font-family: 'PingFang SC', 'Microsoft YaHei', 'Helvetica Neue', sans-serif;
      font-size: 13px;
      color: #333;
    }
    .prd-panel.open { right: 0; }

    .prd-panel-header {
      padding: 14px 16px;
      border-bottom: 1px solid #e0dcd6;
      display: flex; align-items: center; gap: 8px;
      background: #f7f5f1;
      flex-shrink: 0;
    }
    .prd-panel-title {
      font-weight: 600;
      font-size: 14px;
      flex: 1;
      color: #2a8c85;
    }
    .prd-panel-actions { display: flex; gap: 4px; }
    .prd-panel-btn {
      padding: 4px 8px;
      font-size: 11px;
      color: #666;
      background: transparent;
      border: 1px solid #d0ccc4;
      border-radius: 4px;
      cursor: pointer;
      font-family: inherit;
    }
    .prd-panel-btn:hover { background: #fff; color: #2a8c85; border-color: #2a8c85; }

    .prd-panel-close {
      width: 26px; height: 26px;
      border-radius: 4px;
      cursor: pointer;
      background: transparent;
      border: none;
      font-size: 20px;
      line-height: 1;
      color: #888;
      font-family: inherit;
    }
    .prd-panel-close:hover { background: #fff; color: #333; }

    .prd-panel-body {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }

    .prd-group {
      margin-bottom: 8px;
      border: 1px solid #e8e4de;
      border-radius: 8px;
      overflow: hidden;
      background: #fff;
    }
    .prd-group-head {
      padding: 10px 12px;
      background: #f7f5f1;
      cursor: pointer;
      display: flex; align-items: center; gap: 6px;
      font-weight: 600;
      font-size: 13px;
      user-select: none;
      color: #444;
    }
    .prd-group-head:hover { background: #f0ece7; }
    .prd-group-head::before {
      content: '▸';
      font-size: 10px;
      transition: transform 0.15s;
      color: #888;
      flex-shrink: 0;
    }
    .prd-group.open .prd-group-head::before { transform: rotate(90deg); }
    .prd-group-count {
      margin-left: auto;
      font-size: 11px;
      color: #999;
      font-weight: 400;
    }
    .prd-group-body {
      display: none;
      padding: 6px;
      background: #fafaf8;
    }
    .prd-group.open .prd-group-body { display: block; }

    .prd-item {
      padding: 10px;
      background: #fff;
      border: 1px solid #e8e4de;
      border-radius: 6px;
      cursor: pointer;
      margin-bottom: 6px;
      transition: all 0.15s;
    }
    .prd-item:last-child { margin-bottom: 0; }
    .prd-item:hover { border-color: #b8d8d3; box-shadow: 0 2px 6px rgba(42,140,133,0.08); }
    .prd-item.active {
      background: #e8f3f2;
      border-color: #2a8c85;
      box-shadow: 0 2px 8px rgba(42,140,133,0.15);
    }
    .prd-item-title {
      font-weight: 600;
      margin-bottom: 8px;
      font-size: 13px;
      color: #2a8c85;
    }
    .prd-item-row {
      display: flex;
      gap: 6px;
      margin-bottom: 4px;
      line-height: 1.55;
    }
    .prd-item-row:last-child { margin-bottom: 0; }
    .prd-item-label {
      flex-shrink: 0;
      width: 52px;
      font-size: 11px;
      color: #888;
      font-weight: 500;
      padding-top: 1px;
    }
    .prd-item-value {
      flex: 1;
      font-size: 12px;
      color: #555;
      word-break: break-word;
    }
    .prd-item-no-target {
      opacity: 0.85;
      cursor: default;
    }
    .prd-item-no-target:hover { box-shadow: none; border-color: #e8e4de; }

    .prd-empty {
      padding: 40px 20px;
      text-align: center;
      color: #999;
      font-size: 13px;
    }

    /* 高亮被指向的页面元素 */
    .prd-highlight {
      outline: 3px solid #2a8c85 !important;
      outline-offset: 4px;
      box-shadow: 0 0 0 9999px rgba(0,0,0,0.20) !important;
      position: relative;
      z-index: 100;
      border-radius: 8px;
      transition: outline 0.15s, box-shadow 0.2s;
    }

    /* 截图时隐藏（沿用 prototype-capture.js 的 proto-capturing class） */
    body.proto-capturing .prd-panel,
    body.proto-capturing .prd-panel-toggle { display: none !important; }
  `;
  document.head.appendChild(css);

  // -------- 主逻辑 --------
  function init() {
    const data = window.PRD_REVIEW_DATA;
    if (!data || !Array.isArray(data.groups)) return;

    const panel = document.createElement('aside');
    panel.className = 'prd-panel';
    panel.innerHTML = `
      <div class="prd-panel-header">
        <span class="prd-panel-title">${escapeHtml(data.pageName || '当前页')} · 评审说明</span>
        <div class="prd-panel-actions">
          <button class="prd-panel-btn" data-act="expand-all">全展</button>
          <button class="prd-panel-btn" data-act="collapse-all">全收</button>
        </div>
        <button class="prd-panel-close" aria-label="关闭" data-act="close">×</button>
      </div>
      <div class="prd-panel-body" id="prdPanelBody"></div>
    `;
    document.body.appendChild(panel);

    const toggle = document.createElement('button');
    toggle.className = 'prd-panel-toggle';
    toggle.textContent = '评审说明';
    document.body.appendChild(toggle);

    const body = panel.querySelector('#prdPanelBody');
    body.innerHTML = renderGroups(data.groups);

    // 切换面板开合
    toggle.addEventListener('click', () => {
      panel.classList.toggle('open');
      toggle.textContent = panel.classList.contains('open') ? '收起说明' : '评审说明';
    });

    // 头部按钮
    panel.querySelector('[data-act="close"]').addEventListener('click', () => {
      panel.classList.remove('open');
      toggle.textContent = '评审说明';
    });
    panel.querySelector('[data-act="expand-all"]').addEventListener('click', () => {
      panel.querySelectorAll('.prd-group').forEach(g => g.classList.add('open'));
    });
    panel.querySelector('[data-act="collapse-all"]').addEventListener('click', () => {
      panel.querySelectorAll('.prd-group').forEach(g => g.classList.remove('open'));
    });

    // 分组折叠
    panel.querySelectorAll('.prd-group-head').forEach(h => {
      h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
    });

    // 项目点击：高亮目标元素 + 滚到视口
    let lastHighlight = null;
    let lastTimer = null;
    panel.querySelectorAll('.prd-item').forEach(item => {
      item.addEventListener('click', () => {
        panel.querySelectorAll('.prd-item.active').forEach(a => a.classList.remove('active'));
        item.classList.add('active');

        if (lastHighlight) {
          lastHighlight.classList.remove('prd-highlight');
          lastHighlight = null;
        }
        if (lastTimer) clearTimeout(lastTimer);

        const sel = item.dataset.target;
        if (!sel) return;
        const target = document.querySelector(sel);
        if (!target) return;
        target.classList.add('prd-highlight');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        lastHighlight = target;
        lastTimer = setTimeout(() => {
          target.classList.remove('prd-highlight');
          if (lastHighlight === target) lastHighlight = null;
        }, 2800);
      });
    });
  }

  function renderGroups(groups) {
    if (!groups.length) return '<div class="prd-empty">本页暂无说明数据</div>';
    return groups.map((g, gi) => `
      <div class="prd-group ${gi === 0 ? 'open' : ''}">
        <div class="prd-group-head">
          ${escapeHtml(g.title || '未命名分组')}
          <span class="prd-group-count">${g.items?.length || 0}</span>
        </div>
        <div class="prd-group-body">
          ${(g.items || []).map(it => `
            <div class="prd-item ${it.target ? '' : 'prd-item-no-target'}" data-target="${it.target ? escapeAttr(it.target) : ''}">
              <div class="prd-item-title">${escapeHtml(it.title || '未命名')}</div>
              <div class="prd-item-row"><span class="prd-item-label">怎么点</span><span class="prd-item-value">${escapeHtml(it.how || '—')}</span></div>
              <div class="prd-item-row"><span class="prd-item-label">点了啥</span><span class="prd-item-value">${escapeHtml(it.what || '—')}</span></div>
              <div class="prd-item-row"><span class="prd-item-label">字段来源</span><span class="prd-item-value">${escapeHtml(it.from || '—')}</span></div>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function escapeAttr(s) {
    return String(s ?? '').replace(/"/g, '&quot;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
