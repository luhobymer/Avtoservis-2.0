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
  const headers = options.headers || {};
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
  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const timeoutMs = 16000;
  const warmupTimeoutMs = 26000;
  const startedAt = Date.now();

  const maxRetries = 2;
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
  return payload?.licensePlate || '';
}
