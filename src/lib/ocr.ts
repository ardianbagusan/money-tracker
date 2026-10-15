// Reads the text on a receipt photo inside the browser (Tesseract.js).
// Nothing is sent anywhere: the reader and language files are served by this app
// and the photo is processed on the device. The first run downloads about 9 MB
// (once; the browser keeps the language files afterwards).
import type { Worker } from 'tesseract.js';

let workerPromise: Promise<Worker> | null = null;
let progressCb: ((p: number, stage: string) => void) | null = null;

function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker(['ind', 'eng'], 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr',
        langPath: '/ocr/lang',
        workerBlobURL: false,
        logger: (m: { status: string; progress: number }) => {
          if (!progressCb) return;
          if (m.status === 'recognizing text') progressCb(0.3 + m.progress * 0.7, 'Reading');
          else if (m.status.includes('loading')) progressCb(Math.min(0.3, m.progress * 0.3), 'Loading the reader');
        },
      });
      await w.setParameters({
        tessedit_pageseg_mode: '6' as any, // treat the receipt as one block of lines
        preserve_interword_spaces: '1',
      });
      return w;
    })();
    workerPromise.catch(() => (workerPromise = null));
  }
  return workerPromise;
}

/** Grayscale, enlarge small photos, cap big ones. Helps the reader a lot. */
async function prepare(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('Could not read that image.'));
      i.src = url;
    });
    const long = Math.max(img.naturalWidth, img.naturalHeight);
    const scale = long > 2200 ? 2200 / long : long < 1200 ? 1200 / long : 1;
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    // Grayscale with a contrast stretch (faded thermal paper is the usual problem)
    const d = ctx.getImageData(0, 0, w, h);
    const px = d.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) {
      const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      px[i] = g;
      hist[g]++;
    }
    const n = w * h;
    let lo = 0, hi = 255, acc = 0;
    for (; lo < 255 && (acc += hist[lo]) < n * 0.01; lo++);
    acc = 0;
    for (; hi > 0 && (acc += hist[hi]) < n * 0.01; hi--);
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((px[i] - lo) * 255) / span));
      px[i] = px[i + 1] = px[i + 2] = v;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function readImageText(file: Blob, onProgress?: (p: number, stage: string) => void): Promise<string> {
  progressCb = onProgress ?? null;
  try {
    onProgress?.(0.02, 'Preparing photo');
    const canvas = await prepare(file);
    const worker = await getWorker();
    const { data } = await worker.recognize(canvas);
    return data.text || '';
  } finally {
    progressCb = null;
  }
}
