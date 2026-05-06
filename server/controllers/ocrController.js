const { createWorker } = require('tesseract.js');
const fs = require('fs');
const { execSync } = require('child_process');

const serverCommit = (() => {
  const envCommit =
    process.env.RENDER_GIT_COMMIT ||
    process.env.GIT_COMMIT ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA ||
    '';
  if (envCommit) return String(envCommit).slice(0, 12);
  try {
    return String(execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }) || '')
      .trim();
  } catch (_) {
    void _;
    return null;
  }
})();

let jimpResolved = null;
let jimpResolvePromise = null;
let jimpResolveError = null;

const noiseKeywords =
  /(сума|сумма|всього|разом|итого|підсумок|оплата|знижка|накладна|рахунок|invoice|замовлення|(?:терм|term)\S{0,12}\s*(?:пост|постав|postav|supply)\S{0,12}|поставк|доставк|постачальник|покупець|iban|edrpou|єдрпоу|код|тел|телефон|адреса|склад|наявност|РАЗОМ)/i;
const deleteKeywords = /(удалить|видалити|delete)/i;
const brandSpaceSkuKeywords = /\b(?:SKF|INA|SNR|DAYCO|GATES|CONTINENTAL|BMW)\b/i;
const hasBrandSpaceSku = (value) => {
  const line = String(value || '').trim();
  if (!line) return false;
  if (!brandSpaceSkuKeywords.test(line)) return false;
  return /\b[A-Z]{2,6}\s+\d{3,}\b/i.test(line) || /\b\d{7,}\b/.test(line);
};

const isLikelyPartNumberLine = (value) => {
  const line = String(value || '').trim();
  if (!line) return false;
  if (hasBrandSpaceSku(line)) return true;
  const hasSkuToken =
    /\b\d{2,}-\d{2,}(?:-\d{2,})?\b/.test(line) ||
    /\b\d{2,}[.]\d{2,}\b/.test(line) ||
      /\b0\d{4,}\b/.test(line) ||
    /\b[A-Z]{1,3}\d{3,}(?:-\d{2,})?\b/i.test(line) ||
    /\b\d{2}\s\d{2}\s\d{4}\b/.test(line);
  if (!hasSkuToken) return false;
  return /[A-Za-zА-Яа-яІіЇїЄє]{2,}/.test(line);
};

const isSkuOnlyLine = (value) => {
  const line = String(value || '').trim();
  if (!line) return false;
  const currencyKeywords = /(грн|uah|₴)/i;
  const priceKeywords = /(ціна|цiна|цена|price)/i;
  if (currencyKeywords.test(line) || priceKeywords.test(line)) return false;
  if (hasBrandSpaceSku(line)) return true;
  if (/\b[A-Z]{1,4}\d{3,}\b/i.test(line)) return true;
  if (/\b\d{2,}-\d{2,}(?:-\d{2,})?\b/.test(line)) return true;
  return false;
};

const scoreOcrText = (value) => {
  const text = String(value || '');
  if (!text) return 0;
  const lines = text
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const skuHits = lines.filter((l) => isLikelyPartNumberLine(l) || isSkuOnlyLine(l)).length;
  const moneyHits = lines.filter((l) => /\b\d{2,6}(?:[.,]\d{1,2})?\b/.test(l)).length;
  const noiseHits = lines.filter((l) => noiseKeywords.test(l) || deleteKeywords.test(l)).length;
  const len = text.length;
  return skuHits * 10 + moneyHits * 2 - noiseHits * 3 + Math.min(3000, len) / 100;
};

const partsCandidateBrandRegex =
  /\b(VICTOR\s+REINZ|ELRING|FEBI(?:\s+BILSTEIN)?|BILSTEIN|SWAG|BMW|JP\s+GROUP|SKF|BOSCH|INA|SACHS|LEMFORDER|K2|К2)\b/i;
const partsNameNoiseRegex = /\b(?:терм|постав|склад|наявност|разом|итого|всього)\b/i;

const normalizePartNumberKey = (value) => String(value || '').replace(/[\s./-]+/g, '').toLowerCase();
const normalizePartNameKey = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[|©»«]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getParsedPartsStats = (items) => {
  const arr = Array.isArray(items) ? items : [];
  let qtyGtOne = 0;
  let withPartNumber = 0;
  for (const item of arr) {
    const qty = Number(item?.quantity || 0);
    if (qty > 1) qtyGtOne += 1;
    if (String(item?.part_number || '').trim()) withPartNumber += 1;
  }
  return { count: arr.length, qtyGtOne, withPartNumber };
};

const isNoisyParsedPartName = (value) => {
  const name = normalizePartNameKey(value);
  if (!name) return true;
  if (partsNameNoiseRegex.test(name)) return true;
  if (name.split(' ').filter((token) => token.length === 1).length >= 3) return true;
  return false;
};

const getParsedPartQuality = (item) => {
  if (!item) return -Infinity;
  const name = String(item?.name || '');
  const pn = String(item?.part_number || '').trim();
  const price = Number(item?.price || 0);
  const qty = Number(item?.quantity || 0);
  let score = 0;
  if (name.length >= 8) score += 2;
  if (/[А-Яа-яІіЇїЄєҐґ]{4,}|[A-Za-z]{4,}/.test(name)) score += 1;
  if (partsCandidateBrandRegex.test(name)) score += 2;
  if (pn) score += 4;
  if (price >= 10 && price <= 5000) score += 2;
  else if (price > 5000) score -= 2;
  if (qty >= 1 && qty <= 20) score += 1;
  if (qty > 1) score += 1;
  if (isNoisyParsedPartName(name)) score -= 4;
  return score;
};

const scoreParsedParts = (items) => {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return -Infinity;
  let score = 0;
  for (const item of arr) {
    score += getParsedPartQuality(item);
  }
  const stats = getParsedPartsStats(arr);
  score += Math.min(60, arr.length * 4);
  if (arr.length >= 6 && stats.qtyGtOne === 0) score -= 12;
  return score;
};

const pickBetterParsedPart = (left, right) => {
  if (!left) return right;
  if (!right) return left;
  const leftScore = getParsedPartQuality(left);
  const rightScore = getParsedPartQuality(right);
  if (rightScore !== leftScore) return rightScore > leftScore ? right : left;

  const leftPn = normalizePartNumberKey(left?.part_number || '');
  const rightPn = normalizePartNumberKey(right?.part_number || '');
  if (rightPn.length !== leftPn.length) return rightPn.length > leftPn.length ? right : left;

  const leftName = normalizePartNameKey(left?.name || '');
  const rightName = normalizePartNameKey(right?.name || '');
  if (rightName.length !== leftName.length) return rightName.length > leftName.length ? right : left;

  return left;
};

const mergePartsAcrossOcrAttempts = (lists) => {
  const byPn = new Map();
  const byNamePriceQty = new Map();

  for (const list of Array.isArray(lists) ? lists : []) {
    for (const item of Array.isArray(list) ? list : []) {
      if (!item) continue;
      const price = Number(item?.price || 0);
      const qty = Number(item?.quantity || 1);
      if (!Number.isFinite(price) || price <= 0) continue;
      const pnKey = normalizePartNumberKey(item?.part_number || '');
      if (pnKey) {
        byPn.set(pnKey, pickBetterParsedPart(byPn.get(pnKey), item));
        continue;
      }
      const key = `${normalizePartNameKey(item?.name || '')}|${price}|${qty}`;
      if (!key.startsWith('|')) {
        byNamePriceQty.set(key, pickBetterParsedPart(byNamePriceQty.get(key), item));
      }
    }
  }

  const pnShadowKeys = new Set(
    Array.from(byPn.values()).map(
      (item) => `${normalizePartNameKey(item?.name || '')}|${Number(item?.price || 0)}|${Number(item?.quantity || 1)}`
    )
  );

  return [
    ...Array.from(byPn.values()),
    ...Array.from(byNamePriceQty.entries())
      .filter(([key]) => !pnShadowKeys.has(key))
      .map(([, item]) => item),
  ].filter(Boolean);
};

const selectBestPartsOcrAttempt = (attempts) => {
  const normalized = (Array.isArray(attempts) ? attempts : [])
    .map((attempt, index) => {
      const parts = Array.isArray(attempt?.parts) ? attempt.parts.filter(Boolean) : [];
      const partsScore = Number.isFinite(attempt?.partsScore) ? attempt.partsScore : scoreParsedParts(parts);
      const ocrScore = Number.isFinite(attempt?.ocrScore)
        ? attempt.ocrScore
        : scoreOcrText(String(attempt?.rawText || ''));
      const stats = getParsedPartsStats(parts);
      const candidateScore =
        (partsScore === -Infinity ? -1000 : partsScore * 20) +
        Math.min(160, ocrScore) +
        Math.min(18, stats.withPartNumber * 2);
      return {
        ...attempt,
        index,
        parts,
        partsScore,
        ocrScore,
        stats,
        candidateScore,
      };
    })
    .filter((attempt) => attempt.parts.length || String(attempt?.rawText || '').trim());

  if (!normalized.length) {
    return {
      attempts: [],
      bestAttempt: null,
      selectedParts: [],
      selectedRawText: '',
      selectedData: null,
      selectedUsedPath: 'original',
      selectedUsedPsm: '',
      selectedMode: 'single',
      mergeCandidates: [],
      mergedParts: [],
      mergedScore: -Infinity,
    };
  }

  const ranked = normalized
    .slice()
    .sort(
      (a, b) =>
        (b.candidateScore || 0) - (a.candidateScore || 0) ||
        (b.partsScore || 0) - (a.partsScore || 0) ||
        (b.stats?.count || 0) - (a.stats?.count || 0)
    );

  const bestAttempt = ranked[0];
  const mergeCandidates = ranked.filter((attempt) => attempt.parts.length && attempt.partsScore >= bestAttempt.partsScore - 8).slice(0, 4);
  const mergedParts = mergePartsAcrossOcrAttempts(mergeCandidates.map((attempt) => attempt.parts));
  const mergedScore = scoreParsedParts(mergedParts);
  const mergedStats = getParsedPartsStats(mergedParts);

  const shouldUseMerged =
    mergeCandidates.length >= 2 &&
    mergedParts.length > 0 &&
    (
      mergedScore > bestAttempt.partsScore + 3 ||
      (mergedScore >= bestAttempt.partsScore - 1 && mergedStats.count >= bestAttempt.stats.count + 2) ||
      (mergedScore >= bestAttempt.partsScore && mergedStats.withPartNumber > bestAttempt.stats.withPartNumber)
    );

  return {
    attempts: ranked,
    bestAttempt,
    selectedParts: shouldUseMerged ? mergedParts : bestAttempt.parts,
    selectedRawText: String(bestAttempt.rawText || ''),
    selectedData: bestAttempt.data || null,
    selectedUsedPath: shouldUseMerged ? 'ensemble' : String(bestAttempt.usedPath || bestAttempt.inputLabel || 'original'),
    selectedUsedPsm: shouldUseMerged
      ? `merge(${mergeCandidates.map((attempt) => `${attempt.inputLabel || attempt.usedPath || 'ocr'}:${attempt.psm || ''}`).join('+')})`
      : String(bestAttempt.psm || ''),
    selectedMode: shouldUseMerged ? 'merged' : 'single',
    mergeCandidates: shouldUseMerged ? mergeCandidates : [],
    mergedParts,
    mergedScore,
  };
};

async function getJimp() {
  if (jimpResolvePromise) return jimpResolvePromise;
  jimpResolvePromise = (async () => {
    const errors = [];
    // Try 1: dynamic import (works for ESM jimp v1 in CJS Node)
    try {
      const mod = await import('jimp');
      // jimp v1 exports { Jimp } as named export
      const candidates = [mod?.Jimp, mod?.default, mod];
      for (const resolved of candidates) {
        if (resolved && typeof resolved.read === 'function') {
          jimpResolved = resolved;
          jimpResolveError = null;
          return jimpResolved;
        }
      }
      errors.push('import("jimp") loaded but no .read(): keys=' + Object.keys(mod || {}).join(','));
    } catch (err) {
      errors.push('import("jimp") error: ' + String(err?.message || err));
    }
    // Try 2: require (works for jimp v0.x CJS)
    try {
      const mod = require('jimp');
      const candidates = [mod?.Jimp, mod?.default, mod];
      for (const resolved of candidates) {
        if (resolved && typeof resolved.read === 'function') {
          jimpResolved = resolved;
          jimpResolveError = null;
          return jimpResolved;
        }
      }
      errors.push('require("jimp") loaded but no .read(): keys=' + Object.keys(mod || {}).join(','));
    } catch (err) {
      errors.push('require("jimp") error: ' + String(err?.message || err));
    }
    jimpResolved = null;
    jimpResolveError = errors.join(' | ');
    return null;
  })();
  const result = await jimpResolvePromise;
  if (!result) {
    // Do NOT cache a failed promise forever; allow retry on next request.
    jimpResolvePromise = null;
  }
  return result;
}

function resizeKeepAspect(img, targetW) {
  const w = img.bitmap?.width || 1;
  const h = img.bitmap?.height || 1;
  const nextH = Math.max(1, Math.round((h / w) * targetW));

  // Jimp v1+ expects an object: resize({ w, h })
  try {
    return img.resize({ w: targetW, h: nextH });
  } catch (err) {
    void err;
  }

  // Legacy Jimp: resize(w, h)
  return img.resize(targetW, nextH);
}

function cropCompat(img, x, y, w, h) {
  // Jimp v1+ expects an object: crop({ x, y, w, h })
  try {
    return img.crop({ x, y, w, h });
  } catch (err) {
    void err;
  }

  // Legacy Jimp: crop(x, y, w, h)
  return img.crop(x, y, w, h);
}

