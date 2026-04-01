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

async function resetPlateWorker() {
  const instance = plateWorkerInstance;
  plateWorkerInstance = null;
  plateWorkerPromise = null;
  plateWorkerWarming = false;
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
  plateWorkerPromise = (async () => {
    const worker = await createWorker('ukr+eng');
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
    return worker;
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
    await withTimeout(prev, 5000);
  } catch (_) {
    const err = new Error('OCR busy');
    err.code = 'OCR_BUSY';
    throw err;
  }
  try {
    const worker = await ensurePlateWorkerReady(15000);
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

exports.parsePartsFromImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Зображення не знайдено' });
    }

    const imagePath = req.file.path;

    // Initialize Tesseract worker
    const worker = await createWorker('ukr+eng');
    const {
      data: { text },
    } = await worker.recognize(imagePath);
    await worker.terminate();

    // Clean up uploaded file
    fs.unlink(imagePath, (err) => {
      if (err) console.error('Failed to delete temp file:', err);
    });

    // Parse the text
    // The parsing logic needs to be robust to handle the format described
    const parts = parseOcrText(text);

    res.json(parts);
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

    const imagePath = req.file.path;
    let preprocessedPath = null;
    let fullPreprocessedPath = null;
    let binaryPreprocessedPath = null;
    let bottomPreprocessedPath = null;
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
        const preprocessBudgetMs = 25000;
        const readTimeoutMs = 10000;

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
          if (remainingMs() < 6000) {
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

        if (debug) {
          try {
            if (remainingMs() < 8000) {
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
            if (remainingMs() < 8000) {
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

    const ocrInputs = [
      { label: 'bottom', path: bottomPreprocessedPath },
      { label: 'binary', path: binaryPreprocessedPath },
      { label: 'plate', path: preprocessedPath },
      { label: 'full', path: fullPreprocessedPath },
      { label: 'orig', path: imagePath },
    ].filter((x) => Boolean(x.path));

    if (plateWorkerWarming && !plateWorkerInstance) {
      return res.status(503).json({ message: 'OCR warming up, please retry' });
    }

    const result = await withTimeout(
      withPlateWorker(async (worker) => {
        const psmModes = ['7', '6', '11'];
        const perAttemptTimeoutMs = 12000;
        const overallTimeoutMs = 25000;
        const startedAt = Date.now();
        let bestText = '';
        let bestPlate = null;
        const attempts = [];

        for (const input of ocrInputs) {
          for (const psm of psmModes) {
            try {
              if (Date.now() - startedAt > overallTimeoutMs) {
                const err = new Error('OCR timeout');
                err.code = 'OCR_TIMEOUT';
                throw err;
              }
              try {
                await worker.setParameters({ tessedit_pageseg_mode: psm });
              } catch (_) {
                void _;
              }

              const {
                data: { text },
              } = await withTimeout(worker.recognize(input.path), perAttemptTimeoutMs, () => {
                void resetPlateWorker();
              });
              bestText = text || bestText;
              const plate = extractLicensePlateFromText(text);

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

        return { bestPlate, bestText, attempts };
      }),
      30000,
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

    const debugMeta = debug
      ? {
          meta: {
            node: process.version,
            jimp: Boolean(Jimp),
            jimpError: jimpResolveError,
            inputs: {
              bottom: Boolean(bottomPreprocessedPath),
              binary: Boolean(binaryPreprocessedPath),
              plate: Boolean(preprocessedPath),
              full: Boolean(fullPreprocessedPath),
              orig: true,
            },
            preprocessErrors,
          },
        }
      : {};

    if (!result?.bestPlate) {
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
      void resetPlateWorker();
      return res.status(504).json({ message: 'OCR timeout', error: msg });
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

  const numberPattern = /(\d{1,3}(?:[ \u00A0]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g;
  const priceKeywords = /(ціна|цiна|цена|price)/i;
  const qtyKeywords = /(кількість|количество|qty|шт\.?|pcs|x)/i;
  const currencyKeywords = /(грн|uah|₴)/i;
  const noiseKeywords =
    /(сума|сумма|всього|разом|итого|підсумок|оплата|знижка|накладна|рахунок|invoice|замовлення|термін поставки|термин поставки|постачальник|покупець|iban|edrpou|єдрпоу|код|тел|телефон|адреса)/i;
  const deleteKeywords = /(удалить|видалити|delete)/i;

  const parseNumber = (value) => {
    if (!value) return null;
    const cleaned = value.replace(/\s/g, '').replace(',', '.');
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  };

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
    const numbers = Array.from(line.matchAll(numberPattern))
      .map((m) => parseNumber(m[0]))
      .filter((n) => Number.isFinite(n));
    if (numbers.length < 2) return null;
    let qty = 1;
    let price = null;
    if (numbers.length >= 3) {
      const last = numbers[numbers.length - 1];
      const secondLast = numbers[numbers.length - 2];
      const thirdLast = numbers[numbers.length - 3];
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
    const name = line.replace(numberPattern, ' ').replace(/[₴]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!name || isNoiseLine(name)) return null;
    return { name, price, quantity: qty };
  };

  const pushPart = (name, price, quantity, lineForPartNumber) => {
    const cleanedName = normalizeLine(name);
    if (!cleanedName || isNoiseLine(cleanedName)) return;
    if (!Number.isFinite(price) || price <= 0) return;
    const qty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    const partNumberMatch = (lineForPartNumber || cleanedName).match(
      /([A-Z0-9]{3,}-[A-Z0-9]{2,}|[A-Z0-9]{5,})/
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const rowCandidate = parseRowLine(line);
    if (rowCandidate) {
      pushPart(rowCandidate.name, rowCandidate.price, rowCandidate.quantity, line);
      buffer.length = 0;
      continue;
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
        (l) => !isNoiseLine(l) && !isPriceLine(l) && !qtyKeywords.test(l)
      );
      const name = nameLines.join(' ').trim();
      pushPart(name, price, qty, nameLines.join(' '));
      buffer.length = 0;
      continue;
    }

    if (!isNoiseLine(line)) {
      buffer.push(line);
      if (buffer.length > 4) buffer.shift();
    }
  }

  return parts;
}

function extractLicensePlateFromText(text) {
  const raw = String(text || '').toUpperCase();
  if (!raw) return null;

  const map = {
    А: 'A',
    В: 'B',
    Е: 'E',
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
    Ї: 'I',
    Є: 'E',
    Ґ: 'G',
  };

  const normalized = raw
    .replace(/[АВЕІКМНОРСТХУЇЄҐ]/g, (ch) => map[ch] || ch)
    .replace(/[^A-Z0-9]/g, '');

  if (normalized.length < 8) return null;

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
    return { ch, cost: 99 };
  };

  const fixDigit = (ch) => {
    if (isDigit(ch)) return { ch, cost: 0 };
    if (ch === 'O') return { ch: '0', cost: 1 };
    if (ch === 'I') return { ch: '1', cost: 1 };
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
    let cost = 0;
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

    cost +=
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
    return { fixed, cost };
  };

  let best = null;
  for (let i = 0; i <= normalized.length - 8; i += 1) {
    const s = normalized.slice(i, i + 8);
    const scored = scoreCandidate(s);
    if (!scored) continue;
    if (!best || scored.cost < best.cost) {
      best = scored;
      if (best.cost === 0) break;
    }
  }

  if (best?.fixed) return best.fixed;
  return null;
}
