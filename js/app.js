import { extractAudioFromMedia } from './audio-helper.js';

// --- Theme Management ---
const themeToggleBtn = document.getElementById('themeToggleBtn');
const iconSun = document.querySelector('.icon-sun');
const iconMoon = document.querySelector('.icon-moon');

function initTheme() {
  const savedTheme = localStorage.getItem('mc_theme') || 
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(savedTheme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('mc_theme', theme);
  if (theme === 'light') {
    iconSun?.classList.add('hidden');
    iconMoon?.classList.remove('hidden');
  } else {
    iconSun?.classList.remove('hidden');
    iconMoon?.classList.add('hidden');
  }
}

themeToggleBtn?.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'light' ? 'dark' : 'light');
});

initTheme();

// --- DOM References ---
const mediaInput = document.getElementById('mediaInput');
const browseBtn = document.getElementById('browseBtn');
const dropzone = document.getElementById('dropzone');
const fileLoadedBar = document.getElementById('fileLoadedBar');
const fileName = document.getElementById('fileName');
const fileMetaTag = document.getElementById('fileMetaTag');
const replaceFileBtn = document.getElementById('replaceFileBtn');
const transcribeBtn = document.getElementById('transcribeBtn');
const progressBox = document.getElementById('progressBox');
const progressLabel = document.getElementById('progressLabel');
const progressPercent = document.getElementById('progressPercent');
const progressFill = document.getElementById('progressFill');
const emptyState = document.getElementById('emptyState');
const transcriptList = document.getElementById('transcriptList');
const exportSrtBtn = document.getElementById('exportSrtBtn');
const exportVttBtn = document.getElementById('exportVttBtn');
const exportMp4Btn = document.getElementById('exportMp4Btn');
const statusText = document.getElementById('statusText');

const videoStage = document.getElementById('videoStage');
const videoPreview = document.getElementById('videoPreview');
const dynamicCaption = document.getElementById('dynamicCaption');
const captionTextContent = document.getElementById('captionTextContent');

// Customizer Controls
const fontFamilySelect = document.getElementById('fontFamilySelect');
const highlightEffectSelect = document.getElementById('highlightEffectSelect');
const fpsSelect = document.getElementById('fpsSelect');
const wordsPerScreenRange = document.getElementById('wordsPerScreenRange');
const wordsPerScreenVal = document.getElementById('wordsPerScreenVal');
const posXRange = document.getElementById('posXRange');
const posXVal = document.getElementById('posXVal');
const posYRange = document.getElementById('posYRange');
const posYVal = document.getElementById('posYVal');
const fontSizeRange = document.getElementById('fontSizeRange');
const fontSizeVal = document.getElementById('fontSizeVal');
const fontWeightRange = document.getElementById('fontWeightRange');
const fontWeightVal = document.getElementById('fontWeightVal');
const strokeWidthRange = document.getElementById('strokeWidthRange');
const strokeWidthVal = document.getElementById('strokeWidthVal');
const strokeColorInput = document.getElementById('strokeColorInput');
const textColorInput = document.getElementById('textColorInput');
const highlightColorInput = document.getElementById('highlightColorInput');
const bgBoxToggle = document.getElementById('bgBoxToggle');
const bgColorGroup = document.getElementById('bgColorGroup');
const bgColorInput = document.getElementById('bgColorInput');
const uppercaseToggle = document.getElementById('uppercaseToggle');

// Export Modal & Canvas
const renderCanvas = document.getElementById('renderCanvas');
const exportModal = document.getElementById('exportModal');
const exportProgressFill = document.getElementById('exportProgressFill');
const exportProgressVal = document.getElementById('exportProgressVal');

let currentFile = null;
let wordTimeline = [];
let chunkTimeline = [];
let wordsPerScreen = parseInt(wordsPerScreenRange?.value || 3, 10);
const PAUSE_THRESHOLD_SEC = 0.42;

// Dedicated Web Worker Pipeline
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

// --- Media Ingestion ---
browseBtn?.addEventListener('click', () => mediaInput.click());
dropzone?.addEventListener('click', (e) => {
  if (e.target !== browseBtn) mediaInput.click();
});
replaceFileBtn?.addEventListener('click', () => mediaInput.click());

mediaInput?.addEventListener('change', (e) => {
  if (e.target.files.length) loadFile(e.target.files[0]);
});

