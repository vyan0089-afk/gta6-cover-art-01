/* Neon Coast Cover Studio — cover editor.
 * Wires the page: live preview, photo library (samples, upload, drag-drop),
 * per-panel crop and position (drag to pan, wheel or slider to zoom),
 * layout and grade pickers, caption editor, undo / redo, one-click export
 * of all three post sizes, and the ?shot= modes used for screenshots. */

import { COVER_LAYOUTS, COVER_GRADES, EXPORT_SIZES, renderCover, layoutPanelRects } from './cover-render.js';
import { defaultCoverState, coverStateSnapshot, CoverHistory, loadPhotoImage, readUserPhotoFile, SAMPLE_PHOTOS, fillPanelsWithPhotos, assignPhotoToPanel, panelCountForLayout } from './cover-state.js';

const $ = (id) => document.getElementById(id);
const PREVIEW_WIDTH = 960;
const PREVIEW_HEIGHT = 600;

const state = defaultCoverState();
const history = new CoverHistory(state);
const photos = [];
let selectedPanel = 0;
let selectedPhoto = 0;
let lastRenderRects = null;
let dragging = null;

function currentState() {
  return history.present;
}

function commitState(next) {
  history.commit(next);
  refreshUndoButtons();
  renderPreview();
}

function renderPreview() {
  const canvas = $('coverPreview');
  if (!canvas) return;
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot === 'cover' || shot === 'cover2' || shot === 'cover3') {
    const size = shot === 'cover' ? { width: 1280, height: 720 } : shot === 'cover2' ? { width: 1024, height: 1280 } : { width: 1080, height: 1080 };
    lastRenderRects = renderCover(canvas, currentState(), photos, size.width, size.height);
    return;
  }
  const ratio = PREVIEW_WIDTH / PREVIEW_HEIGHT;
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  lastRenderRects = renderCover(canvas, currentState(), photos, PREVIEW_WIDTH, PREVIEW_HEIGHT);
  void ratio;
}

function refreshUndoButtons() {
  const undoBtn = $('undoButton');
  const redoBtn = $('redoButton');
  if (undoBtn) undoBtn.disabled = !history.canUndo();
  if (redoBtn) redoBtn.disabled = !history.canRedo();
}

function refreshPanelButtons() {
  const strip = $('panelStrip');
  if (!strip) return;
  strip.innerHTML = '';
  const total = panelCountForLayout(currentState().layout);
  for (let i = 0; i < total; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'panel-chip' + (i === selectedPanel ? ' selected' : '');
    btn.textContent = `Panel ${i + 1}`;
    btn.addEventListener('click', () => {
      selectedPanel = i;
      refreshPanelButtons();
      syncZoomSlider();
    });
    strip.appendChild(btn);
  }
}

