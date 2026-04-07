const DEFAULT_API_BASE_URL = 'https://avtoservis-server.onrender.com';
const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
)
  .trim()
  .replace(/\/+$/, '');
const resolveUrl = (url) => (url.startsWith('http') ? url : `${API_BASE_URL}${url}`);

async function warmupApiConnection(timeoutMs = 5000) {
  try {
    const url = resolveUrl('/health');
    if (!url || url === '/health') return;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      window.clearTimeout(timeoutId);
    }
  } catch (_) {
    void _;
  }
}

async function requestJson(url, options = {}) {
  const token = localStorage.getItem('auth_token');
  const response = await fetch(resolveUrl(url), {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.message === 'string') {
        message = errorBody.message;
        if (typeof errorBody.details === 'string' && errorBody.details.trim()) {
          message = `${message}: ${errorBody.details}`;
        }
      }
    } catch (error) {
      void error;
    }
    throw new Error(message);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return null;
}

const normalizeColorId = (value) => {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  const map = {
    black: 'black',
    'чорний': 'black',
    'черный': 'black',
    white: 'white',
    'білий': 'white',
    'белый': 'white',
    gray: 'gray',
    grey: 'gray',
    'сірий': 'gray',
    'серый': 'gray',
    silver: 'silver',
    'сріблястий': 'silver',
    'серебристый': 'silver',
    red: 'red',
    'червоний': 'red',
    'красный': 'red',
    blue: 'blue',
    'синій': 'blue',
    'синий': 'blue',
    green: 'green',
    'зелений': 'green',
    'зеленый': 'green',
    yellow: 'yellow',
    'жовтий': 'yellow',
    'желтый': 'yellow',
    brown: 'brown',
    'коричневий': 'brown',
    'коричневый': 'brown',
    orange: 'orange',
    'помаранчевий': 'orange',
    'оранжевый': 'orange',
    purple: 'purple',
    'фіолетовий': 'purple',
    'фиолетовый': 'purple',
    beige: 'beige',
    'бежевий': 'beige',
    'бежевый': 'beige'
  };
  return map[raw] || raw;
};

const mapVehicle = (v) => ({
  id: v.id,
  vin: v.vin,
  make: v.make || v.brand,
  brand: v.brand || v.make,
  model: v.model,
  year: v.year,
  licensePlate:
    v.licensePlate ||
    v.license_plate ||
    v.registration_number ||
    '',
  mileage: v.mileage != null ? v.mileage : 0,
  color: normalizeColorId(v.color),
  engineType: v.engine_type || v.engineType || v.fuel_type || '',
  transmission: v.transmission || v.transmission_type || v.gearbox || v.gear_box || '',
  engineVolume:
    v.engine_capacity ||
    v.engine_volume ||
    v.engineVolume ||
    v.engineCapacity ||
    v.engine_capacity_l ||
    '',
  photoUrl: v.photo_url || v.photoUrl || '',
  UserId: v.user_id || v.UserId || null
});

const vehicleByPlateCache = new Map();

async function prepareImageForOcr(file) {
  if (!file || typeof File === 'undefined' || !(file instanceof File)) {
    return file;
  }

  const type = String(file.type || '').toLowerCase();
  if (!type.startsWith('image/')) {
    return file;
  }

  const shouldReencode =
    file.size > 0 || type.includes('heic') || type.includes('heif');
  if (!shouldReencode || typeof document === 'undefined') {
    return file;
  }

  try {
    const objectUrl = URL.createObjectURL(file);
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Image decode failed'));
      img.src = objectUrl;
    });
    URL.revokeObjectURL(objectUrl);

    const width = Number(image.width || 0);
    const height = Number(image.height || 0);
    if (!width || !height) {
      return file;
    }

    const maxSide = 1400;
    const ratio = Math.min(1, maxSide / Math.max(width, height));
    const targetW = Math.max(1, Math.round(width * ratio));
    const targetH = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }
    ctx.drawImage(image, 0, 0, targetW, targetH);

    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.88);
    });

    if (!blob || !blob.size) {
      return file;
    }

    const originalName = String(file.name || 'plate');
    const baseName = originalName.replace(/\.[^/.]+$/, '') || 'plate';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
  } catch (err) {
    void err;
    return file;
  }
}

function normalizeListPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
}