['dragover', 'dragenter'].forEach(ev => {
  dropzone?.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });
});

['dragleave', 'drop'].forEach(ev => {
  dropzone?.addEventListener(ev, (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
  });
});

dropzone?.addEventListener('drop', (e) => {
  if (e.dataTransfer.files.length) loadFile(e.dataTransfer.files[0]);
});

function loadFile(file) {
  currentFile = file;
  fileName.textContent = file.name;
  videoPreview.src = URL.createObjectURL(file);

  videoPreview.onloadedmetadata = () => {
    const w = videoPreview.videoWidth || 1080;
    const h = videoPreview.videoHeight || 1920;
    fileMetaTag.textContent = `${w}x${h}`;
  };

  dropzone.classList.add('hidden');
  fileLoadedBar.classList.remove('hidden');
  transcribeBtn.disabled = false;
  transcribeBtn.textContent = 'Generate Auto Captions';
}

// --- Dynamic Styling Listeners ---
fontFamilySelect?.addEventListener('change', (e) => {
  document.documentElement.style.setProperty('--caption-font-family', e.target.value);
});

wordsPerScreenRange?.addEventListener('input', (e) => {
  wordsPerScreen = parseInt(e.target.value, 10);
  wordsPerScreenVal.textContent = wordsPerScreen;
  rebuildChunks();
});

posXRange?.addEventListener('input', (e) => {
  updatePosition(parseFloat(e.target.value), parseFloat(posYRange.value));
});

posYRange?.addEventListener('input', (e) => {
  updatePosition(parseFloat(posXRange.value), parseFloat(e.target.value));
});

function updatePosition(x, y) {
  const clampedX = Math.max(5, Math.min(95, x));
  const clampedY = Math.max(5, Math.min(95, y));
  document.documentElement.style.setProperty('--caption-pos-x', `${clampedX}%`);
  document.documentElement.style.setProperty('--caption-pos-y', `${clampedY}%`);
  posXRange.value = clampedX;
  posYRange.value = clampedY;
  posXVal.textContent = `${Math.round(clampedX)}%`;
  posYVal.textContent = `${Math.round(clampedY)}%`;
}

fontSizeRange?.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--caption-font-size', `${e.target.value}px`);
  fontSizeVal.textContent = `${e.target.value}px`;
});

fontWeightRange?.addEventListener('input', (e) => {
  const weight = e.target.value;
  document.documentElement.style.setProperty('--caption-font-weight', weight);
  if (fontWeightVal) fontWeightVal.textContent = weight;
});

strokeWidthRange?.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--caption-stroke-width', `${e.target.value}px`);
  strokeWidthVal.textContent = `${e.target.value}px`;
});

strokeColorInput?.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--caption-stroke-color', e.target.value);
});

textColorInput?.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--caption-color', e.target.value);
});

highlightColorInput?.addEventListener('input', (e) => {
  document.documentElement.style.setProperty('--caption-highlight', e.target.value);
});

function updateBackgroundStyle() {
  if (!bgBoxToggle.checked) {
    document.documentElement.style.setProperty('--caption-bg', 'transparent');
    bgColorGroup.classList.add('disabled');
  } else {
    bgColorGroup.classList.remove('disabled');
    const hex = bgColorInput.value;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    document.documentElement.style.setProperty('--caption-bg', `rgba(${r}, ${g}, ${b}, 0.88)`);
  }
}

bgBoxToggle?.addEventListener('change', updateBackgroundStyle);
bgColorInput?.addEventListener('input', updateBackgroundStyle);

uppercaseToggle?.addEventListener('change', (e) => {
  document.documentElement.style.setProperty('--caption-transform', e.target.checked ? 'uppercase' : 'none');
});

// --- 2D Stage Cursor Dragging ---
let isDragging = false;

function handleDragStart() {
  isDragging = true;
}

function handleDragMove(e) {
  if (!isDragging) return;
  e.preventDefault();

  const rect = videoStage.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  const relX = ((clientX - rect.left) / rect.width) * 100;
  const relY = ((clientY - rect.top) / rect.height) * 100;

  updatePosition(relX, relY);
}

function handleDragEnd() {
  isDragging = false;
}

