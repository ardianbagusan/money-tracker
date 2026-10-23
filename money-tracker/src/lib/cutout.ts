// Cuts a dish out of a meal photo, on the phone. Two ways:
//  - Tap: Google's free MediaPipe "Magic Touch" model finds the outline around where you tap.
//  - Trace: you draw around the dish with your finger (always works, no download).
// The finished sticker is a small WebP (PNG on browsers that can't make WebP) with a white border.
'use client';

export type Pt = { x: number; y: number }; // 0–1 of the photo's size
export type TapPoint = Pt & { mode: 'add' | 'remove' };
export type CutoutResult = { image: string; width: number; height: number; method: 'tap' | 'lasso'; outline: unknown[] };

// The WASM runtime is served by this app (public/mediapipe). The model is ~10–20 MB and is
// loaded from the app if you add it to public/models, otherwise from Google's official address.
const LOCAL_MODEL = '/models/interactive_segmentation.task';
const GOOGLE_MODEL = 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter_v2/magic_touch/int8/1/interactive_segmentation.task';

let segPromise: Promise<any> | null = null;

async function modelPath() {
  try {
    const r = await fetch(LOCAL_MODEL, { method: 'HEAD' });
    const type = r.headers.get('content-type') || '';
    if (r.ok && !type.includes('html')) return LOCAL_MODEL;
  } catch {}
  return GOOGLE_MODEL;
}

/** Loads the tap-to-cut model once per visit. Rejects if it can't load (offline, blocked, old phone). */
export function loadSegmenter() {
  if (!segPromise) {
    segPromise = (async () => {
      const { InteractiveSegmenter } = await import('@mediapipe/tasks-vision');
      // One runtime file pair (needs WebAssembly SIMD: iOS 16.4+, current Chrome/Android).
      const files = { wasmLoaderPath: '/mediapipe/vision_wasm_internal.js', wasmBinaryPath: '/mediapipe/vision_wasm_internal.wasm' };
      return InteractiveSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: await modelPath(), delegate: 'CPU' } });
    })();
    segPromise.catch(() => (segPromise = null));
  }
  return segPromise;
}

/** The photo drawn into a canvas, longest side at most 1024 px (the model works at 768). */
export async function photoCanvas(file: Blob, maxSide = 1024): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read that photo.'));
      i.src = url;
    });
    const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s);
    c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

let lastImage: HTMLCanvasElement | null = null;

/** Runs the model for a set of taps. Returns a mask: one 0–1 value per pixel of the photo canvas. */
export async function maskFromTaps(photo: HTMLCanvasElement, taps: TapPoint[]): Promise<Float32Array> {
  const seg = await loadSegmenter();
  const { BrushMode } = await import('@mediapipe/tasks-vision');
  if (lastImage !== photo) {
    seg.setImage(photo); // the heavy step, once per photo
    lastImage = photo;
  }
  const strokes = taps.map((t) => ({ brushMode: t.mode === 'add' ? BrushMode.POSITIVE : BrushMode.NEGATIVE, point: [{ x: t.x, y: t.y }], isCompleted: true }));
  const m = seg.segment(strokes);
  try {
    let a: Float32Array;
    if (m.hasFloat32Array()) a = Float32Array.from(m.getAsFloat32Array());
    else {
      const u = m.getAsUint8Array();
      let max = 0;
      for (let i = 0; i < u.length; i++) if (u[i] > max) max = u[i];
      const div = max > 1 ? 255 : 1;
      a = Float32Array.from(u, (v: number) => v / div);
    }
    // The mask may come back at a different size from the photo; resample to the photo's size.
    if (m.width !== photo.width || m.height !== photo.height) a = resample(a, m.width, m.height, photo.width, photo.height);
    return a;
  } finally {
    m.close();
  }
}

function resample(a: Float32Array, w: number, h: number, W: number, H: number) {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(h - 1, Math.floor((y / H) * h));
    for (let x = 0; x < W; x++) out[y * W + x] = a[sy * w + Math.min(w - 1, Math.floor((x / W) * w))];
  }
  return out;
}

/** A mask from a traced outline (points 0–1). */
export function maskFromLasso(photo: HTMLCanvasElement, pts: Pt[]): Float32Array {
  const c = document.createElement('canvas');
  c.width = photo.width;
  c.height = photo.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.filter = 'blur(1.5px)';
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * c.width, p.y * c.height) : ctx.moveTo(p.x * c.width, p.y * c.height)));
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  const out = new Float32Array(c.width * c.height);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255;
  return out;
}

/** How much of the photo the mask covers (0–1). Used to warn about an empty or whole-photo cut. */
export function maskCoverage(mask: Float32Array) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i] > 0.5) n++;
  return n / mask.length;
}

/** A tinted overlay showing the selection, drawn over the photo in the editor. */
export function maskOverlay(photo: HTMLCanvasElement, mask: Float32Array): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = photo.width;
  c.height = photo.height;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(c.width, c.height);
  for (let i = 0; i < mask.length; i++) {
    const a = mask[i] > 0.5 ? 0.45 : 0;
    img.data[i * 4] = 245;
    img.data[i * 4 + 1] = 140;
    img.data[i * 4 + 2] = 60;
    img.data[i * 4 + 3] = a * 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Turns photo + mask into a sticker: cropped, max 512 px, transparent outside, white border. */
export function makeSticker(photo: HTMLCanvasElement, mask: Float32Array, method: 'tap' | 'lasso', outline: unknown[], maxSide = 512): CutoutResult {
  const W = photo.width, H = photo.height;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x] > 0.5) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('Nothing is selected yet.');
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.06) + 4;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W - 1, x1 + pad); y1 = Math.min(H - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;

  // Alpha mask as an image, cropped
  const mc = document.createElement('canvas');
  mc.width = cw; mc.height = ch;
  const mctx = mc.getContext('2d')!;
  const md = mctx.createImageData(cw, ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const v = mask[(y + y0) * W + (x + x0)];
    const a = Math.max(0, Math.min(1, (v - 0.35) / 0.3)); // soft edge
    const i = (y * cw + x) * 4;
    md.data[i] = md.data[i + 1] = md.data[i + 2] = 255;
    md.data[i + 3] = a * 255;
  }
  mctx.putImageData(md, 0, 0);

  const s = Math.min(1, maxSide / Math.max(cw, ch));
  const border = Math.max(3, Math.round(Math.max(cw, ch) * s * 0.018));
  const ow = Math.round(cw * s) + border * 2, oh = Math.round(ch * s) + border * 2;
  const out = document.createElement('canvas');
  out.width = ow; out.height = oh;
  const ctx = out.getContext('2d')!;
  // White border: the silhouette drawn around in a ring, then the dish on top
  for (let k = 0; k < 16; k++) {
    const t = (k / 16) * Math.PI * 2;
    ctx.drawImage(mc, border + Math.cos(t) * border, border + Math.sin(t) * border, cw * s, ch * s);
  }
  const dish = document.createElement('canvas');
  dish.width = Math.round(cw * s); dish.height = Math.round(ch * s);
  const dctx = dish.getContext('2d')!;
  dctx.drawImage(photo, x0, y0, cw, ch, 0, 0, dish.width, dish.height);
  dctx.globalCompositeOperation = 'destination-in';
  dctx.drawImage(mc, 0, 0, dish.width, dish.height);
  ctx.drawImage(dish, border, border);

  let image = out.toDataURL('image/webp', 0.85);
  if (!image.startsWith('data:image/webp')) image = out.toDataURL('image/png');
  return { image, width: ow, height: oh, method, outline };
}