export async function list(options = {}) {
  const params = new URLSearchParams();
  if (options && options.serviced) {
    params.set('serviced', '1');
  }
  const url = params.toString() ? `/api/vehicles?${params.toString()}` : '/api/vehicles';
  const payload = await requestJson(url);
  const data = normalizeListPayload(payload);
  return data.map(mapVehicle);
}

export async function listForUser(userId) {
  if (!userId) return [];
  const payload = await requestJson(`/api/vehicles?user_id=${encodeURIComponent(userId)}`);
  const data = normalizeListPayload(payload);
  return data.map(mapVehicle);
}

export async function update(id, payload) {
  const vin = id;
  const body = {
    make: payload.make || payload.brand,
    model: payload.model,
    year:
      payload.year !== undefined && payload.year !== null && payload.year !== ''
        ? Number(payload.year)
        : null,
    vin: payload.vin,
    license_plate: payload.license_plate || payload.licensePlate,
    mileage:
      payload.mileage !== undefined && payload.mileage !== null && payload.mileage !== ''
        ? Number(payload.mileage)
        : null,
    color: payload.color,
    user_id: payload.user_id || payload.UserId || null,
    engineType: payload.engineType,
    transmission: payload.transmission,
    engineVolume: payload.engineVolume,
    photoUrl: payload.photoUrl
  };

  await requestJson(`/api/vehicles/${encodeURIComponent(vin)}`, {
    method: 'PUT',
    body
  });
}

export async function getById(id) {
  const payload = await requestJson(`/api/vehicles/${encodeURIComponent(id)}`);
  if (!payload) {
    throw new Error('Vehicle not found');
  }
  return mapVehicle(payload);
}

export async function create(payload, userId) {
  if (!userId) {
    throw new Error('User id is required to create vehicle');
  }

  const body = {
    user_id: userId,
    make: payload.make || payload.brand || '',
    model: payload.model || '',
    year:
      payload.year !== undefined && payload.year !== null && payload.year !== ''
        ? Number(payload.year)
        : null,
    vin: payload.vin || '',
    license_plate: payload.licensePlate || payload.license_plate || null,
    mileage:
      payload.mileage !== undefined && payload.mileage !== null && payload.mileage !== ''
        ? Number(payload.mileage)
        : null,
    color: payload.color || null,
    engineType: payload.engineType,
    transmission: payload.transmission,
    engineVolume: payload.engineVolume || payload.engineCapacity,
    photoUrl: payload.photoUrl
  };

  const created = await requestJson('/api/vehicles', {
    method: 'POST',
    body
  });

  if (created && created.id) {
    return created.id;
  }

  return null;
}

export async function attachServicedVehicles(vehicleIds) {
  const ids = Array.isArray(vehicleIds) ? vehicleIds : [];
  const normalized = ids.map((v) => (v == null ? '' : String(v).trim())).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error('vehicleIds is required');
  }
  return requestJson('/api/vehicles/serviced', {
    method: 'POST',
    body: { vehicle_ids: normalized }
  });
}

