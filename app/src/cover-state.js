/* Neon Coast Cover Studio — cover state.
 * Holds the cover's editable state (layout, grade, lettering, panels),
 * the photo library, and the undo / redo history. The history stores plain
 * JSON snapshots so undo is exact and cheap. */

import { COVER_LAYOUTS } from './cover-render.js';

export function defaultCoverState() {
  const panels = [];
  for (let i = 0; i < 9; i++) {
    panels.push({ photo: i < 2 ? i % 2 : -1, zoom: 1, ox: 0, oy: 0 });
  }
  return {
    layout: 'grid9',
    grade: 'sunset',
    title: 'NEON COAST',
    subtitle: 'welcome to the coast',
    caption: 'One city. Nine stories.',
    captionSize: 1,
    captionColor: '#ffffff',
    heat: 5,
    badge: 'VICE VIBES',
    panels,
  };
}

export function coverStateSnapshot(state) {
  return JSON.parse(JSON.stringify(state));
}

export function panelCountForLayout(layoutId) {
  const found = COVER_LAYOUTS.find((l) => l.id === layoutId);
  return found ? found.panels : 1;
}

/* Undo / redo history over cover-state snapshots. */
export class CoverHistory {
  constructor(initialState) {
    this.past = [];
    this.future = [];
    this.present = coverStateSnapshot(initialState);
  }
  commit(nextState) {
    this.past.push(this.present);
    if (this.past.length > 60) this.past.shift();
    this.future = [];
    this.present = coverStateSnapshot(nextState);
  }
  undo() {
    if (this.past.length === 0) return null;
    this.future.push(this.present);
    this.present = this.past.pop();
    return coverStateSnapshot(this.present);
  }
  redo() {
    if (this.future.length === 0) return null;
    this.past.push(this.present);
    this.present = this.future.pop();
    return coverStateSnapshot(this.present);
  }
  canUndo() { return this.past.length > 0; }
  canRedo() { return this.future.length > 0; }
}

/* Load an image file (or a relative sample path) into an <img>. */
export function loadPhotoImage(source) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('photo could not be loaded'));
    img.src = source;
  });
}

/* Read a user file into a data URL image, never uploading it anywhere. */
export function readUserPhotoFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      loadPhotoImage(reader.result).then(resolve, reject);
    };
    reader.onerror = () => reject(new Error('photo file could not be read'));
    reader.readAsDataURL(file);
  });
}

/* The two bundled sample photos, free to use with the kit. */
export const SAMPLE_PHOTOS = [
  { id: 'boulevard', label: 'Boulevard sample', src: 'samples/boulevard.jpg' },
  { id: 'pier', label: 'Pier sample', src: 'samples/pier.jpg' },
];

/* Fill every panel of the current layout with the given photo, or spread
 * the library across the panels in order when several photos are loaded. */
export function fillPanelsWithPhotos(state, photoCount) {
  const next = coverStateSnapshot(state);
  const total = panelCountForLayout(next.layout);
  for (let i = 0; i < total; i++) {
    next.panels[i].photo = photoCount <= 1 ? 0 : i % photoCount;
    next.panels[i].zoom = 1;
    next.panels[i].ox = 0;
    next.panels[i].oy = 0;
  }
  return next;
}

/* Point a single panel at one photo from the library. */
export function assignPhotoToPanel(state, panelIndex, photoIndex) {
  const next = coverStateSnapshot(state);
  if (next.panels[panelIndex]) {
    next.panels[panelIndex].photo = photoIndex;
    next.panels[panelIndex].zoom = 1;
    next.panels[panelIndex].ox = 0;
    next.panels[panelIndex].oy = 0;
  }
  return next;
}