dynamicCaption?.addEventListener('mousedown', handleDragStart);
window.addEventListener('mousemove', handleDragMove);
window.addEventListener('mouseup', handleDragEnd);

dynamicCaption?.addEventListener('touchstart', handleDragStart, { passive: true });
window.addEventListener('touchmove', handleDragMove, { passive: false });
window.addEventListener('touchend', handleDragEnd);

// --- Transcription Pipeline ---
transcribeBtn?.addEventListener('click', async () => {
  if (!currentFile) return;

  try {
    transcribeBtn.disabled = true;
    statusText.textContent = 'Extracting audio track...';
    progressBox.classList.remove('hidden');
    progressLabel.textContent = 'Preparing audio buffer...';
    progressFill.style.width = '15%';
    progressPercent.textContent = '15%';

    const audioData = await extractAudioFromMedia(currentFile);

    statusText.textContent = 'Running Whisper AI...';
    worker.postMessage({ type: 'transcribe', audioData });
  } catch (err) {
    alert('Extraction error: ' + err.message);
    transcribeBtn.disabled = false;
  }
});

worker.addEventListener('message', (e) => {
  const { type, data, message, error } = e.data;

  if (type === 'progress') {
    if (data.status === 'progress') {
      const pct = Math.round(data.progress || 0);
      progressLabel.textContent = `Downloading ${data.file || 'weights'}...`;
      progressPercent.textContent = `${pct}%`;
      progressFill.style.width = `${pct}%`;
    }
  } else if (type === 'status') {
    progressLabel.textContent = message;
    progressFill.style.width = '85%';
    progressPercent.textContent = '85%';
  } else if (type === 'complete') {
    progressBox.classList.add('hidden');
    statusText.textContent = 'Ready';
    transcribeBtn.textContent = 'Re-generate';
    transcribeBtn.disabled = false;
    processTranscriptionOutput(data);
  } else if (type === 'error') {
    alert('AI Error: ' + error);
    transcribeBtn.disabled = false;
    progressBox.classList.add('hidden');
  }
});

function processTranscriptionOutput(result) {
  wordTimeline = [];

  if (result.chunks && result.chunks.length) {
    result.chunks.forEach(chunk => {
      const [start, end] = chunk.timestamp;
      const text = chunk.text.trim();
      if (text) {
        wordTimeline.push({
          start: Math.max(0, start ?? 0),
          end: Math.max((start ?? 0) + 0.1, end ?? ((start ?? 0) + 0.4)),
          word: text
        });
      }
    });
  }

  rebuildChunks();
  exportSrtBtn.disabled = false;
  exportVttBtn.disabled = false;
  if (exportMp4Btn) exportMp4Btn.disabled = false;
}

// --- Silence & Natural Cadence Segmentation ---
function rebuildChunks() {
  chunkTimeline = [];
  if (!wordTimeline.length) return;

  let currentChunk = [];

  for (let i = 0; i < wordTimeline.length; i++) {
    const item = wordTimeline[i];
    const prev = currentChunk[currentChunk.length - 1];

    const isPause = prev && (item.start - prev.end >= PAUSE_THRESHOLD_SEC);
    const isFull = currentChunk.length >= wordsPerScreen;

    if (currentChunk.length > 0 && (isPause || isFull)) {
      chunkTimeline.push({
        start: currentChunk[0].start,
        end: currentChunk[currentChunk.length - 1].end,
        words: currentChunk
      });
      currentChunk = [];
    }

    currentChunk.push(item);
  }

  if (currentChunk.length > 0) {
    chunkTimeline.push({
      start: currentChunk[0].start,
      end: currentChunk[currentChunk.length - 1].end,
      words: currentChunk
    });
  }

  renderTranscriptList();
}

