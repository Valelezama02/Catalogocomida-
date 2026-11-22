/**
 * Lee el texto de la foto de una factura con Tesseract (OCR, corre en el celular).
 * Antes se mejora la imagen: escala de grises, más contraste y tamaño adecuado.
 */
export async function recognizeReceipt(file: File, onProgress: (p: number, status: string) => void): Promise<string> {
  onProgress(0, 'Preparando la imagen…');
  const canvas = await preprocess(file);
  onProgress(0.05, 'Cargando el lector (la primera vez tarda un poco)…');
  const { createWorker } = await import('tesseract.js');
  const base = new URL('ocr/', document.baseURI).href;
  const worker = await createWorker('spa', 1, {
    workerPath: base + 'worker.min.js',
    corePath: base,
    langPath: base,
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') onProgress(0.1 + m.progress * 0.9, 'Leyendo la factura…');
    },
  });
  try {
    await worker.setParameters({ preserve_interword_spaces: '1' } as never);
    const { data } = await worker.recognize(canvas);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

async function preprocess(file: File): Promise<HTMLCanvasElement> {
  const bmp = await createImageBitmap(file);
  const targetW = Math.min(2000, Math.max(1200, bmp.width));
  const scale = targetW / bmp.width;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d')!;
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (g - 128) * 1.6 + 128));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