async function writeImage(img, outPath) {
  if (typeof img.writeAsync === 'function') {
    await img.writeAsync(outPath);
    return;
  }
  await new Promise((resolve, reject) => {
    img.write(outPath, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

let plateWorkerPromise = null;
let plateWorkerBusy = Promise.resolve();
let plateWorkerInstance = null;
let plateWorkerWarming = false;
let plateWorkerWarmupError = null;
let plateWorkerWarmupStartedAt = null;

const PLATE_WORKER_WARMUP_TIMEOUT_MS = 25000;
const PLATE_WORKER_WARMUP_STUCK_RESET_MS = 60000;

async function resetPlateWorker() {
  const instance = plateWorkerInstance;
  plateWorkerInstance = null;
  plateWorkerPromise = null;
  plateWorkerWarming = false;
  plateWorkerWarmupError = null;
  plateWorkerWarmupStartedAt = null;
  if (!instance) return;
  try {
    await instance.terminate();
  } catch (_) {
    void _;
  }
}

function withTimeout(promise, ms, onTimeout) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        if (typeof onTimeout === 'function') onTimeout();
      } catch (_) {
        void _;
      }
      const err = new Error('OCR timeout');
      err.code = 'OCR_TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

function withTimeoutCustom(promise, ms, { code, message }, onTimeout) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      try {
        if (typeof onTimeout === 'function') onTimeout();
      } catch (_) {
        void _;
      }
      const err = new Error(message || 'timeout');
      err.code = code || 'TIMEOUT';
      reject(err);
    }, ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

async function getPlateWorker() {
  if (plateWorkerPromise) return plateWorkerPromise;
  plateWorkerWarming = true;
  plateWorkerWarmupError = null;
  plateWorkerWarmupStartedAt = Date.now();
  plateWorkerPromise = (async () => {
    try {
      const worker = await withTimeoutCustom(
        createWorker('eng'),
        PLATE_WORKER_WARMUP_TIMEOUT_MS,
        {
          code: 'OCR_WARMUP_TIMEOUT',
          message: 'OCR warmup timeout',
        },
        () => {
          void resetPlateWorker();
        }
      );
      plateWorkerInstance = worker;
      try {
        await worker.setParameters({
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789АВЕІКМНОРСТХУЇЄҐ',
          preserve_interword_spaces: '1',
        });
      } catch (_) {
        void _;
      }
      plateWorkerWarming = false;
      plateWorkerWarmupError = null;
      return worker;
    } catch (err) {
      plateWorkerWarmupError = String(err?.message || err);
      plateWorkerInstance = null;
      plateWorkerPromise = null;
      plateWorkerWarming = false;
      plateWorkerWarmupStartedAt = null;
      throw err;
    }
  })();
  return plateWorkerPromise;
}

async function ensurePlateWorkerReady(timeoutMs = 15000) {
  if (plateWorkerInstance) return plateWorkerInstance;
  const promise = getPlateWorker();
  return await withTimeout(promise, timeoutMs, () => {
    void resetPlateWorker();
  });
}

async function withPlateWorker(fn) {
  let release;
  const next = new Promise((resolve) => {
    release = resolve;
  });
  const prev = plateWorkerBusy;
  plateWorkerBusy = prev.then(() => next);
  try {
    await withTimeout(prev, 120000);
  } catch (_) {
    const err = new Error('OCR busy');
    err.code = 'OCR_BUSY';
    throw err;
  }
  try {
    const worker = await ensurePlateWorkerReady(20000);
    return await fn(worker);
  } finally {
    release();
  }
}

// Best-effort warmup to reduce Render cold-start latency
try {
  if (process.env.NODE_ENV !== 'test') {
    const t = setTimeout(() => {
      void ensurePlateWorkerReady(15000).catch(() => undefined);
    }, 0);
    if (typeof t?.unref === 'function') t.unref();
  }
} catch (_) {
  void _;
}

async function parsePartsFromImageInternal(req) {
  const imagePath = req.file.path;

  let ocrPath = imagePath;
  let preprocessedPath = null;
  let preprocessingApplied = false;

  let jimpLoadError = null;
  let jimpPreprocError = null;
  try {
    const Jimp = await getJimp();
    if (!Jimp) {
      jimpLoadError = jimpResolveError || 'Jimp returned null';
      console.warn('[OCR_JIMP_FAIL]', jimpLoadError);
    } else {
      console.log('[OCR_PREPROC] Jimp loaded, reading image...');
      const img = await Jimp.read(imagePath);
      const w = img.bitmap?.width || 0;
      const h = img.bitmap?.height || 0;
      console.log('[OCR_PREPROC] Image size:', w, 'x', h);
      if (w > 0 && h > 0) {
        const intToRGBA = (num) => ({
          r: (num >> 24) & 0xFF,
          g: (num >> 16) & 0xFF,
          b: (num >> 8) & 0xFF,
          a: num & 0xFF,
        });
        const samplePoints = [
          { x: Math.floor(w * 0.2), y: Math.floor(h * 0.2) },
          { x: Math.floor(w * 0.5), y: Math.floor(h * 0.5) },
          { x: Math.floor(w * 0.8), y: Math.floor(h * 0.8) },
        ];
        let brightnessSum = 0;
        for (const p of samplePoints) {
          const clr = img.getPixelColor(p.x, p.y);
          const rgba = intToRGBA(clr);
          brightnessSum += (rgba.r + rgba.g + rgba.b) / 3;
        }
        const avgBrightness = brightnessSum / samplePoints.length;
        const isDarkBackground = avgBrightness < 110;
        console.log('[OCR_PREPROC] Dark background:', isDarkBackground, 'avgBright:', avgBrightness);

        // jimp v1 has no .clone(); process the original image directly (we won't need it again).
        const processed = img;
        try { processed.grayscale(); } catch (_) { void _; }
        console.log('[OCR_PREPROC] Grayscale ok');
        try { processed.contrast(0.35); } catch (_) { void _; }
        if (isDarkBackground) { try { processed.invert(); } catch (_) { void _; } }
        try { processed.normalize(); } catch (_) { void _; }
        try { processed.contrast(0.55); } catch (_) { void _; }
        try {
          processed.convolute([[0, -1, 0], [-1, 5, -1], [0, -1, 0]]);
        } catch (_) { void _; }

        const targetWidth = Math.min(2400, Math.max(1400, w < 1400 ? 1400 : w));
        if (w < targetWidth) { resizeKeepAspect(processed, targetWidth); }

        try {
          const bwThreshold = isDarkBackground ? 170 : 155;
          processed.scan(0, 0, processed.bitmap.width, processed.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            const lum = (r + g + b) / 3;
            const v = lum >= bwThreshold ? 255 : 0;
            this.bitmap.data[idx + 0] = v;
            this.bitmap.data[idx + 1] = v;
            this.bitmap.data[idx + 2] = v;
          });
          console.log('[OCR_PREPROC] Binarization ok');
        } catch (_) { void _; }

        preprocessedPath = `${imagePath}_preprocessed.png`;
        let writeOk = false;
        try {
          // jimp v1 .write() returns a Promise; no .writeAsync() exists.
          console.log('[OCR_PREPROC] Trying write...');
          await processed.write(preprocessedPath);
          console.log('[OCR_PREPROC] write success');
          writeOk = true;
        } catch (err) {
          jimpPreprocError = String(err?.message || err);
          console.warn('[OCR_PREPROC_WRITE_FAIL]', jimpPreprocError);
        }
        if (writeOk) {
          ocrPath = preprocessedPath;
          preprocessingApplied = true;
          console.log('[OCR_PREPROC] SUCCESS, path=', preprocessedPath);
        } else {
          preprocessedPath = null;
          ocrPath = imagePath;
          preprocessingApplied = false;
          console.warn('[OCR_PREPROC] FAILED, falling back to original');
        }
      } else {
        console.warn('[OCR_PREPROC] Invalid image dimensions');
      }
    }
  } catch (err) {
    jimpPreprocError = String(err?.message || err);
    console.warn('[OCR_PREPROC_CATCH]', jimpPreprocError);
    ocrPath = imagePath;
    preprocessedPath = null;
    preprocessingApplied = false;
  }

  let bestText = '';
  let bestData = null;
  let bestPsm = '6';
  let bestParts = [];
  let bestUsedPath = ocrPath === imagePath ? 'original' : 'preprocessed';
  const ocrAttempts = [];
  const candidateInputs = preprocessingApplied
    ? [
        { inputLabel: 'preprocessed', usedPath: 'preprocessed', path: preprocessedPath },
        { inputLabel: 'original', usedPath: 'original', path: imagePath },
      ]
    : [{ inputLabel: 'original', usedPath: 'original', path: imagePath }];

  const runPartsOcrAttempt = async (activeWorker, { inputLabel, usedPath, path, psm, lang }) => {
    const label = `${lang}:${inputLabel}:psm${psm}`;
    try {
      try {
        await activeWorker.setParameters({
          preserve_interword_spaces: '1',
          user_defined_dpi: '300',
          tessedit_pageseg_mode: String(psm),
        });
      } catch (_) {
        void _;
      }

      const recognized = await activeWorker.recognize(path);
      const data = recognized?.data || {};
      const rawText = String(data?.text || '');
      const parsedParts = parseOcrText(rawText, data || null);
      ocrAttempts.push({
        label,
        inputLabel,
        usedPath,
        psm: String(psm),
        lang,
        rawText,
        data,
        parts: parsedParts,
      });
    } catch (err) {
      ocrAttempts.push({
        label,
        inputLabel,
        usedPath,
        psm: String(psm),
        lang,
        rawText: '',
        data: null,
        parts: [],
        error: String(err?.message || err),
      });
    }
  };

  const worker = await createWorker('ukr+rus+eng');
  try {
    for (const input of candidateInputs) {
      for (const psm of ['6', '4']) {
        await runPartsOcrAttempt(worker, { ...input, psm, lang: 'ukr+rus+eng' });
      }
    }

    let selection = selectBestPartsOcrAttempt(ocrAttempts);
    let selectionStats = getParsedPartsStats(selection.selectedParts);

    if (selectionStats.count < 4 || selectionStats.withPartNumber < Math.max(1, Math.floor(selectionStats.count * 0.5))) {
      for (const input of candidateInputs) {
        await runPartsOcrAttempt(worker, { ...input, psm: '11', lang: 'ukr+rus+eng' });
      }
      selection = selectBestPartsOcrAttempt(ocrAttempts);
      selectionStats = getParsedPartsStats(selection.selectedParts);
    }

    if (selectionStats.count < 4 || selectionStats.withPartNumber === 0) {
      let engWorker = null;
      try {
        engWorker = await createWorker('eng');
        for (const input of candidateInputs) {
          await runPartsOcrAttempt(engWorker, { ...input, psm: '6', lang: 'eng' });
        }
      } catch (engErr) {
        void engErr;
      } finally {
        if (engWorker) {
          try {
            await engWorker.terminate();
          } catch (_) {
            void _;
          }
        }
      }
      selection = selectBestPartsOcrAttempt(ocrAttempts);
    }

    bestText = selection.selectedRawText || '';
    bestData = selection.selectedData || null;
    bestPsm = selection.selectedUsedPsm || '6';
    bestParts = selection.selectedParts || [];
    bestUsedPath = selection.selectedUsedPath || bestUsedPath;
  } finally {
    try {
      await worker.terminate();
    } catch (_) {
      void _;
    }
  }

  return {
    imagePath,
    preprocessedPath,
    preprocessingApplied,
    usedPath: bestUsedPath,
    usedPsm: bestPsm,
    rawText: bestText || '',
    parts: Array.isArray(bestParts) && bestParts.length ? bestParts : parseOcrText(bestText || '', bestData || null),
    attempts: ocrAttempts.map((attempt) => {
      const parts = Array.isArray(attempt?.parts) ? attempt.parts : [];
      const stats = getParsedPartsStats(parts);
      return {
        label: attempt?.label || '',
        inputLabel: attempt?.inputLabel || '',
        usedPath: attempt?.usedPath || '',
        psm: attempt?.psm || '',
        lang: attempt?.lang || '',
        rawText: attempt?.rawText || '',
        partsCount: stats.count,
        withPartNumber: stats.withPartNumber,
        qtyGtOne: stats.qtyGtOne,
        ocrScore: scoreOcrText(attempt?.rawText || ''),
        partsScore: scoreParsedParts(parts),
        error: attempt?.error || null,
      };
    }),
    jimpError: jimpLoadError,
    jimpPreprocError,
  };
}

function cleanupOcrFiles({ imagePath, preprocessedPath }) {
  if (imagePath) {
    fs.unlink(imagePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });
  }

  if (preprocessedPath) {
    fs.unlink(preprocessedPath, (err) => {
      if (err) void err;
    });
  }
}

exports.parsePartsFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Зображення не знайдено' });
    }

    const result = await parsePartsFromImageInternal(req);
    cleanupOcrFiles(result);
    return res.json(result.parts);
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ message: 'Помилка розпізнавання тексту', error: err.message });
  }
};

exports.parsePartsFromImageDebug = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Зображення не знайдено' });
    }

    const result = await parsePartsFromImageInternal(req);
    cleanupOcrFiles(result);
    return res.json({
      parts: result.parts,
      rawText: result.rawText,
      attempts: result.attempts || [],
      meta: {
        serverCommit,
        preprocessingApplied: result.preprocessingApplied,
        usedPath: result.usedPath,
        usedPsm: result.usedPsm,
        jimpError: result.jimpError,
        jimpPreprocError: result.jimpPreprocError,
      },
    });
  } catch (err) {
    console.error('OCR Error:', err);
    res.status(500).json({ message: 'Помилка розпізнавання тексту', error: err.message });
  }
};