function renderTranscriptList() {
  emptyState.classList.add('hidden');
  transcriptList.classList.remove('hidden');
  transcriptList.innerHTML = '';

  chunkTimeline.forEach((chunk, chunkIdx) => {
    const card = document.createElement('div');
    card.className = 'transcript-chunk';
    card.dataset.chunkIdx = chunkIdx;

    const header = document.createElement('div');
    header.className = 'chunk-header';

    const boundaryControls = document.createElement('div');
    boundaryControls.className = 'boundary-controls';

    const startGroup = document.createElement('div');
    startGroup.className = 'time-nudge-group';
    startGroup.innerHTML = `
      <span>In:</span>
      <button class="btn-nudge" data-action="sub-start" title="-0.1s">-</button>
      <span class="time-display start-val">${formatTime(chunk.start)}</span>
      <button class="btn-nudge" data-action="add-start" title="+0.1s">+</button>
    `;

    const endGroup = document.createElement('div');
    endGroup.className = 'time-nudge-group';
    endGroup.innerHTML = `
      <span>Out:</span>
      <button class="btn-nudge" data-action="sub-end" title="-0.1s">-</button>
      <span class="time-display end-val">${formatTime(chunk.end)}</span>
      <button class="btn-nudge" data-action="add-end" title="+0.1s">+</button>
    `;

    boundaryControls.appendChild(startGroup);
    boundaryControls.appendChild(endGroup);
    header.appendChild(boundaryControls);
    card.appendChild(header);

    startGroup.querySelector('[data-action="sub-start"]').addEventListener('click', (e) => {
      e.stopPropagation();
      chunk.start = Math.max(0, +(chunk.start - 0.1).toFixed(2));
      chunk.words[0].start = chunk.start;
      startGroup.querySelector('.start-val').textContent = formatTime(chunk.start);
    });

    startGroup.querySelector('[data-action="add-start"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (chunk.start + 0.1 < chunk.end) {
        chunk.start = +(chunk.start + 0.1).toFixed(2);
        chunk.words[0].start = chunk.start;
        startGroup.querySelector('.start-val').textContent = formatTime(chunk.start);
      }
    });

    endGroup.querySelector('[data-action="sub-end"]').addEventListener('click', (e) => {
      e.stopPropagation();
      if (chunk.end - 0.1 > chunk.start) {
        chunk.end = +(chunk.end - 0.1).toFixed(2);
        chunk.words[chunk.words.length - 1].end = chunk.end;
        endGroup.querySelector('.end-val').textContent = formatTime(chunk.end);
      }
    });

    endGroup.querySelector('[data-action="add-end"]').addEventListener('click', (e) => {
      e.stopPropagation();
      chunk.end = +(chunk.end + 0.1).toFixed(2);
      chunk.words[chunk.words.length - 1].end = chunk.end;
      endGroup.querySelector('.end-val').textContent = formatTime(chunk.end);
    });

    const wordsWrap = document.createElement('div');
    wordsWrap.className = 'words-wrap';

    chunk.words.forEach((item) => {
      const chip = document.createElement('span');
      chip.className = 'word-chip';
      chip.textContent = item.word;
      chip.contentEditable = 'true';

      chip.addEventListener('click', () => {
        videoPreview.currentTime = item.start;
        videoPreview.play();
      });

      chip.addEventListener('input', (ev) => {
        item.word = ev.target.innerText;
      });

      wordsWrap.appendChild(chip);
    });

    card.appendChild(wordsWrap);
    transcriptList.appendChild(card);
  });
}

// --- Live Audio/Video Sync with Spacing Fix ---
videoPreview?.addEventListener('timeupdate', () => {
  const cur = videoPreview.currentTime;
  let activeChunk = null;
  let activeChunkIdx = -1;

  for (let i = 0; i < chunkTimeline.length; i++) {
    const chunk = chunkTimeline[i];
    if (cur >= chunk.start && cur <= chunk.end) {
      activeChunk = chunk;
      activeChunkIdx = i;
      break;
    }
  }

  document.querySelectorAll('.transcript-chunk').forEach(c => c.classList.remove('active'));
  document.querySelectorAll('.word-chip').forEach(w => w.classList.remove('active-word'));

  if (activeChunk) {
    const activeCard = document.querySelector(`.transcript-chunk[data-chunk-idx="${activeChunkIdx}"]`);
    if (activeCard) activeCard.classList.add('active');

    const effectMode = highlightEffectSelect.value;

    // Render words cleanly with explicit margins inside HTML
    captionTextContent.innerHTML = activeChunk.words.map((item, idx) => {
      const isSpoken = cur >= item.start && cur <= item.end;
      if (isSpoken && activeCard) {
        const chip = activeCard.querySelectorAll('.word-chip')[idx];
        if (chip) chip.classList.add('active-word');
      }

      let activeClass = '';
      if (isSpoken) {
        activeClass = effectMode === 'pop' ? 'pop-active' :
                      effectMode === 'glow' ? 'glow-active' : 'box-active';
      }

      return `<span class="caption-word-span ${activeClass}">${item.word}</span>`;
    }).join('');

    captionTextContent.style.display = 'inline-block';
  } else {
    captionTextContent.style.display = 'none';
  }
});

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.floor((sec % 1) * 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
}