function refreshPhotoLibrary() {
  const lib = $('photoLibrary');
  if (!lib) return;
  lib.innerHTML = '';
  photos.forEach((img, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'photo-thumb' + (i === selectedPhoto ? ' selected' : '');
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = `Photo ${i + 1}`;
    btn.appendChild(thumb);
    btn.addEventListener('click', () => {
      selectedPhoto = i;
      const next = assignPhotoToPanel(currentState(), selectedPanel, i);
      commitState(next);
      refreshPhotoLibrary();
    });
    lib.appendChild(btn);
  });
  const count = $('photoCount');
  if (count) count.textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} loaded`;
}

function syncZoomSlider() {
  const slider = $('zoomSlider');
  const panel = currentState().panels[selectedPanel];
  if (slider && panel) slider.value = String(Math.round((panel.zoom || 1) * 100));
}

function buildPicker(containerId, items, activeId, onPick) {
  const box = $(containerId);
  if (!box) return;
  box.innerHTML = '';
  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'picker-chip' + (item.id === activeId ? ' selected' : '');
    btn.textContent = item.label;
    btn.addEventListener('click', () => onPick(item.id));
    box.appendChild(btn);
  });
}

function refreshPickers() {
  buildPicker('layoutPicker', COVER_LAYOUTS, currentState().layout, (id) => {
    const next = coverStateSnapshot(currentState());
    next.layout = id;
    selectedPanel = 0;
    commitState(next);
    refreshPanelButtons();
    refreshPickers();
  });
  buildPicker('gradePicker', COVER_GRADES, currentState().grade, (id) => {
    const next = coverStateSnapshot(currentState());
    next.grade = id;
    commitState(next);
    refreshPickers();
  });
}

function bindCaptionControls() {
  const titleInput = $('titleInput');
  const subtitleInput = $('subtitleInput');
  const captionInput = $('captionInput');
  const sizeSlider = $('captionSizeSlider');
  const badgeInput = $('badgeInput');
  const heatInput = $('heatInput');
  // Text fields preview live while typing. Undo must step back to the
  // text as it was when the field gained focus, so the pre-edit snapshot
  // is saved on focus and pushed onto the history only when the edit ends.
  let textEditBaseline = null;
  const beginTextEdit = () => {
    if (textEditBaseline === null) textEditBaseline = coverStateSnapshot(currentState());
  };
  const endTextEdit = () => {
    if (textEditBaseline === null) return;
    const before = textEditBaseline;
    textEditBaseline = null;
    const after = coverStateSnapshot(currentState());
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      history.past.push(before);
      if (history.past.length > 60) history.past.shift();
      history.future = [];
      history.present = after;
      refreshUndoButtons();
    }
  };
  if (titleInput) titleInput.addEventListener('input', () => {
    const next = coverStateSnapshot(currentState());
    next.title = titleInput.value;
    history.present = next;
    renderPreview();
  });
  if (subtitleInput) subtitleInput.addEventListener('input', () => {
    const next = coverStateSnapshot(currentState());
    next.subtitle = subtitleInput.value;
    history.present = next;
    renderPreview();
  });
  if (captionInput) captionInput.addEventListener('input', () => {
    const next = coverStateSnapshot(currentState());
    next.caption = captionInput.value;
    history.present = next;
    renderPreview();
  });
  if (sizeSlider) sizeSlider.addEventListener('input', () => {
    const next = coverStateSnapshot(currentState());
    next.captionSize = Number(sizeSlider.value) / 100;
    history.present = next;
    renderPreview();
  });
  if (badgeInput) badgeInput.addEventListener('input', () => {
    const next = coverStateSnapshot(currentState());
    next.badge = badgeInput.value;
    history.present = next;
    renderPreview();
  });
  if (heatInput) heatInput.addEventListener('input', () => {
    const next = coverStateSnapshot(currentState());
    next.heat = Number(heatInput.value);
    history.present = next;
    renderPreview();
  });
  document.querySelectorAll('input[name="captionColor"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const next = coverStateSnapshot(currentState());
      next.captionColor = radio.value;
      commitState(next);
    });
  });
  const commitText = () => {
    endTextEdit();
  };
  [titleInput, subtitleInput, captionInput, badgeInput].forEach((el) => {
    if (el) {
      el.addEventListener('focus', beginTextEdit);
      el.addEventListener('input', beginTextEdit);
      el.addEventListener('change', commitText);
    }
  });
}

function bindCanvasInteraction() {
  const canvas = $('coverPreview');
  if (!canvas) return;
  const pickPanel = (event) => {
    if (!lastRenderRects) return 0;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    for (let i = lastRenderRects.rects.length - 1; i >= 0; i--) {
      const r = lastRenderRects.rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return 0;
  };
  canvas.addEventListener('pointerdown', (event) => {
    selectedPanel = pickPanel(event);
    refreshPanelButtons();
    syncZoomSlider();
    dragging = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const dx = (event.clientX - dragging.x) * scaleX;
    const dy = (event.clientY - dragging.y) * scaleY;
    dragging = { x: event.clientX, y: event.clientY };
    const next = coverStateSnapshot(currentState());
    const panel = next.panels[selectedPanel];
    if (panel) {
      panel.ox = (panel.ox || 0) + dx;
      panel.oy = (panel.oy || 0) + dy;
      history.present = next;
      renderPreview();
    }
  });
  const endDrag = () => {
    if (dragging) {
      dragging = null;
      commitState(coverStateSnapshot(currentState()));
    }
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const next = coverStateSnapshot(currentState());
    const panel = next.panels[selectedPanel];
    if (!panel) return;
    const factor = event.deltaY < 0 ? 1.1 : 0.9;
    panel.zoom = Math.min(4, Math.max(0.5, (panel.zoom || 1) * factor));
    history.present = next;
    renderPreview();
    syncZoomSlider();
  }, { passive: false });
  const zoomSlider = $('zoomSlider');
  if (zoomSlider) zoomSlider.addEventListener('input', () => {
    const next = coverStateSnapshot(currentState());
    const panel = next.panels[selectedPanel];
    if (panel) {
      panel.zoom = Number(zoomSlider.value) / 100;
      history.present = next;
      renderPreview();
    }
  });
  if (zoomSlider) zoomSlider.addEventListener('change', () => commitState(coverStateSnapshot(currentState())));
}

/* Render every export size off-screen and return PNG data URLs.
 * The download buttons call this and save each file; tests call it too. */
export async function exportAllCoverPngs() {
  const results = [];
  for (const size of EXPORT_SIZES) {
    const canvas = document.createElement('canvas');
    renderCover(canvas, currentState(), photos, size.width, size.height);
    const dataUrl = await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      }, 'image/png');
    });
    results.push({ id: size.id, width: size.width, height: size.height, dataUrl });
  }
  return results;
}

function downloadPng(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function bindExport() {
  const btn = $('exportAllButton');
  const status = $('exportStatus');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    if (status) status.textContent = 'Rendering 3 sizes…';
    try {
      const results = await exportAllCoverPngs();
      results.forEach((r) => downloadPng(r.dataUrl, `neon-coast-cover-${r.width}x${r.height}.png`));
      if (status) status.textContent = `Exported ${results.length} PNGs: 1080x1080, 1080x1350, 1920x1080.`;
    } catch (err) {
      if (status) status.textContent = `Export failed: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  });
}