export async function remove(id) {
  await requestJson(`/api/vehicles/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
}

export async function lookupRegistryByLicensePlate(licensePlate) {
  if (!licensePlate) {
    throw new Error('License plate is required');
  }

  const token = localStorage.getItem('auth_token');
  const url = resolveUrl(
    `/api/vehicle-registry?license_plate=${encodeURIComponent(licensePlate)}`
  );
  const response = await fetch(url, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.message === 'string' && errorBody.message.trim()) {
        message = errorBody.message;
      }
    } catch (err) {
      void err;
    }
    throw new Error(message);
  }

  return response.json();
}

export async function getByLicensePlate(licensePlate, options = {}) {
  const plate = String(licensePlate || '').trim();
  if (!plate) throw new Error('License plate is required');

  const userId = typeof options?.userId === 'string' ? options.userId.trim() : '';
  const key = `${plate.toUpperCase()}|${userId || ''}`;
  if (vehicleByPlateCache.has(key)) {
    return vehicleByPlateCache.get(key);
  }

  const url = userId
    ? `/api/vehicles/license/${encodeURIComponent(plate)}?user_id=${encodeURIComponent(userId)}`
    : `/api/vehicles/license/${encodeURIComponent(plate)}`;

  const payload = await requestJson(url);
  const mapped = payload ? mapVehicle(payload) : null;
  if (mapped) {
    vehicleByPlateCache.set(key, mapped);
  }
  return mapped;
}

export async function uploadPhoto(file) {
  const token = localStorage.getItem('auth_token');
  const formData = new FormData();
  formData.append('photo', file);

  const response = await fetch(resolveUrl('/api/upload'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  });

  if (!response.ok) {
    let message = 'Photo upload failed';
    try {
      const errorBody = await response.json();
      if (errorBody && typeof errorBody.message === 'string' && errorBody.message.trim()) {
        message = errorBody.message;
      }
    } catch (err) {
      void err;
    }
    throw new Error(message);
  }

  return response.json();
}

const extractLicensePlateFromText = (text) => {
  const raw = String(text || '').toUpperCase();
  if (!raw) return '';

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
  };

  const normalized = raw
    .replace(/[АВЕИІКМНОРСТХУЙЗЧЇЄҐ]/g, (ch) => map[ch] || ch)
    .replace(/[^A-Z0-9 ]/g, '');
  const stripped = normalized.replace(/[^A-Z0-9]/g, '');
  if (stripped.length < 8) return '';

  const allowedLetters = new Set(['A', 'B', 'C', 'E', 'H', 'I', 'K', 'M', 'O', 'P', 'T', 'X', 'Y']);
  const uaPrefixes = new Set([
    'AA', 'AB', 'AC', 'AE', 'AH', 'AI', 'AK', 'AM', 'AO', 'AP', 'AT', 'AX',
    'BA', 'BB', 'BC', 'BE', 'BH', 'BI', 'BK', 'BM', 'BO', 'BP', 'BT', 'BX',
    'CA', 'CB', 'CC', 'CE', 'CH', 'CI', 'CK', 'CM', 'CO', 'CP', 'CT', 'CX',
    'EA', 'EB', 'EC', 'EE', 'EH', 'EI', 'EK', 'EM', 'EO', 'EP', 'ET', 'EX',
    'HA', 'HB', 'HC', 'HE', 'HH', 'HI', 'HK', 'HM', 'HO', 'HP', 'HT', 'HX',
    'IA', 'IB', 'IC', 'IE', 'IH', 'II', 'IK', 'IM', 'IO', 'IP', 'IT', 'IX',
    'KA', 'KB', 'KC', 'KE', 'KH', 'KI', 'KK', 'KM', 'KO', 'KP', 'KT', 'KX',
    'MA', 'MB', 'MC', 'ME', 'MH', 'MI', 'MK', 'MM', 'MO', 'MP', 'MT', 'MX',
    'OA', 'OB', 'OC', 'OE', 'OH', 'OI', 'OK', 'OM', 'OO', 'OP', 'OT', 'OX',
    'PA', 'PB', 'PC', 'PE', 'PH', 'PI', 'PK', 'PM', 'PO', 'PP', 'PT', 'PX'
  ]);

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
    if (ch === 'Z') return { ch: '2', cost: 1 };
    if (ch === 'S') return { ch: '5', cost: 1 };
    if (ch === 'B') return { ch: '8', cost: 1 };
    if (ch === 'G') return { ch: '6', cost: 2 };
    if (ch === 'Q') return { ch: '0', cost: 2 };
    if (ch === 'D') return { ch: '0', cost: 2 };
    return { ch, cost: 99 };
  };

  const fixPrefix = (a, b) => {
    const direct = `${a}${b}`;
    if (uaPrefixes.has(direct)) return { a, b, cost: 0 };
    const variants = [
      { a, b },
      { a: a === 'P' ? 'B' : a === 'B' ? 'P' : a, b },
      { a, b: b === 'P' ? 'B' : b === 'B' ? 'P' : b },
      { a: a === 'P' ? 'B' : a === 'B' ? 'P' : a, b: b === 'P' ? 'B' : b === 'B' ? 'P' : b }
    ];
    for (const v of variants) {
      const p = `${v.a}${v.b}`;
      if (uaPrefixes.has(p)) {
        return { a: v.a, b: v.b, cost: (v.a !== a ? 1 : 0) + (v.b !== b ? 1 : 0) };
      }
    }
    // Last-resort fallback: accept allowed-letter prefix with a penalty.
    if (allowedLetters.has(a) && allowedLetters.has(b)) {
      return { a, b, cost: 3 };
    }
    return null;
  };

  const scoreCandidate = (candidate) => {
    const s = candidate.split('');
    const a0 = fixLetter(s[0]);
    const a1 = fixLetter(s[1]);
    const a6 = fixLetter(s[6]);
    const a7 = fixLetter(s[7]);
    const d2 = fixDigit(s[2]);
    const d3 = fixDigit(s[3]);
    const d4 = fixDigit(s[4]);
    const d5 = fixDigit(s[5]);
    if ([a0, a1, a6, a7, d2, d3, d4, d5].some((x) => x.cost >= 99)) return null;
    const prefixFix = fixPrefix(a0.ch, a1.ch);
    if (!prefixFix) return null;
    const fixed = `${prefixFix.a}${prefixFix.b}${d2.ch}${d3.ch}${d4.ch}${d5.ch}${a6.ch}${a7.ch}`;
    if (!/^[A-Z]{2}\d{4}[A-Z]{2}$/.test(fixed)) return null;
    const cost =
      a0.cost + a1.cost + d2.cost + d3.cost + d4.cost + d5.cost + a6.cost + a7.cost + prefixFix.cost;
    return { fixed, cost };
  };

  let best = null;
  for (let i = 0; i <= stripped.length - 8; i += 1) {
    const scored = scoreCandidate(stripped.slice(i, i + 8));
    if (!scored) continue;
    if (!best || scored.cost < best.cost) {
      best = scored;
      if (best.cost === 0) break;
    }
  }

  if (!best) return '';
  return best.fixed;
};

export async function recognizeLicensePlateFromPhoto(file) {
  const token = localStorage.getItem('auth_token');
  const preparedFile = await prepareImageForOcr(file);
  const formData = new FormData();
  formData.append('image', preparedFile || file);

  const ocrDebug =
    typeof window !== 'undefined' &&
    (window.location?.search?.includes('ocrDebug=1') ||
      window.location?.hash?.includes('ocrDebug=1'));
  const url = ocrDebug ? resolveUrl('/api/ocr/plate?debug=1') : resolveUrl('/api/ocr/plate');
  const debugUrl = resolveUrl('/api/ocr/plate?debug=1');
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const timeoutMs = 30000;
  const warmupTimeoutMs = 50000;
  const startedAt = Date.now();

  const maxRetries = 4;
  let lastHttpBody = null;

  let response;
  await warmupApiConnection(4500);
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const attemptTimeoutMs = attempt >= 1 ? warmupTimeoutMs : timeoutMs;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), attemptTimeoutMs);
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) {
        try {
          lastHttpBody = await response.json();
        } catch (err) {
          void err;
          lastHttpBody = null;
        }

        const message = String(lastHttpBody?.message || lastHttpBody?.error || '').toLowerCase();
        const isWarmingUp = message.includes('warming up') || message.includes('warming');
        const isRetryableStatus = response.status === 503 || response.status === 504;
        const isRetryableMessage =
          message.includes('busy') ||
          message.includes('timeout') ||
          message.includes('warming') ||
          message.includes('preprocess');
        const isRetryable = isRetryableStatus && isRetryableMessage;

        if (isRetryable && attempt < maxRetries) {
          if (isWarmingUp) {
            await warmupApiConnection(4500);
            await sleep(2500 + attempt * 1500);
          } else {
            await sleep(700 + attempt * 900);
          }
          continue;
        }
      }

      break;
    } catch (err) {
      const errMsg = String(err?.message || err || '');
      const errMsgLower = errMsg.toLowerCase();
      const isNetworkError =
        err?.name === 'TypeError' ||
        errMsgLower.includes('failed to fetch') ||
        errMsgLower.includes('networkerror') ||
        errMsgLower.includes('network error') ||
        errMsgLower.includes('load failed');

      if (err?.name === 'AbortError') {
        if (attempt === 0 && maxRetries >= 1) {
          await warmupApiConnection(4500);
          await sleep(900);
          continue;
        }
        if (attempt < maxRetries) {
          await sleep(700 + attempt * 900);
          continue;
        }
        if (ocrDebug) {
          try {
            window.__OCR_DEBUG_PLATE__ = {
              clientError: 'OCR timeout',
              requestUrl: url,
              timeoutMs: attemptTimeoutMs,
              elapsedMs: Date.now() - startedAt,
            };
          } catch (debugErr) {
            void debugErr;
          }
        }
        throw new Error('OCR timeout');
      }

      if (isNetworkError) {
        if (attempt < maxRetries) {
          await warmupApiConnection(4500);
          await sleep(1200 + attempt * 1200);
          continue;
        }
        if (ocrDebug) {
          try {
            window.__OCR_DEBUG_PLATE__ = {
              clientError: errMsg,
              requestUrl: url,
              timeoutMs: attemptTimeoutMs,
              elapsedMs: Date.now() - startedAt,
              hint: 'network_error',
            };
          } catch (debugErr) {
            void debugErr;
          }
        }
        throw new Error('Failed to fetch');
      }

      if (ocrDebug) {
        try {
          window.__OCR_DEBUG_PLATE__ = {
            clientError: errMsg,
            requestUrl: url,
            elapsedMs: Date.now() - startedAt,
          };
        } catch (debugErr) {
          void debugErr;
        }
      }
      throw err;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  if (!response.ok) {
    let message = 'OCR plate failed';
    let debugBody = null;
    try {
      const body = lastHttpBody ?? (await response.json());
      debugBody = body;
      if (body && typeof body.message === 'string' && body.message.trim()) {
        message = body.message;
      } else if (body && typeof body.error === 'string' && body.error.trim()) {
        message = body.error;
      }
    } catch (err) {
      void err;
    }
    if (ocrDebug) {
      try {
        window.__OCR_DEBUG_PLATE__ = {
          httpError: message,
          status: response.status,
          requestUrl: url,
          elapsedMs: Date.now() - startedAt,
          body: debugBody,
        };
      } catch (debugErr) {
        void debugErr;
      }
    }
    throw new Error(message);
  }

  const payload = await response.json();
  if (ocrDebug) {
    try {
      window.__OCR_DEBUG_PLATE__ = payload;
    } catch (err) {
      void err;
    }
  }
  if (payload && typeof payload.licensePlate === 'string' && payload.licensePlate.trim()) {
    return payload.licensePlate.trim().toUpperCase();
  }
  if (payload && Array.isArray(payload.attempts) && payload.attempts.length > 0) {
    const candidates = [];
    for (const attempt of payload.attempts) {
      if (attempt?.plate) candidates.push(String(attempt.plate));
      if (attempt?.rawText) candidates.push(String(attempt.rawText));
    }
    for (const candidateRaw of candidates) {
      const candidate = extractLicensePlateFromText(candidateRaw);
      if (candidate) return candidate;
    }
  }
  if (payload && typeof payload.rawText === 'string' && payload.rawText.trim()) {
    const candidate = extractLicensePlateFromText(payload.rawText);
    return candidate || '';
  }

  // Last-resort fallback: force debug response and parse OCR attempts/raw text.
  try {
    const fallbackForm = new FormData();
    fallbackForm.append('image', preparedFile || file);
    const fallbackController = new AbortController();
    const fallbackTimeoutId = window.setTimeout(() => fallbackController.abort(), 55000);
    let fallbackResponse;
    try {
      fallbackResponse = await fetch(debugUrl, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: fallbackForm,
        signal: fallbackController.signal,
      });
    } finally {
      window.clearTimeout(fallbackTimeoutId);
    }
    if (fallbackResponse && fallbackResponse.ok) {
      const fallbackPayload = await fallbackResponse.json();
      if (
        fallbackPayload &&
        typeof fallbackPayload.licensePlate === 'string' &&
        fallbackPayload.licensePlate.trim()
      ) {
        return fallbackPayload.licensePlate.trim().toUpperCase();
      }
      if (fallbackPayload && Array.isArray(fallbackPayload.attempts)) {
        for (const attempt of fallbackPayload.attempts) {
          if (attempt?.plate) {
            const plate = extractLicensePlateFromText(String(attempt.plate));
            if (plate) return plate;
          }
          if (attempt?.rawText) {
            const plate = extractLicensePlateFromText(String(attempt.rawText));
            if (plate) return plate;
          }
        }
      }
      if (fallbackPayload && typeof fallbackPayload.rawText === 'string' && fallbackPayload.rawText.trim()) {
        const plate = extractLicensePlateFromText(fallbackPayload.rawText);
        if (plate) return plate;
      }
    }
  } catch (fallbackError) {
    void fallbackError;
  }

  return '';
}