exports.parseLicensePlateFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Зображення не знайдено' });
    }

    const debug = String(req.query?.debug || '') === '1';
    const fastMode = !debug;

    const imagePath = req.file.path;

    if (!plateWorkerInstance) {
      const warmupWaitMs = 12000;
      try {
        if (!plateWorkerWarming || (plateWorkerWarming && !plateWorkerPromise)) {
          void getPlateWorker().catch(() => undefined);
        }
      } catch (_) {
        void _;
      }

      try {
        if (plateWorkerPromise) {
          await withTimeoutCustom(plateWorkerPromise, warmupWaitMs, {
            code: 'OCR_WARMUP_WAIT_TIMEOUT',
            message: 'OCR warmup wait timeout',
          });
        }
      } catch (_) {
        void _;
      }

      if (plateWorkerInstance) {
        // Worker became ready during the wait window; proceed with OCR in this request.
      } else {
        if (plateWorkerWarming && !plateWorkerWarmupStartedAt) {
          plateWorkerWarmupStartedAt = Date.now();
        }

        const warmupSnapshot = {
          warming: Boolean(plateWorkerWarming),
          hasInstance: Boolean(plateWorkerInstance),
          hasPromise: Boolean(plateWorkerPromise),
          startedAtRaw: plateWorkerWarmupStartedAt,
          lastError: plateWorkerWarmupError,
        };

        const warmupStartedAtNum =
          warmupSnapshot.startedAtRaw === null || warmupSnapshot.startedAtRaw === undefined
            ? null
            : typeof warmupSnapshot.startedAtRaw === 'number'
              ? warmupSnapshot.startedAtRaw
              : Number(warmupSnapshot.startedAtRaw);
        const warmupStartedAtIsFinite =
          warmupStartedAtNum !== null && Number.isFinite(warmupStartedAtNum);
        const warmupStartedAtNumIsNaN =
          warmupStartedAtNum !== null && typeof warmupStartedAtNum === 'number'
            ? Number.isNaN(warmupStartedAtNum)
            : null;

        const warmupElapsedMs =
          warmupSnapshot.warming && warmupStartedAtIsFinite
            ? Date.now() - warmupStartedAtNum
            : null;

        if (
          warmupSnapshot.warming &&
          typeof warmupElapsedMs === 'number' &&
          warmupElapsedMs > PLATE_WORKER_WARMUP_STUCK_RESET_MS
        ) {
          void resetPlateWorker();
        }

        fs.unlink(imagePath, (err) => {
          if (err) void err;
        });

        return res.status(503).json({
          message: 'OCR warming up, please retry',
          warmup: {
            warming: warmupSnapshot.warming,
            hasInstance: warmupSnapshot.hasInstance,
            hasPromise: warmupSnapshot.hasPromise,
            startedAt: warmupStartedAtIsFinite ? warmupStartedAtNum : warmupSnapshot.startedAtRaw,
            startedAtType: typeof warmupSnapshot.startedAtRaw,
            startedAtIsFinite: warmupStartedAtIsFinite,
            startedAtNum: warmupStartedAtNum,
            startedAtNumIsNaN: warmupStartedAtNumIsNaN,
            elapsedMs: warmupElapsedMs,
            lastError: debug ? warmupSnapshot.lastError : warmupSnapshot.lastError,
          },
        });
      }
    }

    let preprocessedPath = null;
    let altPreprocessedPath = null;
    let fullPreprocessedPath = null;
    let binaryPreprocessedPath = null;
    let bottomPreprocessedPath = null;
    let plateCorePreprocessedPath = null;
    let fallbackPreprocessedPath = null;
    const preprocessErrors = {
      plate: null,
      binary: null,
      bottom: null,
      full: null,
    };

    const Jimp = await getJimp();

    if (Jimp) {
      try {
        const preprocessStartedAt = Date.now();
        // Render cold starts can be slow; give preprocessing enough time
        // so we still produce cropped plate-focused inputs.
        const preprocessBudgetMs = fastMode ? 18000 : 32000;
        const readTimeoutMs = fastMode ? 12000 : 22000;

        const remainingMs = () =>
          Math.max(0, preprocessBudgetMs - (Date.now() - preprocessStartedAt));

        const base = await withTimeoutCustom(
          Jimp.read(imagePath),
          Math.min(readTimeoutMs, remainingMs()),
          {
            code: 'OCR_PREPROCESS_READ_TIMEOUT',
            message: 'OCR preprocess read timeout',
          }
        );

        const runStep = async (key, fn) => {
          const left = remainingMs();
          if (left <= 0) {
            const err = new Error('OCR preprocess timeout');
            err.code = 'OCR_PREPROCESS_TIMEOUT';
            throw err;
          }
          return await withTimeoutCustom(fn(), left, {
            code: 'OCR_PREPROCESS_TIMEOUT',
            message: 'OCR preprocess timeout',
          });
        };

        try {
          await runStep('plate-core', async () => {
            const img = base.clone();
            const w = img.bitmap.width;
            const h = img.bitmap.height;

            const cropX = Math.max(0, Math.round(w * 0.26));
            const cropY = Math.max(0, Math.round(h * 0.63));
            const cropW = Math.min(w - cropX, Math.round(w * 0.48));
            const cropH = Math.min(h - cropY, Math.round(h * 0.2));

            cropCompat(img, cropX, cropY, cropW, cropH);
            resizeKeepAspect(img, 1200);
            img
              .greyscale()
              .contrast(0.95)
              .normalize()
              .convolute([
                [0, -1, 0],
                [-1, 5, -1],
                [0, -1, 0],
              ]);

            if (typeof img.threshold === 'function') {
              try {
                img.threshold({ max: 168 });
              } catch (_) {
                void _;
              }
            }

            plateCorePreprocessedPath = `${imagePath}-plate-core.png`;
            await writeImage(img, plateCorePreprocessedPath);
          });
        } catch (err) {
          preprocessErrors.plateCore = String(err?.message || err);
          plateCorePreprocessedPath = null;
        }

        try {
          await runStep('plate', async () => {
            const img = base.clone();
            const w = img.bitmap.width;
            const h = img.bitmap.height;

            const cropX = Math.max(0, Math.round(w * 0.18));
            const cropY = Math.max(0, Math.round(h * 0.4));
            const cropW = Math.min(w - cropX, Math.round(w * 0.64));
            const cropH = Math.min(h - cropY, Math.round(h * 0.35));

            cropCompat(img, cropX, cropY, cropW, cropH);
            resizeKeepAspect(img, 900);
            img.greyscale().contrast(0.6).normalize();

            preprocessedPath = `${imagePath}-plate.png`;
            await writeImage(img, preprocessedPath);
          });
        } catch (err) {
          preprocessErrors.plate = String(err?.message || err);
          preprocessedPath = null;
        }

        try {
          await runStep('plate-alt', async () => {
            const img = base.clone();
            const w = img.bitmap.width;
            const h = img.bitmap.height;

            // Alternative crop: higher and wider zone for front-car shots.
            const cropX = Math.max(0, Math.round(w * 0.1));
            const cropY = Math.max(0, Math.round(h * 0.22));
            const cropW = Math.min(w - cropX, Math.round(w * 0.8));
            const cropH = Math.min(h - cropY, Math.round(h * 0.42));

            cropCompat(img, cropX, cropY, cropW, cropH);
            resizeKeepAspect(img, 1100);
            img.greyscale().contrast(0.75).normalize();

            altPreprocessedPath = `${imagePath}-plate-alt.png`;
            await writeImage(img, altPreprocessedPath);
          });
        } catch (err) {
          preprocessErrors.full = preprocessErrors.full || String(err?.message || err);
          altPreprocessedPath = null;
        }

        try {
          await runStep('fallback', async () => {
            const img = base.clone();
            // Conservative full-frame preprocessing as last-resort OCR input.
            resizeKeepAspect(img, 1400);
            img.greyscale().contrast(0.45).normalize();
            fallbackPreprocessedPath = `${imagePath}-fallback.png`;
            await writeImage(img, fallbackPreprocessedPath);
          });
        } catch (err) {
          preprocessErrors.full = preprocessErrors.full || String(err?.message || err);
          fallbackPreprocessedPath = null;
        }

        try {
          if (remainingMs() < 3500) {
            preprocessErrors.binary = 'OCR preprocess skipped';
            throw new Error('OCR preprocess skipped');
          }
          await runStep('binary', async () => {
            const img = base.clone();
            const w = img.bitmap.width;
            const h = img.bitmap.height;

            const cropX = Math.max(0, Math.round(w * 0.12));
            const cropY = Math.max(0, Math.round(h * 0.42));
            const cropW = Math.min(w - cropX, Math.round(w * 0.76));
            const cropH = Math.min(h - cropY, Math.round(h * 0.42));

            cropCompat(img, cropX, cropY, cropW, cropH);
            resizeKeepAspect(img, 900);
            img
              .greyscale()
              .contrast(0.85)
              .normalize()
              .convolute([
                [0, -1, 0],
                [-1, 5, -1],
                [0, -1, 0],
              ]);

            if (typeof img.threshold === 'function') {
              try {
                img.threshold({ max: 170 });
              } catch (_) {
                void _;
              }
            } else {
              img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
                const v = this.bitmap.data[idx];
                const out = v > 170 ? 255 : 0;
                this.bitmap.data[idx] = out;
                this.bitmap.data[idx + 1] = out;
                this.bitmap.data[idx + 2] = out;
              });
            }

            binaryPreprocessedPath = `${imagePath}-bin.png`;
            await writeImage(img, binaryPreprocessedPath);
          });
        } catch (err) {
          preprocessErrors.binary = preprocessErrors.binary || String(err?.message || err);
          binaryPreprocessedPath = null;
        }

        try {
          if (remainingMs() < 3500) {
            preprocessErrors.bottom = 'OCR preprocess skipped';
            throw new Error('OCR preprocess skipped');
          }
          await runStep('bottom', async () => {
            const img = base.clone();
            const w = img.bitmap.width;
            const h = img.bitmap.height;

            const cropX = Math.max(0, Math.round(w * 0.05));
            const cropY = Math.max(0, Math.round(h * 0.52));
            const cropW = Math.min(w - cropX, Math.round(w * 0.9));
            const cropH = Math.min(h - cropY, Math.round(h * 0.45));

            cropCompat(img, cropX, cropY, cropW, cropH);
            resizeKeepAspect(img, 900);
            img.greyscale().contrast(0.85).normalize();

            bottomPreprocessedPath = `${imagePath}-bottom.png`;
            await writeImage(img, bottomPreprocessedPath);
          });
        } catch (err) {
          preprocessErrors.bottom = preprocessErrors.bottom || String(err?.message || err);
          bottomPreprocessedPath = null;
        }

        if (debug) {
          try {
            if (remainingMs() < 4500) {
              preprocessErrors.bottom = 'OCR preprocess skipped';
              throw new Error('OCR preprocess skipped');
            }
            await runStep('bottom', async () => {
              const img = base.clone();
              const w = img.bitmap.width;
              const h = img.bitmap.height;

              const cropX = Math.max(0, Math.round(w * 0.06));
              const cropY = Math.max(0, Math.round(h * 0.56));
              const cropW = Math.min(w - cropX, Math.round(w * 0.88));
              const cropH = Math.min(h - cropY, Math.round(h * 0.38));

              cropCompat(img, cropX, cropY, cropW, cropH);
              resizeKeepAspect(img, 900);
              img
                .greyscale()
                .contrast(0.9)
                .normalize()
                .convolute([
                  [0, -1, 0],
                  [-1, 5, -1],
                  [0, -1, 0],
                ]);

              if (typeof img.threshold === 'function') {
                try {
                  img.threshold({ max: 165 });
                } catch (_) {
                  void _;
                }
              } else {
                img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
                  const v = this.bitmap.data[idx];
                  const out = v > 165 ? 255 : 0;
                  this.bitmap.data[idx] = out;
                  this.bitmap.data[idx + 1] = out;
                  this.bitmap.data[idx + 2] = out;
                });
              }

              bottomPreprocessedPath = `${imagePath}-bottom.png`;
              await writeImage(img, bottomPreprocessedPath);
            });
          } catch (err) {
            preprocessErrors.bottom = preprocessErrors.bottom || String(err?.message || err);
            bottomPreprocessedPath = null;
          }

          try {
            if (remainingMs() < 4500) {
              preprocessErrors.full = 'OCR preprocess skipped';
              throw new Error('OCR preprocess skipped');
            }
            await runStep('full', async () => {
              const full = base.clone();
              resizeKeepAspect(full, 1200);
              full.greyscale().contrast(0.5).normalize();
              fullPreprocessedPath = `${imagePath}-full.png`;
              await writeImage(full, fullPreprocessedPath);
            });
          } catch (err) {
            preprocessErrors.full = preprocessErrors.full || String(err?.message || err);
            fullPreprocessedPath = null;
          }
        }
      } catch (err) {
        const code = String(err?.code || '');
        const msg = String(err?.message || err);
        if (code === 'OCR_PREPROCESS_READ_TIMEOUT') {
          preprocessErrors.plate = preprocessErrors.plate || msg;
          preprocessErrors.binary = preprocessErrors.binary || msg;
          preprocessErrors.bottom = preprocessErrors.bottom || msg;
          preprocessErrors.full = preprocessErrors.full || msg;
        }
      }
    }

    const ocrInputs = (
      fastMode
        ? [
            { label: 'plate-core', path: plateCorePreprocessedPath },
            { label: 'plate', path: preprocessedPath },
            { label: 'plate-alt', path: altPreprocessedPath },
            { label: 'binary', path: binaryPreprocessedPath },
            { label: 'bottom', path: bottomPreprocessedPath },
            { label: 'fallback', path: fallbackPreprocessedPath },
            { label: 'orig', path: imagePath },
          ]
        : [
            { label: 'plate-core', path: plateCorePreprocessedPath },
            { label: 'bottom', path: bottomPreprocessedPath },
            { label: 'binary', path: binaryPreprocessedPath },
            { label: 'plate', path: preprocessedPath },
            { label: 'plate-alt', path: altPreprocessedPath },
            { label: 'full', path: fullPreprocessedPath },
            { label: 'orig', path: imagePath },
          ]
    ).filter((x) => Boolean(x.path));

    const result = await withTimeout(
      withPlateWorker(async (worker) => {
        const psmModes = fastMode ? ['7', '8', '6'] : ['7', '6', '11'];
        const perAttemptTimeoutMs = fastMode ? 9000 : 9000;
        const overallTimeoutMs = fastMode ? 30000 : 22000;
        const startedAt = Date.now();
        let bestText = '';
        let bestPlate = null;
        const attempts = [];
        // Include both Latin and Cyrillic plate-like symbols to avoid dropping Ukrainian letters.
        const whitelist = 'ABCEHIKMOPTXY0123456789АВЕИІКМНОРСТХУЇЄҐСН';

        for (const input of ocrInputs) {
          for (const psm of psmModes) {
            try {
              if (Date.now() - startedAt > overallTimeoutMs) {
                const err = new Error('OCR timeout');
                err.code = 'OCR_TIMEOUT';
                throw err;
              }
              try {
                await worker.setParameters({
                  tessedit_pageseg_mode: psm,
                  tessedit_char_whitelist: whitelist,
                  preserve_interword_spaces: '1',
                });
              } catch (_) {
                void _;
              }

              const {
                data: { text },
              } = await withTimeout(worker.recognize(input.path), perAttemptTimeoutMs);
              let ocrText = text || '';
              bestText = ocrText || bestText;

              // If OCR returned too little text (e.g. "EF"), retry once without strict whitelist.
              if (String(ocrText).replace(/\s+/g, '').length < 4) {
                try {
                  await worker.setParameters({
                    tessedit_pageseg_mode: psm,
                    preserve_interword_spaces: '1',
                  });
                  const {
                    data: { text: retryText },
                  } = await withTimeout(worker.recognize(input.path), Math.max(4500, perAttemptTimeoutMs - 2000));
                  if (String(retryText || '').trim().length > String(ocrText || '').trim().length) {
                    ocrText = retryText || ocrText;
                    bestText = ocrText || bestText;
                  }
                  // Restore strict params for next attempts.
                  await worker.setParameters({
                    tessedit_pageseg_mode: psm,
                    tessedit_char_whitelist: whitelist,
                    preserve_interword_spaces: '1',
                  });
                } catch (_) {
                  void _;
                }
              }

              const plate = extractLicensePlateFromText(ocrText);

              if (debug) {
                attempts.push({
                  label: input.label,
                  psm,
                  plate: plate || null,
                  rawText: ocrText || '',
                });
              }

              if (plate) {
                bestPlate = plate;
                break;
              }
            } catch (err) {
              if (debug) {
                attempts.push({
                  label: input.label,
                  psm,
                  plate: null,
                  rawText: '',
                  error: String(err?.message || err),
                });
              }
            }
          }
          if (bestPlate) break;
        }

        // If fast-mode produced no text/plate, try one emergency pass tuned for sparse text.
        if (fastMode && !bestPlate) {
          const emergencyInputs = [
            { label: 'plate-emergency', path: preprocessedPath },
            { label: 'plate-alt-emergency', path: altPreprocessedPath },
            { label: 'binary-emergency', path: binaryPreprocessedPath },
            { label: 'fallback-emergency', path: fallbackPreprocessedPath },
            { label: 'orig-emergency', path: imagePath },
          ].filter((x) => Boolean(x.path));
          const emergencyPsmModes = ['11', '13'];
          for (const input of emergencyInputs) {
            for (const psm of emergencyPsmModes) {
              try {
                if (Date.now() - startedAt > overallTimeoutMs + 7000) break;
                try {
                  await worker.setParameters({
                    tessedit_pageseg_mode: psm,
                    tessedit_char_whitelist: whitelist,
                    preserve_interword_spaces: '1',
                  });
                } catch (_) {
                  void _;
                }
                const {
                  data: { text },
                } = await withTimeout(worker.recognize(input.path), 6500);
                const plate = extractLicensePlateFromText(text);
                if (text && String(text).trim()) bestText = text;
                if (debug) {
                  attempts.push({
                    label: input.label,
                    psm,
                    plate: plate || null,
                    rawText: text || '',
                  });
                }
                if (plate) {
                  bestPlate = plate;
                  break;
                }
              } catch (err) {
                if (debug) {
                  attempts.push({
                    label: input.label,
                    psm,
                    plate: null,
                    rawText: '',
                    error: String(err?.message || err),
                  });
                }
              }
            }
            if (bestPlate) break;
          }
        }

        return { bestPlate, bestText, attempts };
      }),
      fastMode ? 45000 : 28000,
      () => {
        void resetPlateWorker();
      }
    );

    fs.unlink(imagePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    if (preprocessedPath) {
      fs.unlink(preprocessedPath, (err) => {
        if (err) void err;
      });
    }

    if (altPreprocessedPath) {
      fs.unlink(altPreprocessedPath, (err) => {
        if (err) void err;
      });
    }

    if (fullPreprocessedPath) {
      fs.unlink(fullPreprocessedPath, (err) => {
        if (err) void err;
      });
    }

    if (binaryPreprocessedPath) {
      fs.unlink(binaryPreprocessedPath, (err) => {
        if (err) void err;
      });
    }

    if (bottomPreprocessedPath) {
      fs.unlink(bottomPreprocessedPath, (err) => {
        if (err) void err;
      });
    }

    if (plateCorePreprocessedPath) {
      fs.unlink(plateCorePreprocessedPath, (err) => {
        if (err) void err;
      });
    }

    if (fallbackPreprocessedPath) {
      fs.unlink(fallbackPreprocessedPath, (err) => {
        if (err) void err;
      });
    }

    const debugMeta = debug
      ? {
          meta: {
            node: process.version,
            jimp: Boolean(Jimp),
            jimpError: jimpResolveError,
            inputs: {
              bottom: Boolean(bottomPreprocessedPath),
              plateCore: Boolean(plateCorePreprocessedPath),
              binary: Boolean(binaryPreprocessedPath),
              plate: Boolean(preprocessedPath),
              plateAlt: Boolean(altPreprocessedPath),
              full: Boolean(fullPreprocessedPath),
              fallback: Boolean(fallbackPreprocessedPath),
              orig: true,
            },
            preprocessErrors,
          },
        }
      : {};

    if (!result?.bestPlate) {
      try {
        const attemptSummary = Array.isArray(result?.attempts)
          ? result.attempts.slice(0, 12).map((a) => ({
              label: a?.label || '',
              psm: a?.psm || '',
              plate: a?.plate || null,
              hasText: Boolean(String(a?.rawText || '').trim()),
              textSample: String(a?.rawText || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 120),
              error: a?.error || null,
            }))
          : [];
        console.warn(
          '[OCR_PLATE_MISS]',
          JSON.stringify({
            at: new Date().toISOString(),
            ip: req.ip || null,
            userId: req?.user?.id || null,
            hasRawText: Boolean(String(result?.bestText || '').trim()),
            rawTextSample: String(result?.bestText || '')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 220),
            attempts: attemptSummary,
            preprocessErrors,
          })
        );
      } catch (logErr) {
        void logErr;
      }
      return res.status(200).json({
        licensePlate: null,
        rawText: result?.bestText || '',
        ...(debug ? { attempts: result?.attempts || [] } : {}),
        ...debugMeta,
      });
    }
    return res.status(200).json({
      licensePlate: result.bestPlate,
      rawText: result?.bestText || '',
      ...(debug ? { attempts: result?.attempts || [] } : {}),
      ...debugMeta,
    });
  } catch (err) {
    const code = String(err?.code || '');
    const msg = String(err?.message || '');
    const msgLower = msg.toLowerCase();

    if (code === 'OCR_TIMEOUT' || msgLower.includes('ocr timeout')) {
      return res.status(503).json({
        message: 'OCR timeout, please retry',
        error: 'OCR timeout',
      });
    }

    if (code === 'OCR_BUSY') {
      return res.status(503).json({ message: 'OCR busy, please retry' });
    }

    if (code === 'OCR_PREPROCESS_TIMEOUT' || code === 'OCR_PREPROCESS_READ_TIMEOUT') {
      return res.status(503).json({ message: 'OCR preprocess timeout, please retry', error: msg });
    }

    if (msgLower.includes('warming')) {
      return res.status(503).json({ message: 'OCR warming up, please retry' });
    }

    if (msgLower.includes('timeout')) {
      return res.status(503).json({ message: 'OCR busy, please retry' });
    }

    console.error('OCR Plate Error:', err);
    res.status(500).json({ message: 'Помилка розпізнавання тексту', error: err.message });
  }
};

