/* ==============================================================
   Prototype Screen Capture · v0.2
   ----------------------------------------------------------------
   用 navigator.mediaDevices.getDisplayMedia() 拿浏览器渲染的真实
   像素，跳过任何 DOM 序列化、SVG-foreignObject、cssRules 限制。
   - 完整保留弹窗、动画、tooltip、滚动位置等任何视觉状态
   - file:// 完全兼容
   - 唯一代价：每次都会弹出"选择共享内容"对话框，需要选"当前标签页"
   - 输出强制裁切为 1920×1080 (16:9)
   ============================================================== */
(function () {
  const OUTPUT_WIDTH = 1920;
  const OUTPUT_HEIGHT = 1080;

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function showCaptureToast(message, type) {
    let toast = document.querySelector('.proto-capture-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'proto-capture-toast';
      toast.setAttribute('data-proto-no-capture', 'true');
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `proto-capture-toast show ${type || ''}`;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), type === 'error' ? 5000 : 2800);
  }

  function ensureToolbar() {
    let copyBtn = document.getElementById('copyImageBtn');
    let downloadBtn = document.getElementById('downloadImageBtn');

    if (!copyBtn) {
      const toolbar = document.createElement('div');
      toolbar.className = 'proto-capture-toolbar';
      toolbar.setAttribute('data-proto-no-capture', 'true');
      toolbar.innerHTML = `
        <button class="proto-capture-btn primary" id="copyImageBtn" type="button">复制截图</button>
        <button class="proto-capture-btn" id="downloadImageBtn" type="button">下载截图</button>
      `;
      document.body.appendChild(toolbar);
      copyBtn = document.getElementById('copyImageBtn');
      downloadBtn = document.getElementById('downloadImageBtn');
    } else {
      copyBtn.setAttribute('data-proto-no-capture', 'true');
      copyBtn.closest('.copy-strip')?.setAttribute('data-proto-no-capture', 'true');
    }

    if (downloadBtn) {
      downloadBtn.setAttribute('data-proto-no-capture', 'true');
      downloadBtn.closest('.copy-strip')?.setAttribute('data-proto-no-capture', 'true');
    }

    bindCaptureButton(copyBtn, copyImage);
    if (downloadBtn) bindCaptureButton(downloadBtn, downloadImage);
  }

  function bindCaptureButton(button, handler) {
    if (!button || button.dataset.protoCaptureBound === 'true') return;
    button.dataset.protoCaptureBound = 'true';
    button.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
      handler();
    }, true);
  }

  /**
   * 截图当前浏览器标签页（getDisplayMedia → video → canvas）
   * 用户在弹出的对话框选"当前标签页"，浏览器返回真实像素流。
   * 任何视觉状态（弹窗、悬浮、动画的某帧）都会原样捕获。
   */
  async function captureCurrentTab() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      throw new Error('浏览器不支持屏幕截图 API（建议用 Chrome 94+ / Edge / Firefox）');
    }

    // Chrome 的 getDisplayMedia constraints —— 优先当前标签页
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: 'browser',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
      audio: false
    });

    const video = document.createElement('video');
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
    video.setAttribute('data-proto-no-capture', 'true');
    document.body.appendChild(video);

    try {
      await video.play();
      // 等几帧让首帧绘出来
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => requestAnimationFrame(r));
      await new Promise(r => setTimeout(r, 60));

      const srcW = video.videoWidth;
      const srcH = video.videoHeight;
      if (!srcW || !srcH) throw new Error('屏幕流尚未就绪，请重试');

      // 按 16:9 居中裁切（输入分辨率可能是 16:10 / 4:3 等任何形态）
      const targetAspect = OUTPUT_WIDTH / OUTPUT_HEIGHT;
      const srcAspect = srcW / srcH;
      let sx = 0, sy = 0, sw = srcW, sh = srcH;
      if (srcAspect > targetAspect) {
        sw = srcH * targetAspect;
        sx = (srcW - sw) / 2;
      } else if (srcAspect < targetAspect) {
        sh = srcW / targetAspect;
        sy = (srcH - sh) / 2;
      }

      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
      return canvas;
    } finally {
      stream.getTracks().forEach(t => t.stop());
      video.remove();
    }
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('图片生成失败'));
      }, 'image/png');
    });
  }

  async function writeClipboard(blob) {
    if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
      throw new Error('浏览器不支持复制图片到剪贴板');
    }
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
  }

  function downloadDataUrl(dataUrl, filename) {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  }

  function safeTitle() {
    return (document.title || 'prototype').replace(/[\\\/:*?"<>|]+/g, '-');
  }

  function friendlyError(error) {
    if (!error) return '截图失败';
    if (error.name === 'NotAllowedError') return '截图取消（你没有选择共享对象，或拒绝了权限）';
    if (error.name === 'NotFoundError') return '没有可用的截图源';
    if (error.name === 'AbortError') return '截图被中断';
    return error.message || '截图失败';
  }

  async function copyImage() {
    document.body.classList.add('proto-capturing');
    try {
      const canvas = await captureCurrentTab();
      const blob = await canvasToBlob(canvas);
      await writeClipboard(blob);
      showCaptureToast('已复制 16:9 截图，可直接粘贴', 'success');
    } catch (error) {
      console.error(error);
      showCaptureToast(friendlyError(error), 'error');
    } finally {
      document.body.classList.remove('proto-capturing');
    }
  }

  async function downloadImage() {
    document.body.classList.add('proto-capturing');
    try {
      const canvas = await captureCurrentTab();
      const dataUrl = canvas.toDataURL('image/png');
      downloadDataUrl(dataUrl, `${safeTitle()}-16x9.png`);
      showCaptureToast('已下载 16:9 截图', 'success');
    } catch (error) {
      console.error(error);
      showCaptureToast(friendlyError(error), 'error');
    } finally {
      document.body.classList.remove('proto-capturing');
    }
  }

  window.PrototypeCapture = { copyImage, downloadImage, captureCurrentTab };
  ready(ensureToolbar);
})();