// Subtitle Exporters
exportSrtBtn?.addEventListener('click', () => {
  let srt = '';
  chunkTimeline.forEach((chunk, idx) => {
    const start = formatSrtTime(chunk.start);
    const end = formatSrtTime(chunk.end);
    const text = chunk.words.map(w => w.word).join(' ');
    srt += `${idx + 1}\n${start} --> ${end}\n${text}\n\n`;
  });
  download(srt, 'mastercaption.srt', 'text/plain');
});

exportVttBtn?.addEventListener('click', () => {
  let vtt = 'WEBVTT\n\n';
  chunkTimeline.forEach((chunk, idx) => {
    const start = formatVttTime(chunk.start);
    const end = formatVttTime(chunk.end);
    const text = chunk.words.map(w => w.word).join(' ');
    vtt += `${idx + 1}\n${start} --> ${end}\n${text}\n\n`;
  });
  download(vtt, 'mastercaption.vtt', 'text/vtt');
});

function formatSrtTime(sec) {
  const d = new Date(sec * 1000);
  const hh = String(Math.floor(sec / 3600)).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

function formatVttTime(sec) {
  const d = new Date(sec * 1000);
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  const ms = String(d.getUTCMilliseconds()).padStart(3, '0');
  return `${mm}:${ss}.${ms}`;
}

function download(content, name, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Canvas Engine & High Bitrate MP4 Export (24/30/60 fps) ---
exportMp4Btn?.addEventListener('click', async () => {
  if (!currentFile || !chunkTimeline.length) return;

  exportModal?.classList.remove('hidden');
  exportProgressFill.style.width = '0%';
  exportProgressVal.textContent = '0%';

  const ctx = renderCanvas.getContext('2d');

  // Exact native pixel dimensions to eliminate canvas compression downsampling
  const nativeW = videoPreview.videoWidth || 1080;
  const nativeH = videoPreview.videoHeight || 1920;
  renderCanvas.width = nativeW;
  renderCanvas.height = nativeH;

  let audioStream = null;
  if (videoPreview.captureStream) {
    audioStream = videoPreview.captureStream();
  } else if (videoPreview.mozCaptureStream) {
    audioStream = videoPreview.mozCaptureStream();
  }

  // Target Framerate Selection (24, 30, or 60 fps)
  const targetFps = parseInt(fpsSelect?.value || '60', 10);
  const canvasStream = renderCanvas.captureStream(targetFps);
  const combinedTracks = [...canvasStream.getVideoTracks()];

  if (audioStream && audioStream.getAudioTracks().length > 0) {
    combinedTracks.push(audioStream.getAudioTracks()[0]);
  }

  const combinedStream = new MediaStream(combinedTracks);

  const mimeType = MediaRecorder.isTypeSupported('video/mp4; codecs="avc1.42E01E, mp4a.40.2"')
    ? 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
    : MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : 'video/webm; codecs=vp9';

  // Target bitrate scaled for high framerates (25 Mbps for 60 fps, 16 Mbps for 24/30 fps)
  const exportBitrate = targetFps === 60 ? 25000000 : 16000000;

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: exportBitrate
  });

  const recordedChunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) recordedChunks.push(e.data);
  };

  recorder.onstop = () => {
    exportModal?.classList.add('hidden');
    videoPreview.muted = false;

    const fileExt = mimeType.includes('mp4') ? 'mp4' : 'webm';
    const blob = new Blob(recordedChunks, { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captioned_${fileName.textContent.replace(/\.[^/.]+$/, "")}_${targetFps}fps.${fileExt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  videoPreview.currentTime = 0;
  videoPreview.muted = false;
  await new Promise(r => videoPreview.addEventListener('seeked', r, { once: true }));

  recorder.start();
  videoPreview.play();

  // Dynamic scale factor between stage preview and native canvas
  const previewWidth = videoPreview.clientWidth || 360;
  const scale = nativeW / previewWidth;

  function drawFrame() {
    if (videoPreview.paused || videoPreview.ended) return;

    ctx.drawImage(videoPreview, 0, 0, nativeW, nativeH);

    const cur = videoPreview.currentTime;
    const dur = videoPreview.duration || 1;
    const progress = Math.min(100, Math.round((cur / dur) * 100));
    
    exportProgressFill.style.width = `${progress}%`;
    exportProgressVal.textContent = `${progress}%`;

    const activeChunk = chunkTimeline.find(c => cur >= c.start && cur <= c.end);

    if (activeChunk) {
      const posX = (parseFloat(posXRange.value) / 100) * nativeW;
      const posY = (parseFloat(posYRange.value) / 100) * nativeH;
      const fontSize = parseFloat(fontSizeRange.value) * scale;
      const fontWeight = fontWeightRange ? fontWeightRange.value : '800';
      const strokeWidth = parseFloat(strokeWidthRange.value) * scale;
      const strokeColor = strokeColorInput.value;
      const font = fontFamilySelect ? fontFamilySelect.value : "'Plus Jakarta Sans', sans-serif";
      const isUpper = uppercaseToggle.checked;
      const textColor = textColorInput.value;
      const highlightColor = highlightColorInput.value;
      const bgHex = bgColorInput.value;
      const isBgEnabled = bgBoxToggle.checked;
      const effectMode = highlightEffectSelect.value;

      ctx.font = `${fontWeight} ${fontSize}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const words = activeChunk.words.map(w => ({
        ...w,
        text: isUpper ? w.word.toUpperCase() : w.word,
        isLit: cur >= w.start && cur <= w.end
      }));

      const spaceWidth = ctx.measureText(' ').width;
      let totalWidth = 0;
      words.forEach(w => {
        w.width = ctx.measureText(w.text).width;
        totalWidth += w.width;
      });
      totalWidth += spaceWidth * (words.length - 1);

      // Render Background Plate Box
      if (isBgEnabled) {
        const paddingX = 18 * scale;
        const paddingY = 8 * scale;
        const boxHeight = fontSize * 1.35 + (paddingY * 2);
        const boxWidth = totalWidth + (paddingX * 2);
        const boxX = posX - (boxWidth / 2);
        const boxY = posY - (boxHeight / 2);

        const r = parseInt(bgHex.slice(1, 3), 16);
        const g = parseInt(bgHex.slice(3, 5), 16);
        const b = parseInt(bgHex.slice(5, 7), 16);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.88)`;

        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 8 * scale);
        ctx.fill();
      }

      let currentX = posX - (totalWidth / 2);

      words.forEach(w => {
        const wordCenterX = currentX + (w.width / 2);

        // Pill Box Wipe Effect
        if (w.isLit && effectMode === 'box') {
          const pillPad = 5 * scale;
          ctx.fillStyle = highlightColor;
          ctx.beginPath();
          ctx.roundRect(
            currentX - pillPad,
            posY - (fontSize * 0.65),
            w.width + (pillPad * 2),
            fontSize * 1.3,
            4 * scale
          );
          ctx.fill();
        }

        // Outline Stroke
        if (strokeWidth > 0 && !(w.isLit && effectMode === 'box')) {
          ctx.lineWidth = strokeWidth;
          ctx.strokeStyle = strokeColor;
          ctx.lineJoin = 'round';
          ctx.strokeText(w.text, wordCenterX, posY);
        }

        // Word Fill
        if (w.isLit) {
          ctx.fillStyle = effectMode === 'box' ? '#000000' : highlightColor;
          if (effectMode === 'glow') {
            ctx.shadowColor = highlightColor;
            ctx.shadowBlur = 18 * scale;
          }
        } else {
          ctx.fillStyle = textColor;
          ctx.shadowBlur = 0;
        }

        ctx.fillText(w.text, wordCenterX, posY);
        ctx.shadowBlur = 0;

        currentX += w.width + spaceWidth;
      });
    }

    requestAnimationFrame(drawFrame);
  }

  videoPreview.requestVideoFrameCallback ? 
    videoPreview.requestVideoFrameCallback(drawFrame) : 
    requestAnimationFrame(drawFrame);

  videoPreview.addEventListener('ended', () => {
    recorder.stop();
  }, { once: true });
});