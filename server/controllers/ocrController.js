const { createWorker } = require('tesseract.js');
const fs = require('fs');

let jimpResolved = null;
let jimpResolvePromise = null;
let jimpResolveError = null;

async function getJimp() {
  if (jimpResolvePromise) return jimpResolvePromise;
  jimpResolvePromise = (async () => {
    try {
      const mod = await import('jimp');
      const resolved = mod?.default || mod?.Jimp || mod;
      if (resolved && typeof resolved.read === 'function') {
        jimpResolved = resolved;
        jimpResolveError = null;
        return jimpResolved;
      }
      jimpResolved = null;
      jimpResolveError = 'Jimp module loaded but has no read()';
      return null;
    } catch (err) {
      try {
        const mod = require('jimp');
        const resolved = mod?.default || mod?.Jimp || mod;
        if (resolved && typeof resolved.read === 'function') {
          jimpResolved = resolved;
          jimpResolveError = null;
          return jimpResolved;
        }
        jimpResolved = null;
        jimpResolveError = 'Jimp require() succeeded but has no read()';
        return null;
      } catch (requireErr) {
        jimpResolved = null;
        jimpResolveError = String(requireErr?.message || err?.message || requireErr || err);
        return null;
      }
    }
  })();
  return jimpResolvePromise;
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

  try {
    const Jimp = await getJimp();
    if (Jimp) {
      const img = await Jimp.read(imagePath);
      const w = img.bitmap?.width || 0;
      const h = img.bitmap?.height || 0;
      if (w > 0 && h > 0) {
        const samplePoints = [
          { x: Math.floor(w * 0.2), y: Math.floor(h * 0.2) },
          { x: Math.floor(w * 0.5), y: Math.floor(h * 0.5) },
          { x: Math.floor(w * 0.8), y: Math.floor(h * 0.8) },
        ];
        let brightnessSum = 0;
        for (const p of samplePoints) {
          const clr = img.getPixelColor(p.x, p.y);
          const rgba = Jimp.intToRGBA(clr);
          brightnessSum += (rgba.r + rgba.g + rgba.b) / 3;
        }
        const avgBrightness = brightnessSum / samplePoints.length;
        const isDarkBackground = avgBrightness < 110;

        const processed = img.clone().grayscale();
        try {
          processed.contrast(0.35);
        } catch (_) {
          void _;
        }
        if (isDarkBackground) {
          try {
            processed.invert();
          } catch (_) {
            void _;
          }
        }

        const targetWidth = Math.min(2400, Math.max(1400, w < 1400 ? 1400 : w));
        if (w < targetWidth) {
          resizeKeepAspect(processed, targetWidth);
        }

        preprocessedPath = `${imagePath}_preprocessed.png`;
        await processed.writeAsync(preprocessedPath);
        ocrPath = preprocessedPath;
        preprocessingApplied = true;
      }
    }
  } catch (err) {
    void err;
    ocrPath = imagePath;
    preprocessedPath = null;
    preprocessingApplied = false;
  }

  const worker = await createWorker('ukr+eng');
  const {
    data: { text },
  } = await worker.recognize(ocrPath);
  await worker.terminate();

  return {
    imagePath,
    preprocessedPath,
    preprocessingApplied,
    usedPath: ocrPath === imagePath ? 'original' : 'preprocessed',
    rawText: text || '',
    parts: parseOcrText(text || ''),
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
      meta: {
        preprocessingApplied: result.preprocessingApplied,
        usedPath: result.usedPath,
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

function parseOcrText(text) {
  const normalizeLine = (line) => line.replace(/\s+/g, ' ').trim();
  const lines = text.replace(/\r/g, '\n').split('\n').map(normalizeLine).filter(Boolean);

  const parts = [];
  const seen = new Set();
  const buffer = [];

  const numberPattern = /(\d{1,3}(?:[ \u00A0]\d{3})+(?:[.,]\d{1,2})?|\d{4,}(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
  const priceKeywords = /(ціна|цiна|цена|price)/i;
  const qtyKeywords = /(кількість|количество|qty|шт\.?|pcs|x)/i;
  const currencyKeywords = /(грн|uah|₴)/i;
  const noiseKeywords =
    /(сума|сумма|всього|разом|итого|підсумок|оплата|знижка|накладна|рахунок|invoice|замовлення|терм\w*\s*постав\w*|постачальник|покупець|iban|edrpou|єдрпоу|код|тел|телефон|адреса)/i;
  const deleteKeywords = /(удалить|видалити|delete)/i;

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

  const isLikelyPartNumberLine = (value) => {
    const line = String(value || '').trim();
    if (!line) return false;
    // Typical SKU patterns: 40-76149-00, 20 03 0009, 147.581, 318.580, MS0825-98
    const hasSkuToken =
      /\b\d{2,}-\d{2,}(?:-\d{2,})?\b/.test(line) ||
      /\b\d{2,}[.]\d{2,}\b/.test(line) ||
      /\b[A-Z]{1,3}\d{3,}(?:-\d{2,})?\b/.test(line) ||
      /\b\d{2}\s\d{2}\s\d{4}\b/.test(line);
    if (!hasSkuToken) return false;
    // Needs at least one word token as well (brand/manufacturer)
    return /[A-Za-zА-Яа-яІіЇїЄє]{2,}/.test(line);
  };

  const isSkuOnlyLine = (value) => {
    const line = String(value || '').trim();
    if (!line) return false;
    if (currencyKeywords.test(line) || priceKeywords.test(line)) return false;
    // Examples: K2W105, EATRMT7912X1L, JP1411000300-like.
    if (/\b[A-Z]{1,4}\d{3,}\b/i.test(line)) return true;
    // Hyphenated/segmented SKUs without a brand word.
    if (/\b\d{2,}-\d{2,}(?:-\d{2,})?\b/.test(line)) return true;
    return false;
  };

  const parseNumber = (value) => {
    if (!value) return null;
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
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
    if (String(line).trim().length <= 2 && !numberPattern.test(line)) return true;
    if (noiseKeywords.test(line)) return true;
    if (deleteKeywords.test(line)) return true;
    const noLetters = !/[A-Za-zА-Яа-яІіЇїЄє]/.test(line);
    const hasNumber = numberPattern.test(line);
    if (noLetters && !hasNumber) return true;
    return false;
  };

  const isPriceLine = (line) => {
    if (!line) return false;
    if (!(priceKeywords.test(line) || currencyKeywords.test(line))) return false;
    const num = extractNumber(line);
    return Number.isFinite(num);
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

    const numbers = Array.from(line.matchAll(numberPattern))
      .map((m) => parseNumber(m[0]))
      .filter((n) => Number.isFinite(n));

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
    const letterMatches = line.match(/[A-Za-zА-Яа-яІіЇїЄє]/g);
    const letterCount = letterMatches ? letterMatches.length : 0;
    const numbers = Array.from(line.matchAll(numberPattern))
      .map((m) => parseNumber(m[0]))
      .filter((n) => Number.isFinite(n));
    if (numbers.length < 2) return null;

    // Avoid interpreting spec/volume lines like "90 1л (EATRMT7912X1L)" as price rows.
    const hasBracketedCode = /\([^)]*\d[^)]*\)/.test(line);
    const looksLikeVolume = /\b\d+\s*[lл]\b/i.test(line);
    if (looksLikeVolume && hasBracketedCode) {
      return null;
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
      if (isReasonableQty(qty)) score += 6;
      if (price >= 10 && price <= 200000) score += 2;
      if (Number.isFinite(total) && total > 0) {
        score += 1;
        if (nearlyEquals(price * qty, total, 1.2)) score += 6;
        if (total >= price) score += 1;
      }

      return { price, quantity: qty, score };
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
        candidates.push(scoreCandidate({ price: small, qty: ratioRounded, total: big }));
      }

      candidates.push(scoreCandidate({ price: a, qty: 1, total: b }));
      candidates.push(scoreCandidate({ price: b, qty: 1, total: a }));
      candidates.push(scoreCandidate({ price: a, qty: Math.round(b), total: null }));
      candidates.push(scoreCandidate({ price: b, qty: Math.round(a), total: null }));
    }

    const best = candidates
      .filter(Boolean)
      .sort((x, y) => (y.score || 0) - (x.score || 0))[0];

    if (!best) return null;
    if (!isReasonableQty(best.quantity)) {
      return { price: best.price, quantity: 1 };
    }
    return { price: best.price, quantity: best.quantity };
  };

  const pushPart = (name, price, quantity, lineForPartNumber) => {
    const cleanedName = normalizeLine(name);
    if (!cleanedName || isNoiseLine(cleanedName)) return;
    if (!Number.isFinite(price) || price <= 0) return;
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;

    const partNumberSource = String(lineForPartNumber || cleanedName);
    const isDimensionLike = /\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?\s*[xх]\s*\d+(?:[.,]\d+)?/i.test(
      partNumberSource
    );

    const partNumberMatch = isDimensionLike
      ? null
      : partNumberSource.match(
          /\b([A-Z0-9]{3,}-[A-Z0-9]{2,}|[A-Z0-9]{2,}[./-][A-Z0-9]{2,}|\d{5,}|[A-Z]{2,}\d{3,})\b/
        );
    const partNumber = partNumberMatch ? partNumberMatch[1] : '';
    const key = `${cleanedName.toLowerCase()}|${price}|${qty}`;
    if (seen.has(key)) return;
    seen.add(key);
    parts.push({
      name: cleanedName,
      price,
      quantity: qty,
      part_number: partNumber,
      purchased_by: 'owner',
    });
  };

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

    if (!currencyKeywords.test(line) && !priceKeywords.test(line) && (isLikelyPartNumberLine(line) || isSkuOnlyLine(line))) {
      lastSkuLine = line;
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
      const inlineNumbers = Array.from(line.matchAll(numberPattern))
        .map((m) => parseNumber(m[0]))
        .filter((n) => Number.isFinite(n));
      if (!hasRowDelimiters && !hasCurrencyHints && isLikelyPartNumberLine(line) && inlineNumbers.length >= 2) {
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
    }

    // Some checkouts show only a single price per item (no qty/total columns).
    // Example OCR: "318 El В БІВ" for a single item priced 318.
    {
      const singleNumbers = Array.from(line.matchAll(numberPattern))
        .map((m) => parseNumber(m[0]))
        .filter((n) => Number.isFinite(n));
      if (singleNumbers.length === 1) {
        const price = singleNumbers[0];
        if (
          Number.isFinite(price) &&
          price >= 20 &&
          price <= 200000 &&
          !isLikelyPartNumberLine(line) &&
          !isSkuOnlyLine(line)
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
      const safeLine = isDimensionLikeLine(line) ? stripDimensions(line) : line;
      if (!safeLine) continue;
      buffer.push(safeLine);
      if (buffer.length > 8) buffer.shift();
    }
  }

  return parts;
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