function parseOcrText(text, ocrData = null) {
  const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();
  const lines = text.replace(/\r/g, '\n').split('\n').map(normalizeLine).filter(Boolean);
  const brandRegex =
    /\b(VICTOR\s+REINZ|ELRING|FEBI(?:\s+BILSTEIN)?|BILSTEIN|SWAG|BMW|JP\s+GROUP|SKF|BOSCH|INA|SACHS|LEMFORDER|K2|К2)\b/i;
  const brandRegexGlobal =
    /\b(VICTOR\s+REINZ|ELRING|FEBI(?:\s+BILSTEIN)?|BILSTEIN|SWAG|BMW|JP\s+GROUP|SKF|BOSCH|INA|SACHS|LEMFORDER|K2|К2)\b/gi;

  const parseStructuredTable = (data) => {
    const wordsRaw = Array.isArray(data?.words) ? data.words : [];
    if (!wordsRaw.length) return { headerDetected: false, parts: [] };

    const words = wordsRaw
      .map((w) => {
        const txt = normalizeLine(String(w?.text || ''));
        const x0 = Number(w?.bbox?.x0);
        const y0 = Number(w?.bbox?.y0);
        const x1 = Number(w?.bbox?.x1);
        const y1 = Number(w?.bbox?.y1);
        if (!txt || !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) return null;
        return {
          text: txt,
          x0,
          y0,
          x1,
          y1,
          cx: (x0 + x1) / 2,
          cy: (y0 + y1) / 2,
          h: Math.max(1, y1 - y0),
        };
      })
      .filter(Boolean);

    if (!words.length) return { headerDetected: false, parts: [] };

    const avgH = words.reduce((s, w) => s + w.h, 0) / words.length;
    const rowTol = Math.max(7, Math.round(avgH * 0.75));
    const byY = words.slice().sort((a, b) => a.cy - b.cy);
    const rows = [];
    for (const w of byY) {
      const prev = rows[rows.length - 1];
      if (!prev || Math.abs(prev.cy - w.cy) > rowTol) {
        rows.push({ cy: w.cy, words: [w] });
      } else {
        prev.words.push(w);
        prev.cy = (prev.cy * (prev.words.length - 1) + w.cy) / prev.words.length;
      }
    }

    const rowsNorm = rows
      .map((r) => {
        const ws = r.words.slice().sort((a, b) => a.x0 - b.x0);
        const textLine = normalizeLine(ws.map((w) => w.text).join(' '));
        return { cy: r.cy, words: ws, text: textLine };
      })
      .filter((r) => r.text);

    const headerRow = rowsNorm.find((r) => {
      const t = r.text.toLowerCase();
      return (
        (t.includes('наймен') || t.includes('наимен')) &&
        (t.includes('цiна') || t.includes('ціна') || t.includes('цена') || t.includes('price')) &&
        (t.includes('кільк') || t.includes('колич') || t.includes('qty'))
      );
    });

    if (!headerRow) return { headerDetected: false, parts: [] };

    const headerWords = headerRow.words;
    const pickX = (re, fallback = null) => {
      const hit = headerWords.find((w) => re.test(w.text.toLowerCase()));
      return hit ? hit.x0 : fallback;
    };

    const commentX = pickX(/комент|comment/);
    const priceX = pickX(/цiна|ціна|цена|price/);
    const qtyX = pickX(/кільк|колич|qty/, priceX ? priceX + 120 : null);
    const sumX = pickX(/сум|итог|total/, qtyX ? qtyX + 130 : null);
    if (!Number.isFinite(priceX) || !Number.isFinite(qtyX)) return { headerDetected: true, parts: [] };

    const parseNumericToken = (value) => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      // Reject alpha-numeric tokens like "W105" and known SKU-number shapes.
      if (/[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(raw)) return null;
      const compact = raw.replace(/\s+/g, '').replace(',', '.');
      if (!/^\d[\d.]*$/.test(compact)) return null;
      if (/^\d{3}[.]\d{3}$/.test(compact)) return null; // 147.581
      if (/^\d{2}[.]\d{2}[.]\d{4}$/.test(compact)) return null; // 20.03.0009
      const n = Number(compact);
      return Number.isFinite(n) ? n : null;
    };

    const getNums = (arr) =>
      arr
        .map((w) => parseNumericToken(w.text))
        .filter((n) => Number.isFinite(n));

    const cleanStructuredName = (value) =>
      normalizeLine(
        String(value || '')
          .replace(/[|©»«]/g, ' ')
          .replace(/(?:терм\S*\s*постав\S*|поставк\S*|доставк\S*|на\s*склад\S*|склад\S*|наявност\S*|дн\.?)/gi, ' ')
          .replace(/\bKAZNAHIB\b/gi, 'клапанів')
          .replace(/\bіврмосіа\b/gi, 'термостат')
          .replace(/\bПрокладха\b/gi, 'Прокладка')
      );
    const skuRe = /\b(?:\d{2,}-\d{2,}(?:-\d{2,})?|\d{2}\s\d{2}\s\d{4}|\d{3}[.]\d{3}|[A-Z]{1,6}\d{3,}[A-Z0-9]*|\d{7,})\b/i;
    const rightBoundForName = Number.isFinite(commentX) ? commentX - 12 : priceX - 12;
    const dataRows = rowsNorm.filter((r) => r.cy > headerRow.cy + rowTol);
    const rowInfos = dataRows.map((r) => {
      const low = r.text.toLowerCase();
      const priceWords = r.words.filter((w) => w.x0 >= priceX - 55 && w.x1 < qtyX - 12);
      const qtyWords = r.words.filter((w) => w.x0 >= qtyX - 40 && (!Number.isFinite(sumX) || w.x1 < sumX - 12));
      const sumWords = Number.isFinite(sumX)
        ? r.words.filter((w) => w.x0 >= sumX - 45)
        : [];
      const hasNumericColumns = priceWords.length > 0 || qtyWords.length > 0 || sumWords.length > 0;
      const nameRightBound = hasNumericColumns ? rightBoundForName : priceX - 24;
      const leftWords = r.words.filter((w) => w.x0 < nameRightBound);
      const leftText = cleanStructuredName(leftWords.map((w) => w.text).join(' '));
      const rowNums = getNums(r.words);
      const priceNums = getNums(priceWords);
      const qtyNums = getNums(qtyWords).filter((n) => Number.isInteger(n) && n > 0 && n <= 20);
      const sumNums = getNums(sumWords);

      let price = priceNums.length ? Math.max(...priceNums) : null;
      let qty = qtyNums.length ? qtyNums[0] : 1;
      const sum = sumNums.length ? Math.max(...sumNums) : null;

      if (!Number.isFinite(price) && rowNums.length >= 2) {
        const sorted = rowNums.slice().sort((a, b) => a - b);
        price = sorted[sorted.length - 2];
      }
      if (Number.isFinite(sum) && rowNums.length >= 2) {
        const sorted = rowNums.slice().sort((a, b) => a - b);
        const secondLargest = sorted[sorted.length - 2];
        const largest = sorted[sorted.length - 1];
        const ratio = secondLargest > 0 ? largest / secondLargest : null;
        const ratioRounded = ratio ? Math.round(ratio) : null;
        const pairCoherent =
          ratioRounded &&
          ratioRounded >= 1 &&
          ratioRounded <= 20 &&
          nearlyEquals(secondLargest * ratioRounded, largest, 2.0);

        if (Number.isFinite(price) && price > 0) {
          const currentRatio = sum / price;
          const currentQty = Math.round(currentRatio);
          const currentCoherent =
            currentQty >= 1 && currentQty <= 20 && nearlyEquals(price * currentQty, sum, 2.0);
          if (currentCoherent) {
            qty = currentQty;
          } else if (pairCoherent) {
            price = secondLargest;
            qty = ratioRounded;
          }
        } else if (pairCoherent) {
          price = secondLargest;
          qty = ratioRounded;
        }
      }
      if (!Number.isFinite(qty) || qty <= 0 || qty > 20) qty = 1;

      const pnMatch = r.text.match(skuRe);
      const partNumber = pnMatch ? String(pnMatch[0]).trim() : '';
      const brandMatch = String(r.text).match(brandRegex);
      const brand = brandMatch ? String(brandMatch[0]).replace(/\s+/g, ' ').trim() : '';
      const hasAnchorSignals =
        Number.isFinite(price) &&
        price >= 10 &&
        price <= 200000 &&
        (Boolean(partNumber) || Boolean(brand) || hasNumericColumns);

      return {
        row: r,
        low,
        leftText,
        rowNums,
        price,
        qty,
        sum,
        partNumber,
        brand,
        hasNumericColumns,
        hasAnchorSignals,
      };
    });

    const extracted = [];
    const seenKeys = new Set();
    let idx = 0;
    while (idx < rowInfos.length) {
      const current = rowInfos[idx];
      if (!current) {
        idx += 1;
        continue;
      }
      if (noiseKeywords.test(current.low) || /разом|итого|всього/.test(current.low)) {
        idx += 1;
        continue;
      }
      if (!current.hasAnchorSignals) {
        idx += 1;
        continue;
      }

      const inlineName = (() => {
        let candidate = cleanStructuredName(current.leftText);
        if (current.partNumber) {
          candidate = normalizeLine(
            candidate.replace(new RegExp(String(current.partNumber).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
          );
        }
        const withoutBrand = current.brand
          ? normalizeLine(candidate.replace(new RegExp(String(current.brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' '))
          : candidate;
        if (!/[А-Яа-яІіЇїЄєҐґ]{4,}/.test(withoutBrand) && withoutBrand.length < 6) return '';
        return candidate;
      })();

      const descLines = [];
      let nextIdx = idx + 1;
      while (nextIdx < rowInfos.length && nextIdx <= idx + 4) {
        const probe = rowInfos[nextIdx];
        if (!probe) {
          nextIdx += 1;
          continue;
        }
        if (probe.hasAnchorSignals && (probe.partNumber || probe.brand || probe.hasNumericColumns)) break;
        const desc = cleanStructuredName(probe.leftText);
        if (
          desc &&
          !isNoiseLine(desc) &&
          !noiseKeywords.test(desc) &&
          !/^(?:[-–.,]|[ivxlcdm]+|\d{1,2})$/i.test(desc) &&
          !isLikelyPartNumberLine(desc)
        ) {
          descLines.push(desc);
        }
        nextIdx += 1;
      }

      let name = cleanStructuredName(descLines.join(' '));
      if (!name) name = inlineName;
      if (!name && current.brand && current.partNumber) {
        name = `${current.brand} ${current.partNumber}`.trim();
      }
      if (!name || isNoiseLine(name)) {
        idx = nextIdx;
        continue;
      }
      if (!current.partNumber && !brandRegex.test(name)) {
        idx = nextIdx;
        continue;
      }

      const key = `${name.toLowerCase()}|${current.price}|${current.qty}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        extracted.push({
          name,
          price: current.price,
          quantity: current.qty,
          part_number: current.partNumber,
          purchased_by: 'owner',
        });
      }
      idx = nextIdx;
    }

    return { headerDetected: true, parts: extracted };
  };

  const deferredStructuredParser = parseStructuredTable;

  const parseAnchoredSkuBlocks = () => {
    const skuPattern =
      /\b(?:\d{2,}-\d{2,}(?:-\d{2,})?|\d{2}\s\d{2}\s\d{4}|\d{3}[.]\d{3}|0\d{4,}|[A-Z]{1,6}\d{3,}[A-Z0-9]*|\d{7,})\b/i;
    const cleanDesc = (value) =>
      normalizeLine(
        String(value || '')
          .replace(/[|©»«]/g, ' ')
          .replace(/(?:терм\S*\s*постав\S*|поставк\S*|доставк\S*|на\s*склад\S*|склад\S*|наявност\S*|дн\.?)/gi, ' ')
          .replace(/\bKAZNAHIB\b/gi, 'клапанів')
          .replace(/\bіврмосіа\b/gi, 'термостат')
          .replace(/\bПрокладха\b/gi, 'Прокладка')
      );
    const parseNums = (line, pn = '') => {
      // Remove explicit part-number token from line before numeric extraction
      // to avoid taking SKU fragments as price candidates.
      const sanitized = pn
        ? String(line || '').replace(new RegExp(String(pn).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), ' ')
        : String(line || '');
      const matches = Array.from(sanitized.matchAll(numberPattern));
      const numbers = [];
      for (const m of matches) {
        const token = String(m?.[0] || '');
        const start = Number(m?.index ?? -1);
        if (start < 0 || !token) continue;
        const end = start + token.length;
        const prev = start > 0 ? sanitized[start - 1] : '';
        const next = end < sanitized.length ? sanitized[end] : '';
        const hasLetterAround =
          /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(prev) || /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(next);
        const qtyPriceSplit = token.match(/^(\d{1,2})\s+(\d{2,4})$/);

        // OCR often glues "qty price" into a single token like "1 608".
        // When this shape is plausible, keep the price separately and optionally the qty.
        if (qtyPriceSplit) {
          const qtyCandidate = Number(qtyPriceSplit[1]);
          const priceCandidate = Number(qtyPriceSplit[2]);
          if (
            Number.isFinite(qtyCandidate) &&
            qtyCandidate >= 1 &&
            qtyCandidate <= 20 &&
            Number.isFinite(priceCandidate) &&
            priceCandidate >= 20 &&
            priceCandidate <= 5000
          ) {
            if (!hasLetterAround) numbers.push(qtyCandidate);
            numbers.push(priceCandidate);
            continue;
          }
        }

        if (hasLetterAround) continue;
        const parsed = parseNumber(token, sanitized);
        if (Number.isFinite(parsed)) numbers.push(parsed);
      }
      return numbers;
    };

    const anchored = [];
    const seenAnchored = new Set();
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const skuMatch = String(line || '').match(skuPattern);
      const hasBrand = brandRegex.test(line);
      if (!skuMatch || !hasBrand) {
        i += 1;
        continue;
      }

      const partNumber = String(skuMatch[0]).trim();
      const block = [line];
      let j = i + 1;
      while (j < lines.length) {
        const l = lines[j];
        if (!l) {
          j += 1;
          continue;
        }
        if (noiseKeywords.test(l)) {
          j += 1;
          continue;
        }
        const nextSkuMatch = String(l || '').match(skuPattern);
        const nextPartNumber = nextSkuMatch ? String(nextSkuMatch[0]).trim() : '';
        if (nextPartNumber && nextPartNumber !== partNumber && (brandRegex.test(l) || isLikelyPartNumberLine(l))) break;
        block.push(l);
        if (block.length >= 5) break;
        j += 1;
      }

      const descLine =
        block
          .slice(1)
          .map((x) => cleanDesc(x))
          .find(
            (x) =>
              x &&
              /[А-Яа-яІіЇїЄєҐґ]{4,}/.test(x) &&
              !isLikelyPartNumberLine(x) &&
              !/\b\d{1,3}\s+\d{1,3}\s+\d{1,3}\b/.test(x)
          ) || '';
      const brand = (String(line).match(brandRegex) || [partNumber])[0];
      const name = cleanDesc(descLine || `${brand} ${partNumber}`);
      if (!name || isNoiseLine(name)) {
        i = j;
        continue;
      }

      const numericLines = block
        .map((x) => ({ src: x, nums: parseNums(x, partNumber) }))
        .filter((x) => x.nums.length > 0);
      const flatNums = numericLines.flatMap((x) => x.nums).filter((n) => n >= 1 && n <= 200000);
      const sameLineNums = parseNums(line, partNumber).filter((n) => n >= 20 && n <= 5000);

      let price = null;
      let qty = 1;
      const plausible = flatNums.filter((n) => n >= 20 && n <= 5000);

      // Prefer numbers from the SKU row itself. This avoids block leakage into the
      // next item and handles common OCR rows like "147.581 ... 392 ... 784".
      if (sameLineNums.length >= 2) {
        let bestSameLinePair = null;
        for (let a = 0; a < sameLineNums.length; a += 1) {
          for (let b = a + 1; b < sameLineNums.length; b += 1) {
            const small = Math.min(sameLineNums[a], sameLineNums[b]);
            const big = Math.max(sameLineNums[a], sameLineNums[b]);
            const ratio = small > 0 ? big / small : null;
            const ratioInt = ratio ? Math.round(ratio) : null;
            const coherent =
              ratioInt &&
              ratioInt >= 1 &&
              ratioInt <= 20 &&
              nearlyEquals(small * ratioInt, big, 2.0);
            if (!coherent) continue;
            const candidate = { price: small, qty: ratioInt, total: big };
            if (!bestSameLinePair || candidate.total > bestSameLinePair.total) bestSameLinePair = candidate;
          }
        }
        if (bestSameLinePair) {
          price = bestSameLinePair.price;
          qty = bestSameLinePair.qty;
        } else {
          price = Math.max(...sameLineNums);
          qty = 1;
        }
      } else if (sameLineNums.length === 1 && plausible.length <= 1) {
        price = sameLineNums[0];
        qty = 1;
      } else if (plausible.length) {
        let bestPair = null;
        for (let a = 0; a < plausible.length; a += 1) {
          for (let b = a + 1; b < plausible.length; b += 1) {
            const small = Math.min(plausible[a], plausible[b]);
            const big = Math.max(plausible[a], plausible[b]);
            const ratio = small > 0 ? big / small : null;
            const ratioInt = ratio ? Math.round(ratio) : null;
            const coherent =
              ratioInt &&
              ratioInt >= 1 &&
              ratioInt <= 20 &&
              nearlyEquals(small * ratioInt, big, 2.0);
            if (!coherent) continue;
            const candidate = { price: small, qty: ratioInt, total: big };
            if (!bestPair || candidate.total > bestPair.total) bestPair = candidate;
          }
        }

        if (bestPair) {
          price = bestPair.price;
          qty = bestPair.qty;
        } else {
          const counts = new Map();
          for (const n of flatNums) {
            counts.set(n, (counts.get(n) || 0) + 1);
          }
          const hasLarge = plausible.some((n) => n >= 500);
          const scoreCandidate = (cand) => {
            let s = 0;
            const freq = counts.get(cand) || 0;
            s += freq * 4;
            if (cand >= 50) s += 2;
            if (cand < 100 && hasLarge) s -= 3;

            for (const total of flatNums) {
              if (!Number.isFinite(total) || total <= cand) continue;
              const ratio = total / cand;
              const ratioInt = Math.round(ratio);
              if (ratioInt >= 1 && ratioInt <= 20 && nearlyEquals(cand * ratioInt, total, 2.0)) {
                s += 6;
              }
            }
            return s;
          };

          const bestPrice = plausible
            .slice()
            .sort((a, b) => scoreCandidate(b) - scoreCandidate(a) || b - a)[0];
          price = bestPrice;

          // Derive qty from best-supported total candidate.
          let bestQtyScore = -Infinity;
          for (const total of flatNums) {
            if (!Number.isFinite(total) || total < price) continue;
            const ratio = total / price;
            const ratioInt = Math.round(ratio);
            if (ratioInt < 1 || ratioInt > 20) continue;
            if (!nearlyEquals(price * ratioInt, total, 2.0)) continue;
            const score = (counts.get(total) || 1) * 2 + (ratioInt === 1 ? 1 : 2);
            if (score > bestQtyScore) {
              bestQtyScore = score;
              qty = ratioInt;
            }
          }
        }
      } else if (flatNums.length === 1) {
        const only = flatNums[0];
        if (only >= 20 && only <= 5000) price = only;
      }

      if (!Number.isFinite(price) || price < 20 || price > 200000) {
        i = j;
        continue;
      }
      if (!Number.isFinite(qty) || qty <= 0 || qty > 20) qty = 1;

      const key = `${name.toLowerCase()}|${partNumber}|${price}|${qty}`;
      if (!seenAnchored.has(key)) {
        seenAnchored.add(key);
        anchored.push({
          name,
          price,
          quantity: qty,
          part_number: partNumber,
          purchased_by: 'owner',
        });
      }

      i = j;
    }

    return anchored;
  };

  const deferredAnchoredParser = parseAnchoredSkuBlocks;

  const parts = [];
  const seen = new Set();
  const buffer = [];

  // Capture groups of digits with optional thousand-space, optional decimal,
  // and also common SKU shapes like 147.581, 318.580, 20.03.0009 so they are
  // seen as one token and can be filtered by isLikelySkuNumber.
  const numberPattern = /(\d{1,3}(?:[ \u00A0]\d{3})+(?:[.,]\d{1,2})?|\d{3}[.]\d{3}|\d{2}[.]\d{2}[.]\d{4}|\d{3}[ ]\d{3}|\d{4,}(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
  const priceKeywords = /(ціна|цiна|цена|price)/i;
  const qtyKeywords = /(кількість|количество|qty|шт\.?|pcs|x)/i;
  const currencyKeywords = /(грн|uah|₴)/i;

  const extractNumbersFromLine = (line) => {
    const rawLine = String(line || '');
    const rawMatches = Array.from(rawLine.matchAll(numberPattern));
    const hasSemanticHints =
      currencyKeywords.test(rawLine) || priceKeywords.test(rawLine) || qtyKeywords.test(rawLine);

    // Ignore numbers embedded in alpha-numeric tokens (e.g. W105, M271, M50B25)
    // when the line has no explicit price/qty/currency hints.
    const matches = rawMatches.filter((m) => {
      const start = Number(m?.index ?? -1);
      if (start < 0 || hasSemanticHints) return true;
      const value = String(m?.[0] || '');
      const end = start + value.length;
      const prev = start > 0 ? rawLine[start - 1] : '';
      const next = end < rawLine.length ? rawLine[end] : '';
      const hasLetterAround = /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(prev) || /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(next);
      return !hasLetterAround;
    });
    const skipIndices = new Set();

    // OCR sometimes splits 147.581 into two adjacent numbers ("147" and "581").
    // If we later interpret these as price/qty, it breaks totals.
    for (let i = 0; i < matches.length - 1; i++) {
      if (skipIndices.has(i)) continue;
      const a = matches[i][0];
      const b = matches[i + 1][0];
      const aEnd = (matches[i].index ?? 0) + String(a).length;
      const bStart = matches[i + 1].index ?? 0;
      const gap = String(line || '').slice(aEnd, bStart);

      // Allow OCR gaps like ". ", " .", "  " between split SKU groups.
      if (/^[.\s]{1,3}$/.test(gap)) {
        const combined = `${String(a).replace(/\s/g, '')}.${String(b).replace(/\s/g, '')}`;
        if (/^\d{3}[.]\d{3}$/.test(combined)) {
          skipIndices.add(i);
          skipIndices.add(i + 1);
        }
      }
    }

    // Skip 2+2+4 SKU patterns split into 3 adjacent numeric tokens: "20 03 0009".
    for (let i = 0; i < matches.length - 2; i++) {
      if (skipIndices.has(i) || skipIndices.has(i + 1) || skipIndices.has(i + 2)) continue;
      const a = String(matches[i][0]);
      const b = String(matches[i + 1][0]);
      const c = String(matches[i + 2][0]);
      const aDigits = a.replace(/\D/g, '');
      const bDigits = b.replace(/\D/g, '');
      const cDigits = c.replace(/\D/g, '');
      if (/^\d{2}$/.test(aDigits) && /^\d{2}$/.test(bDigits) && /^\d{4}$/.test(cDigits)) {
        const aEnd = (matches[i].index ?? 0) + a.length;
        const bStart = matches[i + 1].index ?? 0;
        const bEnd = (matches[i + 1].index ?? 0) + b.length;
        const cStart = matches[i + 2].index ?? 0;
        const gap1 = String(line || '').slice(aEnd, bStart);
        const gap2 = String(line || '').slice(bEnd, cStart);
        if (/^\s{1,3}$/.test(gap1) && /^\s{1,3}$/.test(gap2)) {
          skipIndices.add(i);
          skipIndices.add(i + 1);
          skipIndices.add(i + 2);
        }
      }
    }

    return matches
      .filter((_, i) => !skipIndices.has(i))
      .map((m) => parseNumber(m[0], line))
      .filter((n) => Number.isFinite(n));
  };

  const isDimensionLikeLine = (value) =>
    /\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?/i.test(String(value || ''));

  const stripDimensions = (value) => {
    const raw = String(value || '');
    return raw
      .replace(
        /\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?/gi,
        ' '
      )
      .replace(/\s+/g, ' ')
      .trim();
  };


  const isLikelySkuNumber = (numStr, fullLine) => {
    // Part-number-like numbers: 3 digits dot/space 3 digits (e.g. 147.581, 318.580, 147 581)
    if (/^\d{3}[. ]\d{3}$/.test(numStr)) return true;
    // 3 digits dot 2+ digits in context of known manufacturer
    if (/\b(?:ELRING|FEBI\s+BILSTEIN|VICTOR\s+REINZ|SWAG|JP\s+GROUP|SKF|BOSCH|CONTINENTAL|INA|SACHS|LEMFORDER)\b/i.test(fullLine || '') && /^\d{3}[.,]\d{2,}$/.test(numStr)) return true;
    return false;
  };

  const parseNumber = (value, fullLine) => {
    if (!value) return null;
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    if (isLikelySkuNumber(cleaned, fullLine)) return null;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

  const nearlyEquals = (a, b, eps = 0.6) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
    return Math.abs(a - b) <= eps;
  };

  const isReasonableQty = (qty) => Number.isInteger(qty) && qty > 0 && qty <= 20;

  const extractNumber = (value) => {
    const match = value.match(numberPattern);
    if (!match || match.length === 0) return null;
    return parseNumber(match[0]);
  };

  const extractQty = (value) => {
    const match = value.match(/(?:кількість|количество|qty|шт\.?|pcs|x)\s*[:x]?\s*(\d+)/i);
    if (match) {
      const num = Number(match[1]);
      return Number.isFinite(num) && num > 0 ? num : null;
    }
    return null;
  };

  const isNoiseLine = (line) => {
    if (!line) return true;
    const hasNumber = Boolean(String(line).match(numberPattern));
    if (String(line).trim().length <= 2 && !hasNumber) return true;
    if (noiseKeywords.test(line)) return true;
    if (deleteKeywords.test(line)) return true;
    const noLetters = !/[A-Za-zА-Яа-яІіЇїЄє]/.test(line);
    if (noLetters && !hasNumber) return true;
    return false;
  };

  const isPriceLine = (line) => {
    if (!line) return false;
    if (!(priceKeywords.test(line) || currencyKeywords.test(line))) return false;
    const num = extractNumber(line);
    return Number.isFinite(num);
  };

  const isLikelyVolumeLine = (value) => {
    const line = String(value || '');
    if (!line) return false;
    // Examples from OCR: "W105 600mn", "600ml", "600мл", also liters.
    if (/\b\d{2,4}\s*(?:ml|мл|mn|mл|mп)\b/i.test(line)) return true;
    if (/\b\d+\s*[lл]\b/i.test(line)) return true;
    return false;
  };

  const isLikelyBrandSkuOnlyLine = (value) => {
    const line = String(value || '').trim();
    if (!line) return false;
    const tokens = line.split(/\s+/).filter(Boolean);
    if (tokens.length < 2 || tokens.length > 5) return false;
    const hasCyr = /[А-Яа-яІіЇїЄєҐґ]/.test(line);
    if (hasCyr) return false;
    const hasLongNumber = /\b\d{4,}\b/.test(line);
    const hasSkuLike = /\b[A-Z]{2,}\b/.test(line) && /[0-9]/.test(line);
    const hasLower = /[a-z]/.test(line);
    return hasLongNumber && hasSkuLike && !hasLower;
  };

  const extractBrandSpaceSku = (value) => {
    const line = String(value || '').trim();
    if (!line) return '';
    const longDigitsMatch = line.match(/\bBMW\s+(\d{7,})\b/i);
    if (longDigitsMatch && longDigitsMatch[1]) return String(longDigitsMatch[1]).trim();
    const codeMatch = line.match(/\b(?:SKF|INA|SNR|DAYCO|GATES|CONTINENTAL)\s+([A-Z]{2,6}\s+\d{3,})\b/i);
    if (codeMatch && codeMatch[1]) return String(codeMatch[1]).replace(/\s+/g, ' ').trim();
    return '';
  };

  const parseRowLine = (line) => {
    if (!/[A-Za-zА-Яа-яІіЇїЄє]/.test(line)) return null;
    // Prevent false positives on spec/name lines like: "75W-90 1л" or part codes.
    // Only treat as a row if it really looks like a row with price columns.
    const hasRowDelimiters = /[|]/.test(line);
    const hasCurrencyHints = currencyKeywords.test(line) || priceKeywords.test(line);

    if (isDimensionLikeLine(line) && !hasRowDelimiters && !hasCurrencyHints) {
      return null;
    }

    const numbers = extractNumbersFromLine(line);

    // Manufacturer + SKU line is usually not a price row in "order list" screenshots.
    if (!hasRowDelimiters && !hasCurrencyHints && isLikelyPartNumberLine(line)) {
      return null;
    }

    // When there are no obvious row delimiters/currency hints, treat short numeric codes as description,
    // not as price columns (e.g., "CASTROL 75W90TRMT1L").
    if (!hasRowDelimiters && !hasCurrencyHints && numbers.length >= 2) {
      const maxNum = Math.max(...numbers, 0);
      if (maxNum < 200) {
        return null;
      }
    }

    // Viscosity/spec patterns should not be treated as a price row.
    // Examples: 75W-90, 5W30, 10W-40, 1л, 1l.
    if (/\b\d{1,2}\s*W\s*[-–]?\s*\d{2,3}\b/i.test(line) || /\b\d+\s*[lл]\b/i.test(line)) {
      if (!hasRowDelimiters && !hasCurrencyHints) return null;
    }

    // OCR often splits viscosity across lines, leaving a line like "90 1л (EATRMT7912X1L)".
    // Such lines contain multiple numbers (volume + code digits) but are still a description, not a price row.
    if (!hasRowDelimiters && !hasCurrencyHints) {
      const looksLikeVolume = /\b\d+\s*[lл]\b/i.test(line);
      const hasBracketedCode = /\([^)]*\d[^)]*\)/.test(line);
      const maxNum = Math.max(...numbers, 0);
      if (looksLikeVolume && (hasBracketedCode || maxNum < 200)) {
        return null;
      }
    }
    if (numbers.length < 3 && !hasRowDelimiters && !hasCurrencyHints) return null;
    if (!hasRowDelimiters && !hasCurrencyHints && numbers.length >= 3) {
      const minNum = Math.min(...numbers);
      const maxNum = Math.max(...numbers);
      // OCR-noise rows like "ласт 5 38 1" are not stable price rows.
      if (minNum <= 5 && maxNum < 100) return null;
    }
    let qty = 1;
    let price = null;
    let total = null;
    if (numbers.length >= 3) {
      const last = numbers[numbers.length - 1];
      const secondLast = numbers[numbers.length - 2];
      const thirdLast = numbers[numbers.length - 3];
      total = last;

      if (
        Number.isFinite(thirdLast) &&
        Number.isInteger(secondLast) &&
        secondLast > 0 &&
        secondLast <= 1000 &&
        nearlyEquals(thirdLast * secondLast, total)
      ) {
        price = thirdLast;
        qty = secondLast;
      } else if (
        Number.isFinite(secondLast) &&
        Number.isInteger(thirdLast) &&
        thirdLast > 0 &&
        thirdLast <= 1000 &&
        nearlyEquals(secondLast * thirdLast, total)
      ) {
        price = secondLast;
        qty = thirdLast;
      }

      if (price !== null) {
        const name = line
          .replace(numberPattern, ' ')
          .replace(/[₴]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (!name || isNoiseLine(name)) return null;
        return { name, price, quantity: qty };
      }

      if (Number.isInteger(thirdLast) && thirdLast > 0 && thirdLast <= 1000) {
        qty = thirdLast;
        price = secondLast;
      } else if (Number.isInteger(secondLast) && secondLast > 0 && secondLast <= 1000) {
        qty = secondLast;
        price = thirdLast;
      } else {
        price = secondLast;
      }
      if (!price && Number.isFinite(last)) {
        price = last;
      }
    } else if (numbers.length === 2) {
      const [a, b] = numbers;
      if (Number.isInteger(b) && b > 0 && b <= 1000) {
        qty = b;
        price = a;
      } else {
        price = b;
      }
    }
    if (!Number.isFinite(price) || price <= 0) return null;
    if (!isReasonableQty(qty)) {
      qty = 1;
    }
    const name = line.replace(numberPattern, ' ').replace(/[₴]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || isNoiseLine(name)) return null;
    return { name, price, quantity: qty };
  };

  const parseNumericRowLine = (line) => {
    if (!line) return null;
    if (isSkuOnlyLine(line)) return null;
    if (noiseKeywords.test(line) && !isLikelyPartNumberLine(line)) return null;
    if (!currencyKeywords.test(line) && !priceKeywords.test(line) && isLikelyVolumeLine(line)) return null;
    const letterMatches = line.match(/[A-Za-zА-Яа-яІіЇїЄє]/g);
    const letterCount = letterMatches ? letterMatches.length : 0;
    const numbers = extractNumbersFromLine(line);
    const hasCurrencyHints = currencyKeywords.test(line) || priceKeywords.test(line);
    if (numbers.length < 2) return null;

    // Avoid interpreting spec/volume lines like "90 1л (EATRMT7912X1L)" as price rows.
    const hasBracketedCode = /\([^)]*\d[^)]*\)/.test(line);
    const looksLikeVolume = /\b\d+\s*[lл]\b/i.test(line);
    if (looksLikeVolume && hasBracketedCode) {
      return null;
    }

    // Rows like "Tenring 95-99 ... SKF VKM 38003" usually contain year ranges and SKU,
    // where the largest number is a part number, not a price.
    if (!hasCurrencyHints && /\b\d{2}-\d{2}\b/.test(line) && isLikelyPartNumberLine(line)) {
      const maxNum = Math.max(...numbers);
      const minNum = Math.min(...numbers);
      if (maxNum >= 5000 && minNum < 200) return null;
    }

    // Some invoices/screenshots produce OCR like: "873 | що B | 1747".
    // Treat as numeric-row if it is mostly numbers with a bit of letter noise.
    if (letterCount > 0 && numbers.length === 2) {
      // 2-number line with many letters is likely not price/qty.
      if (letterCount > 8) return null;
    }
    if (letterCount > 0 && numbers.length >= 3) {
      if (letterCount > 25) return null;
    }

    const scoreCandidate = (candidate) => {
      if (!candidate) return null;
      const { price, qty, total } = candidate;
      if (!Number.isFinite(price) || price <= 0) return null;
      if (!Number.isFinite(qty) || qty <= 0) return null;

      let score = 0;
      const coherentTotal = Number.isFinite(total) && total > 0 && nearlyEquals(price * qty, total, 1.2);
      if (isReasonableQty(qty)) score += 6;
      if (price >= 10 && price <= 200000) score += 2;
      if (Number.isFinite(total) && total > 0) {
        score += 1;
        if (coherentTotal) score += 6;
        else score -= 4;
        if (total >= price) score += 1;
      }

      return { price, quantity: qty, score, coherentTotal };
    };

    const candidates = [];

    if (numbers.length >= 3) {
      const a = numbers[0];
      const b = numbers[1];
      const c = numbers[2];
      candidates.push(scoreCandidate({ price: a, qty: Math.round(b), total: c }));
      candidates.push(scoreCandidate({ price: b, qty: Math.round(a), total: c }));
      candidates.push(scoreCandidate({ price: a, qty: Math.round(c), total: b }));
      candidates.push(scoreCandidate({ price: b, qty: Math.round(c), total: a }));
      candidates.push(scoreCandidate({ price: c, qty: Math.round(a), total: b }));
      candidates.push(scoreCandidate({ price: c, qty: Math.round(b), total: a }));

      // OCR often adds extra numeric noise tokens in the same row.
      // Probe all number pairs and derive qty from total/price ratio.
      for (let i = 0; i < numbers.length; i += 1) {
        for (let j = i + 1; j < numbers.length; j += 1) {
          const x = numbers[i];
          const y = numbers[j];
          const small = Math.min(x, y);
          const big = Math.max(x, y);
          const ratio = small > 0 ? big / small : null;
          const ratioRounded = ratio ? Math.round(ratio) : null;
          const canDeriveQty =
            ratioRounded &&
            ratioRounded >= 1 &&
            ratioRounded <= 20 &&
            nearlyEquals(small * ratioRounded, big, 2.0);
          if (canDeriveQty) {
            candidates.push(scoreCandidate({ price: small, qty: ratioRounded, total: big }));
          }
        }
      }
    } else {
      const a = numbers[0];
      const b = numbers[1];

      const small = Math.min(a, b);
      const big = Math.max(a, b);
      const ratio = small > 0 ? big / small : null;
      const ratioRounded = ratio ? Math.round(ratio) : null;
      const canDeriveQty =
        ratioRounded &&
        ratioRounded >= 1 &&
        ratioRounded <= 20 &&
        nearlyEquals(small * ratioRounded, big, 2.0);

      // Prefer invoice-style "price ... total" rows by deriving qty ~= total/price.
      if (canDeriveQty) {
        // Deterministic fast-path: if total/price is a clean integer qty, return it.
        // This avoids edge cases where later scoring ends up picking the wrong candidate.
        return { price: small, quantity: ratioRounded };
      }

      candidates.push(scoreCandidate({ price: a, qty: 1, total: b }));
      candidates.push(scoreCandidate({ price: b, qty: 1, total: a }));
      candidates.push(scoreCandidate({ price: a, qty: Math.round(b), total: null }));
      candidates.push(scoreCandidate({ price: b, qty: Math.round(a), total: null }));
    }

    const validCandidates = candidates.filter(Boolean);
    const best = validCandidates.sort((x, y) => (y.score || 0) - (x.score || 0))[0];

    if (!best) return null;
    if (numbers.length >= 3) {
      const hasCoherent = validCandidates.some((c) => c.coherentTotal);
      if (!hasCoherent && isLikelyPartNumberLine(line)) return null;
      // With no coherent total and no currency hints, lines with large max values
      // are typically SKU/noise, not price rows.
      if (!hasCoherent && !hasCurrencyHints && Math.max(...numbers) >= 5000) return null;
      // Prevent quantity inflation on noisy OCR triples like "5 38 1".
      if (!hasCoherent && best.quantity > 1) {
        return { price: Math.max(...numbers), quantity: 1 };
      }
    }
    if (!isReasonableQty(best.quantity)) {
      return { price: best.price, quantity: 1 };
    }
    return { price: best.price, quantity: best.quantity };
  };

  const pushPart = (name, price, quantity, lineForPartNumber) => {
    let cleanedName = normalizeLine(
      String(name || '')
        .replace(/(?:терм\S*\s*постав\S*|поставк\S*|доставк\S*|на\s*склад\S*|склад\S*|наявност\S*|дн\.?)/gi, ' ')
        .replace(/[|©»«]/g, ' ')
    );
    cleanedName = cleanedName.replace(/\bKAZNAHIB\b/gi, 'клапанів')
                             .replace(/\bіврмосіа\b/gi, 'термостат')
                             .replace(/\bПрокладха\b/gi, 'Прокладка');
    if (!cleanedName || isNoiseLine(cleanedName)) return;
    if (!Number.isFinite(price) || price < 10) return;
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

    const partNumberSource = String(lineForPartNumber || cleanedName);
    const isDimensionLike = /\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?/i.test(
      partNumberSource
    );

    const extractPartNumber = (value) => {
      if (!value) return '';
      const src = String(value);
      if (isDimensionLikeLine(src)) return '';

      const candidates = [];
      const patterns = [
        /\b\d{2}\s\d{2}\s\d{4}\b/g, // 20 03 0009
        /\b[A-Z0-9]{2,}(?:[./-][A-Z0-9]{2,})+\b/gi, // 14-32101-01, MS0828-98, 505.090
        /\b[A-Z]{1,6}\d{3,}[A-Z0-9]*\b/gi, // K2W105, EATRMT7912X1L
        /\b0\d{4,}\b/g, // 06051
        /\b\d{7,}\b/g, // long digits-only part numbers
      ];

      for (const re of patterns) {
        const matches = src.match(re);
        if (matches) candidates.push(...matches);
      }

      const uniq = Array.from(new Set(candidates.map((x) => String(x).trim()).filter(Boolean)));
      const filtered = uniq.filter((cand) => {
        // Avoid year ranges like 95-99, 2000-2005, etc.
        if (/^\d{2}-\d{2}$/.test(cand)) return false;
        if (/^\d{4}-\d{4}$/.test(cand)) return false;
        // Avoid standalone small digit groups.
        const onlyDigits = /^\d+$/.test(cand.replace(/\s+/g, ''));
        if (onlyDigits && cand.replace(/\s+/g, '').length < 5) return false;
        return true;
      });

      const score = (cand) => {
        let s = 0;
        const compact = cand.replace(/\s+/g, '');
        if (/[A-Z]/i.test(cand)) s += 6;
        if (/[./-]/.test(cand)) s += 5;
        if (/\s/.test(cand)) s += 4;
        if (compact.length >= 10) s += 3;
        if (compact.length >= 6) s += 2;
        if (/^\d+$/.test(compact)) s += 1;
        return s;
      };

      const best = filtered.sort((a, b) => score(b) - score(a))[0];
      return best ? best.trim() : '';
    };

    const partNumber =
      isDimensionLike ? '' : extractPartNumber(partNumberSource) || extractBrandSpaceSku(partNumberSource);
    const buildCanonicalName = (source, pn) => {
      const src = String(source || '').replace(/[|©»«]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!src || !pn) return '';
      const brandMatch = src.match(brandRegex);
      if (brandMatch && brandMatch[0]) {
        return `${brandMatch[0].replace(/\s+/g, ' ').trim()} ${pn}`.trim();
      }
      return `${pn}`.trim();
    };

    const hasManySingleCharTokens = cleanedName.split(' ').filter((t) => t.length === 1).length >= 3;
    const repeatedBrandLike = Array.from(cleanedName.matchAll(brandRegexGlobal)).length > 1;
    const multiPartNumberLike = Array.from(
      cleanedName.matchAll(/\b(?:\d{2,}-\d{2,}(?:-\d{2,})?|\d{2}\s\d{2}\s\d{4}|\d{3}[.]\d{3}|[A-Z]{1,6}\d{3,}[A-Z0-9]*)\b/gi)
    ).length > 1;
    const lowQualityName =
      cleanedName.length > 95 ||
      hasManySingleCharTokens ||
      repeatedBrandLike ||
      multiPartNumberLike ||
      !/[А-Яа-яІіЇїЄєҐґ]{3,}|[A-Za-z]{3,}/.test(cleanedName);

    const canonicalName = buildCanonicalName(partNumberSource, partNumber);
    const finalName = lowQualityName && canonicalName ? canonicalName : cleanedName;

    // Keep only confident rows: either part number exists or name includes known brand.
    if (!partNumber && !brandRegex.test(finalName)) return;

    const key = `${finalName.toLowerCase()}|${price}|${qty}`;
    if (seen.has(key)) return;
    seen.add(key);
    parts.push({
      name: finalName,
      price,
      quantity: qty,
      part_number: partNumber,
      purchased_by: 'owner',
    });
  };

  // Run high-precision parsers only after helper functions are initialized.
  const structured = deferredStructuredParser(ocrData);

  const anchored = deferredAnchoredParser();

  let lastSkuLine = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Hard separators that should not spill name buffer into the next item.
    if (deleteKeywords.test(line) || noiseKeywords.test(line)) {
      buffer.length = 0;
      lastSkuLine = null;
      continue;
    }

    const isSkuLine =
      !currencyKeywords.test(line) &&
      !priceKeywords.test(line) &&
      (isLikelyPartNumberLine(line) || isSkuOnlyLine(line));

    if (isSkuLine) {
      // Start a fresh item context on SKU line to avoid leaking previous
      // header/logistics text into the next part name.
      buffer.length = 0;
      lastSkuLine = line;
      buffer.push(line);
    }

    const numericRow = parseNumericRowLine(line);
    if (numericRow) {
      const nameLines = buffer.filter(
        (l) => !isNoiseLine(l) && !isPriceLine(l) && !qtyKeywords.test(l) && !isDimensionLikeLine(l)
      );
      const name = nameLines.join(' ').trim();
      if (name) {
        pushPart(name, numericRow.price, numericRow.quantity, lastSkuLine || name);
        buffer.length = 0;
        lastSkuLine = null;
        continue;
      }
    }

    const rowCandidate = parseRowLine(line);
    if (rowCandidate) {
      pushPart(rowCandidate.name, rowCandidate.price, rowCandidate.quantity, lastSkuLine || line);
      buffer.length = 0;
      lastSkuLine = null;
      continue;
    }

    // Inline item row in some screens: "ELRING 147.581 ... 392 ... 784" (sku + price + total).
    // Try to parse it directly to avoid losing the item when there is no separate numeric-only row.
    {
      const hasRowDelimiters = /[|]/.test(line);
      const hasCurrencyHints = currencyKeywords.test(line) || priceKeywords.test(line);
      const hasHyphenSku = /\b\d{2,}-\d{2,}(?:-\d{2,})?\b/.test(line);
      const inlineNumbers = extractNumbersFromLine(line);
      if (!hasRowDelimiters && !hasCurrencyHints && isLikelyPartNumberLine(line) && inlineNumbers.length >= 2) {
        // Prevent parsing "W105 600mn" style lines as price/total rows.
        // These are usually volume/spec lines without currency hints.
        if (isLikelyVolumeLine(line)) {
          continue;
        }
        const sorted = inlineNumbers.slice().sort((a, b) => a - b);
        const secondLargest = sorted[sorted.length - 2];
        const largest = sorted[sorted.length - 1];

        // Prefer (price,total) rows where total ~= price * qty.
        const ratio = secondLargest > 0 ? largest / secondLargest : null;
        const ratioRounded = ratio ? Math.round(ratio) : null;
        const hasCoherentTotal =
          ratioRounded && ratioRounded >= 1 && ratioRounded <= 20 && nearlyEquals(secondLargest * ratioRounded, largest, 2.0);

        let price = null;
        let qty = 1;

        if (hasCoherentTotal) {
          price = secondLargest;
          qty = ratioRounded;
        } else if (inlineNumbers.length === 2 && !hasHyphenSku) {
          // Common pattern in order lists: "ELRING 318.580 ... 1538" (sku + price only)
          price = largest;
          qty = 1;
        } else {
          price = null;
        }

        if (Number.isFinite(price) && price >= 10 && price <= 200000) {
          const name = line
            .replace(numberPattern, ' ')
            .replace(/[₴]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (name && !isNoiseLine(name)) {
            pushPart(name, price, qty, line);
            buffer.length = 0;
            lastSkuLine = null;
            continue;
          }
        }
      }

      // After SKU-token filtering, some rows become a single-number row (price only).
      // Example: "SWAG 20 03 0009 ... 608" => only [608] remains.
      if (!hasRowDelimiters && !hasCurrencyHints && isLikelyPartNumberLine(line) && inlineNumbers.length === 1) {
        const price = inlineNumbers[0];
        if (
          Number.isFinite(price) &&
          price >= 10 &&
          price <= 200000 &&
          !(price >= 5000 && /\b\d{2}-\d{2}\b/.test(line)) &&
          !isLikelyBrandSkuOnlyLine(line)
        ) {
          const name = line
            .replace(numberPattern, ' ')
            .replace(/[₴]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (name && !isNoiseLine(name)) {
            pushPart(name, price, 1, line);
            buffer.length = 0;
            lastSkuLine = null;
            continue;
          }
        }
      }
    }

    // Some checkouts show only a single price per item (no qty/total columns).
    // Example OCR: "318 El В БІВ" for a single item priced 318.
    {
      const singleNumbers = extractNumbersFromLine(line);
      if (singleNumbers.length === 1) {
        const price = singleNumbers[0];
        if (
          Number.isFinite(price) &&
          price >= 20 &&
          price <= 200000 &&
          !(price >= 5000 && /\b\d{2}-\d{2}\b/.test(line)) &&
          !isLikelyPartNumberLine(line) &&
          !isSkuOnlyLine(line) &&
          !( !currencyKeywords.test(line) && !priceKeywords.test(line) && isLikelyVolumeLine(line) )
        ) {
          const nameLines = buffer.filter(
            (l) => !isNoiseLine(l) && !isPriceLine(l) && !qtyKeywords.test(l) && !isDimensionLikeLine(l)
          );
          const name = nameLines.join(' ').trim();
          if (name) {
            pushPart(name, price, 1, lastSkuLine || name);
            buffer.length = 0;
            lastSkuLine = null;
            continue;
          }
        }
      }
    }

    if (isPriceLine(line)) {
      const price = extractNumber(line);
      let qty = extractQty(line);
      if (!qty) {
        for (let j = i + 1; j <= i + 2 && j < lines.length; j++) {
          const nextLine = lines[j];
          qty = extractQty(nextLine);
          if (qty) break;
        }
      }
      if (!qty) qty = 1;

      const nameLines = buffer.filter(
        (l) => !isNoiseLine(l) && !isPriceLine(l) && !qtyKeywords.test(l) && !isDimensionLikeLine(l)
      );
      const name = nameLines.join(' ').trim();
      pushPart(name, price, qty, lastSkuLine || nameLines.join(' '));
      buffer.length = 0;
      lastSkuLine = null;
      continue;
    }

    if (!isNoiseLine(line)) {
      // If we already have a SKU line in context, and current line looks like
      // a noisy qty/price/total line (e.g. "5 38 1"), attach it to that SKU.
      if (lastSkuLine) {
        const rowNumbers = extractNumbersFromLine(line);
        const hasCurrencyHints = currencyKeywords.test(line) || priceKeywords.test(line);
        if (!hasCurrencyHints && rowNumbers.length >= 2) {
          const sorted = rowNumbers.slice().sort((a, b) => a - b);
          const maxNum = sorted[sorted.length - 1];
          const secondMax = sorted[sorted.length - 2];
          const qtyGuess = secondMax > 0 ? Math.round(maxNum / secondMax) : null;
          const coherent =
            qtyGuess && qtyGuess >= 1 && qtyGuess <= 20 && nearlyEquals(secondMax * qtyGuess, maxNum, 2.0);
          const chosenPrice = coherent ? secondMax : maxNum;
          if (Number.isFinite(chosenPrice) && chosenPrice >= 10 && chosenPrice <= 4000 && !isLikelyPartNumberLine(line)) {
            pushPart(lastSkuLine, chosenPrice, coherent ? qtyGuess : 1, lastSkuLine);
            buffer.length = 0;
            lastSkuLine = null;
            continue;
          }
        }
      }

      const safeLine = isDimensionLikeLine(line) ? stripDimensions(line) : line;
      if (!safeLine) continue;
      buffer.push(safeLine);
      if (buffer.length > 8) buffer.shift();
    }
  }

  const scorePartsQuality = (items) => {
    if (!Array.isArray(items) || !items.length) return -Infinity;
    let score = 0;
    let qtyGtOneCount = 0;
    for (const p of items) {
      const name = String(p?.name || '');
      const pn = String(p?.part_number || '');
      const price = Number(p?.price || 0);
      const qty = Number(p?.quantity || 0);
      if (name.length >= 8) score += 2;
      if (/[А-Яа-яІіЇїЄєҐґ]{4,}|[A-Za-z]{4,}/.test(name)) score += 1;
      if (brandRegex.test(name)) score += 2;
      if (pn) score += 3;
      if (price >= 10 && price <= 5000) score += 2;
      else if (price > 5000) score -= 2;
      if (qty >= 1 && qty <= 20) score += 1;
      if (qty > 1) qtyGtOneCount += 1;
      const noisy =
        /\b(терм|постав|склад|наявност|разом|итого|всього)\b/i.test(name) ||
        name.split(' ').filter((t) => t.length === 1).length >= 3;
      if (noisy) score -= 3;
    }
    // Prefer parsers that keep more valid item rows.
    score += Math.min(60, items.length * 4);
    // Large result sets with only qty=1 are often a sign of misaligned qty/sum columns.
    if (items.length >= 6 && qtyGtOneCount === 0) score -= 12;
    return score;
  };

  const getPartsStats = (items) => {
    const arr = Array.isArray(items) ? items : [];
    if (!arr.length) return { count: 0, qtyGtOne: 0, withPartNumber: 0 };
    let qtyGtOne = 0;
    let withPartNumber = 0;
    for (const p of arr) {
      const qty = Number(p?.quantity || 0);
      if (qty > 1) qtyGtOne += 1;
      if (String(p?.part_number || '').trim()) withPartNumber += 1;
    }
    return { count: arr.length, qtyGtOne, withPartNumber };
  };

  const legacyScore = scorePartsQuality(parts);
  const anchoredScore = scorePartsQuality(anchored);
  const structuredScore = scorePartsQuality(structured.parts);
  const legacyStats = getPartsStats(parts);
  const anchoredStats = getPartsStats(anchored);
  const structuredStats = getPartsStats(structured.parts);

  const mergeParts = (a, b) => {
    const byPn = new Map();
    const byNamePrice = new Map();
    const getBrandKey = (item) => {
      const name = String(item?.name || '');
      const match = name.match(brandRegex);
      return match ? match[0].replace(/\s+/g, ' ').trim().toLowerCase() : '';
    };
    const normalizePn = (value) => String(value || '').replace(/[\s./-]+/g, '').toLowerCase();
    const isSamePartFamily = (left, right) => {
      const leftPn = normalizePn(left?.part_number || '');
      const rightPn = normalizePn(right?.part_number || '');
      if (!leftPn || !rightPn) return false;
      if (leftPn === rightPn) return true;
      if (leftPn.length < 6 || rightPn.length < 6) return false;
      const suffixMatch = leftPn.endsWith(rightPn) || rightPn.endsWith(leftPn);
      if (!suffixMatch) return false;
      const leftBrand = getBrandKey(left);
      const rightBrand = getBrandKey(right);
      return Boolean(leftBrand && rightBrand && leftBrand === rightBrand);
    };
    const itemQuality = (item) => {
      const price = Number(item?.price || 0);
      const qty = Number(item?.quantity || 1);
      let score = 0;
      if (price >= 10 && price <= 5000) score += 3;
      else if (price > 5000) score -= 3;
      if (qty >= 1 && qty <= 20) score += 1;
      if (String(item?.part_number || '').trim()) score += 2;
      return score;
    };
    const pushOrReplace = (item) => {
      if (!item) return;
      const pn = String(item?.part_number || '').trim().toLowerCase();
      const name = String(item?.name || '').trim().toLowerCase();
      const price = Number(item?.price || 0);
      const qty = Number(item?.quantity || 1);
      const keyByNamePrice = `${name}|${price}|${qty}`;
      const score = itemQuality(item);

      if (pn) {
        for (const [existingPn, existing] of byPn.entries()) {
          if (!existingPn) continue;
          if (price !== Number(existing.item?.price || 0) || qty !== Number(existing.item?.quantity || 1)) continue;
          if (!isSamePartFamily(item, existing.item)) continue;
          if (score > existing.score || pn.length > existingPn.length) {
            byPn.delete(existingPn);
            byPn.set(pn, { item, score });
          }
          return;
        }
        const prev = byPn.get(pn);
        if (!prev || score > prev.score) {
          byPn.set(pn, { item, score });
        }
        return;
      }

      for (const existing of byPn.values()) {
        const existingPrice = Number(existing.item?.price || 0);
        const existingQty = Number(existing.item?.quantity || 1);
        if (price !== existingPrice || qty !== existingQty) continue;
        if (existing.score >= score + 2) return;
      }

      const prev = byNamePrice.get(keyByNamePrice);
      if (!prev || score > prev.score) {
        byNamePrice.set(keyByNamePrice, { item, score });
      }
    };
    (Array.isArray(a) ? a : []).forEach(pushOrReplace);
    (Array.isArray(b) ? b : []).forEach(pushOrReplace);
    return [
      ...Array.from(byPn.values()).map((x) => x.item),
      ...Array.from(byNamePrice.values()).map((x) => x.item),
    ];
  };

  const merged = mergeParts(anchored, parts);
  const mergedScore = scorePartsQuality(merged);

  let bestItems = parts;
  let bestScore = legacyScore;
  if (anchored.length && anchoredScore > bestScore + 2) {
    bestItems = anchored;
    bestScore = anchoredScore;
  }
  if (merged.length && mergedScore > bestScore + 2) {
    bestItems = merged;
    bestScore = mergedScore;
  }

  const bestNonStructuredCount = Math.max(parts.length, anchored.length, merged.length);
  const bestNonStructuredQtyGtOne = Math.max(legacyStats.qtyGtOne, anchoredStats.qtyGtOne);
  const structuredPnRatio =
    structuredStats.count > 0 ? structuredStats.withPartNumber / structuredStats.count : 0;
  const structuredCoverageOk =
    structured.parts.length >= Math.max(1, Math.ceil(bestNonStructuredCount * 0.85));
  const structuredHasReliableSignals =
    structuredStats.count >= 1 &&
    structuredStats.qtyGtOne >= Math.max(1, bestNonStructuredQtyGtOne) &&
    structuredPnRatio >= 0.8;
  const structuredSelectionDelta = structuredStats.count <= 3 ? 2 : 10;

  if (
    structured.parts.length &&
    structuredCoverageOk &&
    structuredHasReliableSignals &&
    structuredScore > bestScore - structuredSelectionDelta
  ) {
    bestItems = structured.parts;
    bestScore = structuredScore;
  }
  return bestItems;
}

function extractLicensePlateFromText(text) {
  const raw = String(text || '').toUpperCase();
  if (!raw) return null;
  const rawForLines = raw
    .replace(/\\R\\N/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\R/g, '\n')
    .replace(/\\T/g, ' ');
  const preNormalized = raw
    .replace(/\\R\\N/g, ' ')
    .replace(/\\N/g, ' ')
    .replace(/\\R/g, ' ')
    .replace(/\\T/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/R\s*N/g, 'K')
    .replace(/RN/g, 'K');

  const map = {
    А: 'A',
    В: 'B',
    Е: 'E',
    И: 'I',
    І: 'I',
    К: 'K',
    М: 'M',
    Н: 'H',
    О: 'O',
    Р: 'P',
    С: 'C',
    Т: 'T',
    Х: 'X',
    У: 'Y',
    Й: 'I',
    З: '3',
    Ч: '4',
    Ї: 'I',
    Є: 'E',
    Ґ: 'G',
    Л: 'A',
    Д: 'O',
  };

  const normalizeChunk = (value) =>
    String(value || '')
      .replace(/[АВЕИІКМНОРСТХУЙЗЧЇЄҐ]/g, (ch) => map[ch] || ch)
      .replace(/[^A-Z0-9 ]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const normalized = normalizeChunk(preNormalized);
  const normalizedLines = rawForLines
    .split(/\r?\n/)
    .map((line) =>
      normalizeChunk(
        String(line || '')
          .replace(/R\s*N/g, 'K')
          .replace(/RN/g, 'K')
      )
    )
    .filter(Boolean);
  const exactSources = Array.from(
    new Set(
      [
        normalized,
        ...normalizedLines,
        ...normalizedLines.flatMap((line, idx) => {
          if (idx >= normalizedLines.length - 1) return [];
          return [`${line} ${normalizedLines[idx + 1]}`, `${line}${normalizedLines[idx + 1]}`];
        }),
      ].filter(Boolean)
    )
  );

  // Prefer direct per-line plate hits (e.g. "KA 2878 IA") over mixed noisy blobs.
  for (const line of normalizedLines) {
    const lineMatch = String(line).match(/\b([A-Z]{2})\s*(\d{4})\s*([A-Z]{2})\b/);
    if (lineMatch) {
      return `${lineMatch[1]}${lineMatch[2]}${lineMatch[3]}`;
    }
  }

  for (const source of exactSources) {
    const exactMatch = String(source).match(/\b[A-Z]{2}\s?\d{4}\s?[A-Z]{2}\b/);
    if (exactMatch && exactMatch[0]) {
      return exactMatch[0].replace(/\s+/g, '');
    }
  }

  const fragments = [];
  const seenFragments = new Set();
  const pushFragment = (value, kind = 'token') => {
    const compact = String(value || '').replace(/[^A-Z0-9]/g, '');
    if (!compact || compact.length < 8 || compact.length > 10) return;
    const key = `${kind}:${compact}`;
    if (seenFragments.has(key)) return;
    seenFragments.add(key);
    fragments.push({ compact, kind });
  };

  for (const line of normalizedLines) {
    pushFragment(line, 'line');
    const tokens = String(line).split(/\s+/).filter(Boolean);
    tokens.forEach((token) => pushFragment(token, 'token'));
    for (let i = 0; i < tokens.length - 1; i += 1) {
      pushFragment(`${tokens[i]}${tokens[i + 1]}`, 'pair');
      if (i < tokens.length - 2) {
        pushFragment(`${tokens[i]}${tokens[i + 1]}${tokens[i + 2]}`, 'triple');
      }
    }
  }

  if (!fragments.length) return null;

  const allowedLetters = new Set(['A', 'B', 'C', 'E', 'H', 'I', 'K', 'M', 'O', 'P', 'T', 'X', 'Y']);
  const uaPrefixes = new Set([
    'AA',
    'AB',
    'AC',
    'AE',
    'AH',
    'AI',
    'AK',
    'AM',
    'AO',
    'AP',
    'AT',
    'AX',
    'BA',
    'BB',
    'BC',
    'BE',
    'BH',
    'BI',
    'BK',
    'BM',
    'BO',
    'BP',
    'BT',
    'BX',
    'CA',
    'CB',
    'CC',
    'CE',
    'CH',
    'CI',
    'CK',
    'CM',
    'CO',
    'CP',
    'CT',
    'CX',
    'EA',
    'EB',
    'EC',
    'EE',
    'EH',
    'EI',
    'EK',
    'EM',
    'EO',
    'EP',
    'ET',
    'EX',
    'HA',
    'HB',
    'HC',
    'HE',
    'HH',
    'HI',
    'HK',
    'HM',
    'HO',
    'HP',
    'HT',
    'HX',
    'IA',
    'IB',
    'IC',
    'IE',
    'IH',
    'II',
    'IK',
    'IM',
    'IO',
    'IP',
    'IT',
    'IX',
    'KA',
    'KB',
    'KC',
    'KE',
    'KH',
    'KI',
    'KK',
    'KM',
    'KO',
    'KP',
    'KT',
    'KX',
    'MA',
    'MB',
    'MC',
    'ME',
    'MH',
    'MI',
    'MK',
    'MM',
    'MO',
    'MP',
    'MT',
    'MX',
    'OA',
    'OB',
    'OC',
    'OE',
    'OH',
    'OI',
    'OK',
    'OM',
    'OO',
    'OP',
    'OT',
    'OX',
    'PA',
    'PB',
    'PC',
    'PE',
    'PH',
    'PI',
    'PK',
    'PM',
    'PO',
    'PP',
    'PT',
    'PX',
  ]);
  const isAllowedLetter = (ch) => allowedLetters.has(ch);
  const isDigit = (ch) => ch >= '0' && ch <= '9';

  const fixLetter = (ch) => {
    if (allowedLetters.has(ch)) return { ch, cost: 0 };
    if (ch === '0') return { ch: 'O', cost: 1 };
    if (ch === '1') return { ch: 'I', cost: 1 };
    if (ch === '8') return { ch: 'B', cost: 1 };
    if (ch === '6') return { ch: 'B', cost: 2 };
    if (ch === '4') return { ch: 'A', cost: 2 };
    if (ch === '7') return { ch: 'T', cost: 2 };
    if (ch === '9') return { ch: 'P', cost: 2 };
    if (ch === '3') return { ch: 'E', cost: 2 };
    if (ch === '5') return { ch: 'C', cost: 3 };
    if (ch === 'L' || ch === 'J') return { ch: 'I', cost: 2 };
    if (ch === 'V' || ch === 'U') return { ch: 'Y', cost: 2 };
    if (ch === 'N') return { ch: 'H', cost: 2 };
    if (ch === 'R') return { ch: 'P', cost: 2 };
    if (ch === 'D' || ch === 'Q') return { ch: 'O', cost: 2 };
    if (ch === 'G') return { ch: 'C', cost: 3 };
    if (ch === 'F') return { ch: 'E', cost: 3 };
    return { ch, cost: 99 };
  };

  const fixDigit = (ch) => {
    if (isDigit(ch)) return { ch, cost: 0 };
    if (ch === 'O') return { ch: '0', cost: 1 };
    if (ch === 'I') return { ch: '1', cost: 1 };
    if (ch === 'L') return { ch: '1', cost: 2 };
    if (ch === 'Z') return { ch: '2', cost: 1 };
    if (ch === 'S') return { ch: '5', cost: 1 };
    if (ch === 'B') return { ch: '8', cost: 1 };
    if (ch === 'E') return { ch: '3', cost: 2 };
    if (ch === 'A') return { ch: '4', cost: 2 };
    if (ch === 'T') return { ch: '7', cost: 2 };
    if (ch === 'W') return { ch: '7', cost: 3 };
    if (ch === 'P') return { ch: '9', cost: 3 };
    if (ch === 'G') return { ch: '6', cost: 2 };
    if (ch === 'C') return { ch: '6', cost: 3 };
    if (ch === 'Q') return { ch: '0', cost: 2 };
    if (ch === 'D') return { ch: '0', cost: 2 };
    if (ch === 'U') return { ch: '0', cost: 3 };
    return { ch, cost: 99 };
  };

  const fixPrefix = (a, b) => {
    const direct = `${a}${b}`;
    if (uaPrefixes.has(direct)) return { a, b, cost: 0 };

    const variants = [
      { a, b },
      // common confusion between Cyrillic-like shapes: P<->B
      { a: a === 'P' ? 'B' : a === 'B' ? 'P' : a, b },
      { a, b: b === 'P' ? 'B' : b === 'B' ? 'P' : b },
      { a: a === 'P' ? 'B' : a === 'B' ? 'P' : a, b: b === 'P' ? 'B' : b === 'B' ? 'P' : b },
    ];

    for (const v of variants) {
      const p = `${v.a}${v.b}`;
      if (uaPrefixes.has(p)) {
        const cost = (v.a !== a ? 1 : 0) + (v.b !== b ? 1 : 0);
        return { a: v.a, b: v.b, cost };
      }
    }

    return null;
  };

  const scoreCandidate = (candidate) => {
    const s = candidate.split('');

    const a0 = fixLetter(s[0]);
    const a1 = fixLetter(s[1]);
    const a6 = fixLetter(s[6]);
    const a7 = fixLetter(s[7]);
    if (a0.cost >= 99 || a1.cost >= 99 || a6.cost >= 99 || a7.cost >= 99) return null;

    const d2 = fixDigit(s[2]);
    const d3 = fixDigit(s[3]);
    const d4 = fixDigit(s[4]);
    const d5 = fixDigit(s[5]);
    if (d2.cost >= 99 || d3.cost >= 99 || d4.cost >= 99 || d5.cost >= 99) return null;

    const prefixFix = fixPrefix(a0.ch, a1.ch);
    if (!prefixFix) return null;

    const cost =
      a0.cost +
      a1.cost +
      d2.cost +
      d3.cost +
      d4.cost +
      d5.cost +
      a6.cost +
      a7.cost +
      prefixFix.cost;

    const fixed = `${prefixFix.a}${prefixFix.b}${d2.ch}${d3.ch}${d4.ch}${d5.ch}${a6.ch}${a7.ch}`;
    if (!/^[A-Z]{2}\d{4}[A-Z]{2}$/.test(fixed)) return null;
    if (!isAllowedLetter(fixed[0]) || !isAllowedLetter(fixed[1])) return null;
    if (!isAllowedLetter(fixed[6]) || !isAllowedLetter(fixed[7])) return null;
    const exactHits = fixed.split('').reduce((sum, ch, idx) => sum + (candidate[idx] === ch ? 1 : 0), 0);
    return { fixed, cost, exactHits };
  };

  let best = null;
  const considerCandidate = (candidate, kind, penalty = 0) => {
    const scored = scoreCandidate(candidate);
    if (!scored) return false;
    const totalCost = scored.cost + penalty;
    const minExactHits = penalty > 0 ? 7 : kind === 'line' || kind === 'pair' || kind === 'triple' ? 6 : 7;
    if (totalCost > 3) return false;
    if (scored.exactHits < minExactHits) return false;
    const withPenalty = { fixed: scored.fixed, cost: totalCost, exactHits: scored.exactHits };
    if (!best || withPenalty.cost < best.cost) {
      best = withPenalty;
    }
    return withPenalty.cost === 0 && withPenalty.exactHits === 8;
  };

  const trySource = ({ compact, kind }) => {
    if (!compact) return;

    if (compact.length === 8) {
      considerCandidate(compact, kind);
      return;
    }

    if (compact.length === 9) {
      for (let drop = 0; drop < 9; drop += 1) {
        const s8 = compact.slice(0, drop) + compact.slice(drop + 1);
        considerCandidate(s8, kind, 2);
      }
      return;
    }

    if (compact.length === 10) {
      for (let dropA = 0; dropA < 10; dropA += 1) {
        for (let dropB = dropA + 1; dropB < 10; dropB += 1) {
          const s8 = compact.slice(0, dropA) + compact.slice(dropA + 1, dropB) + compact.slice(dropB + 1);
          if (s8.length === 8) {
            considerCandidate(s8, kind, 3);
          }
        }
      }
    }
  };

  for (const source of fragments) {
    trySource(source);
    if (best?.cost === 0 && best?.exactHits === 8) break;
  }

  if (best?.fixed) return best.fixed;

  // Soft fallback: try to recover plate even when region prefix is uncertain.
  const softSources = Array.from(
    new Set(
      [
        normalized,
        ...normalizedLines,
        ...normalizedLines.flatMap((line, idx) => {
          if (idx >= normalizedLines.length - 1) return [];
          return [`${line} ${normalizedLines[idx + 1]}`, `${line}${normalizedLines[idx + 1]}`];
        }),
      ]
        .filter(Boolean)
        .map((v) => String(v).replace(/[^A-Z0-9]/g, ' '))
    )
  );

  const softFix = (candidate) => {
    const s = String(candidate || '').replace(/[^A-Z0-9]/g, '');
    if (s.length !== 8) return null;
    const a0 = fixLetter(s[0]);
    const a1 = fixLetter(s[1]);
    const d2 = fixDigit(s[2]);
    const d3 = fixDigit(s[3]);
    const d4 = fixDigit(s[4]);
    const d5 = fixDigit(s[5]);
    const a6 = fixLetter(s[6]);
    const a7 = fixLetter(s[7]);
    const nodes = [a0, a1, d2, d3, d4, d5, a6, a7];
    if (nodes.some((x) => x.cost >= 99)) return null;
    const fixed = `${a0.ch}${a1.ch}${d2.ch}${d3.ch}${d4.ch}${d5.ch}${a6.ch}${a7.ch}`;
    if (!/^[A-Z]{2}\d{4}[A-Z]{2}$/.test(fixed)) return null;
    const cost = nodes.reduce((sum, node) => sum + node.cost, 0);
    return cost <= 4 ? fixed : null;
  };

  for (const src of softSources) {
    const compact = String(src || '').replace(/[^A-Z0-9]/g, '');
    for (let i = 0; i <= compact.length - 8; i += 1) {
      const part = compact.slice(i, i + 8);
      const fixed = softFix(part);
      if (fixed) return fixed;
    }
  }

  return null;
}

exports.__test__ = {
  parseOcrText,
  scoreParsedParts,
  mergePartsAcrossOcrAttempts,
  selectBestPartsOcrAttempt,
  extractLicensePlateFromText,
};