function bindUpload() {
  const input = $('photoUpload');
  const dropZone = $('dropZone');
  const addFiles = async (files) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    for (const file of list) {
      try {
        const img = await readUserPhotoFile(file);
        photos.push(img);
      } catch (err) {
        // Skip unreadable files and keep the rest.
      }
    }
    if (list.length > 0) {
      selectedPhoto = photos.length - 1;
      const next = fillPanelsWithPhotos(currentState(), photos.length);
      commitState(next);
      refreshPhotoLibrary();
    }
  };
  if (input) input.addEventListener('change', () => addFiles(input.files));
  if (dropZone) {
    dropZone.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropZone.classList.add('dragging');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
    dropZone.addEventListener('drop', (event) => {
      event.preventDefault();
      dropZone.classList.remove('dragging');
      addFiles(event.dataTransfer.files);
    });
  }
  const sampleBtn = $('loadSamplesButton');
  if (sampleBtn) sampleBtn.addEventListener('click', async () => {
    await loadSamples();
    const next = fillPanelsWithPhotos(currentState(), photos.length);
    commitState(next);
    refreshPhotoLibrary();
  });
}

async function loadSamples() {
  for (const sample of SAMPLE_PHOTOS) {
    if (photos.some((p) => p.src && p.src.endsWith(sample.src))) continue;
    try {
      const img = await loadPhotoImage(sample.src);
      photos.push(img);
    } catch (err) {
      // A missing sample never blocks the editor.
    }
  }
  if (photos.length > 0) selectedPhoto = 0;
}

function bindUndoRedo() {
  const undoBtn = $('undoButton');
  const redoBtn = $('redoButton');
  if (undoBtn) undoBtn.addEventListener('click', () => {
    const prev = history.undo();
    if (prev) {
      refreshUndoButtons();
      refreshPanelButtons();
      refreshPickers();
      renderPreview();
    }
  });
  if (redoBtn) redoBtn.addEventListener('click', () => {
    const next = history.redo();
    if (next) {
      refreshUndoButtons();
      refreshPanelButtons();
      refreshPickers();
      renderPreview();
    }
  });
}

/* Shot modes: ?shot=cover|editor|cover2|cover3 auto-load the samples,
 * apply a layout and grade, render, then flag readiness for screenshots. */
async function applyShotMode(shot) {
  await loadSamples();
  const next = coverStateSnapshot(currentState());
  if (shot === 'cover') {
    document.body.classList.add('shot-mode');
    next.layout = 'grid9';
    next.grade = 'sunset';
    next.title = 'NEON COAST';
    next.subtitle = 'welcome to the coast';
    next.caption = 'One city. Nine stories.';
    next.heat = 5;
    next.badge = 'VICE VIBES';
  } else if (shot === 'cover2') {
    document.body.classList.add('shot-mode');
    next.layout = 'heroThree';
    next.grade = 'neon';
    next.title = 'PIER NIGHTS';
    next.subtitle = 'neon never sleeps';
    next.caption = 'Chase the glow.';
    next.heat = 4;
    next.badge = 'NIGHT SHIFT';
  } else if (shot === 'cover3') {
    document.body.classList.add('shot-mode');
    next.layout = 'tilted';
    next.grade = 'golden';
    next.title = 'GOLDEN HOUR';
    next.subtitle = 'sunset chasers';
    next.caption = 'Three shots. One summer.';
    next.heat = 5;
    next.badge = 'SUMMER 26';
  } else if (shot === 'editor') {
    next.layout = 'grid9';
    next.grade = 'sunset';
  }
  history.present = next;
  const filled = fillPanelsWithPhotos(currentState(), photos.length);
  history.present = filled;
  refreshPanelButtons();
  refreshPickers();
  refreshPhotoLibrary();
  renderPreview();
  window.__shotReady = true;
}

async function startCoverEditor() {
  await document.fonts.ready;
  const shot = new URLSearchParams(location.search).get('shot');
  bindCaptionControls();
  bindCanvasInteraction();
  bindExport();
  bindUpload();
  bindUndoRedo();
  refreshUndoButtons();
  refreshPanelButtons();
  refreshPickers();
  if (shot) {
    await applyShotMode(shot);
  } else {
    await loadSamples();
    const filled = fillPanelsWithPhotos(currentState(), photos.length);
    history.present = filled;
    refreshPhotoLibrary();
    renderPreview();
  }
  window.__coverExportAll = exportAllCoverPngs;
  window.__coverState = () => coverStateSnapshot(currentState());
}

startCoverEditor();
