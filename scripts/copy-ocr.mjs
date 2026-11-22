// Copia el lector de facturas (Tesseract) y el idioma español a public/ocr,
// para que la app no dependa de servicios externos para leer facturas.
import { copyFileSync, mkdirSync } from 'node:fs';
const out = 'public/ocr';
mkdirSync(out, { recursive: true });
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'spa.traineddata.gz'],
];
for (const [from, to] of files) copyFileSync(from, `${out}/${to}`);
console.log('OCR copiado a', out);
