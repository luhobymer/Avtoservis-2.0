# WEB Audit: 2B (features) then 2C (integrations)

Date: 2026-04-13
Scope: web only (client + server)

---

## 0) Executive summary

This audit lists unfinished / inconsistent / risky areas that affect feature completeness (priority 2B) and then integrations (priority 2C). Each item includes a short impact statement and a concrete code location.

---

## 1) Priority 2B — Core product features / business flows

### 1.1 Users / roles / admin panel

- [HIGH] Admin panel does not expose all existing admin tools
  - Impact: master admin cannot reach some management screens from UI.
  - Client:
    - `client/src/pages/AdminPanel.jsx`
    - Available components (exist, but not mounted in tabs):
      - `client/src/components/admin/ServicesManagement.jsx`
      - `client/src/components/admin/InsuranceManagement.jsx`
    - Mounted tabs now: Dashboard/Users/Vehicles/Appointments/ServiceRecords/Parts.

- [MEDIUM] Role model naming inconsistencies (`master`, `admin`, `mechanic`)
  - Impact: some endpoints allow/deny based on different role sets.
  - Server examples:
    - `server/routes/mechanics.js` uses `['master','mechanic','admin']` in `ensurePrivileged`
    - `server/routes/services.js` and `server/routes/parts.js` use `checkAdmin`
    - `server/routes/serviceCategories.js` allows `master/mechanic` for create (no `checkAdmin`).

### 1.2 Client–master relationships

- [HIGH] MyClients creates a user with a hardcoded password
  - Impact: security + broken onboarding expectations.
  - Client:
    - `client/src/pages/MyClients.jsx` → `createClientWithRelationship()` uses `password: '12345678'`.

- [MEDIUM] MyMechanics page uses inline “Mock API calls” instead of DAO
  - Impact: duplicated request/refresh logic; harder to maintain.
  - Client:
    - `client/src/pages/MyMechanics.jsx`
  - Server endpoints exist:
    - `server/routes/relationships.js`
    - `server/controllers/relationshipController.js`

### 1.3 Appointments (multi-service, ownership, consistency)

- [MEDIUM] Appointment model uses both `service_id` and `service_ids`
  - Impact: risk of partial updates / UI confusion.
  - Server:
    - `server/routes/appointments.js` handles both.
    - `server/controllers/appointmentController.js` normalizes and builds `services_list`.

- [MEDIUM] Appointment “assigned mechanic” vs “owner” rules differ by endpoint
  - Impact: users may be able to view/update in one flow but not another.
  - Server:
    - `server/routes/appointments.js` update checks only `isMaster` or `isOwner`.
    - `server/controllers/vehiclePartsController.js` appointment parts allow `isOwner` OR `isAssignedMechanic` OR privileged.

### 1.4 Services / mechanic services

- [LOW] Service categories creation uses custom role check, while global services use `checkAdmin`
  - Impact: policy inconsistency.
  - Server:
    - `server/routes/serviceCategories.js` (`master/mechanic`)
    - `server/routes/services.js` (`checkAdmin`)

### 1.5 Parts catalog vs vehicle parts history

- [MEDIUM] Two separate concepts are implemented, but UI naming may confuse
  - Impact: users may not understand difference between:
    - global catalog (`parts` table, admin only)
    - per-vehicle history (`vehicle_parts` table)
  - Server:
    - `server/routes/parts.js` + `server/controllers/partsController.js`
    - `server/routes/vehicleParts.js` + `server/controllers/vehiclePartsController.js`
  - Client:
    - `client/src/pages/MyParts.jsx` uses vehicle parts + OCR import.

### 1.6 OCR for parts + plate

- [HIGH] OCR debug endpoint is exposed without auth
  - Impact: anyone can upload files and execute OCR.
  - Server:
    - `server/routes/ocr.js` → `POST /api/ocr/plate-debug` (no `auth`).

---

## 2) Priority 2C — Integrations (web push, reminders, Telegram/Viber)

### 2.1 Web Push (PWA)

- [OK] Service worker handles `push` and `notificationclick`
  - Client:
    - `client/src/sw.js`

- [OK] Client has UI to enable/disable/test web push
  - Client:
    - `client/src/pages/Profile.jsx`
    - `client/src/api/dao/webPushDao.js`

- [OK] Server has VAPID + subscription store + test send
  - Server:
    - `server/routes/webPush.js`
    - `server/services/webPushService.js`
  - Requires env:
    - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, optional `VAPID_SUBJECT`.

- [MEDIUM] No unified “notifications settings” enforcement
  - Impact: user can disable notifications in UI settings, but server-side send does not check those settings before sending.
  - Related:
    - `client/src/pages/Profile.jsx` uses `userSettingsDao` and stores settings
    - `server/services/reminderScheduler.js` sends push/webpush based on due reminders without checking per-user settings.

### 2.2 Reminders scheduler / monthly mileage requests / planned maintenance

- [OK] Scheduler exists and can run via cron
  - Server:
    - `server/services/reminderScheduler.js`
    - Enabled only when `SCHEDULER_ENABLED=true` (`server/index.js`).

- [MEDIUM] “Enable/disable reminder” toggle is local-only
  - Impact: toggle in UI does not affect backend sending (it stores in `localStorage`).
  - Client:
    - `client/src/pages/Reminders.jsx` → `reminder_enabled_${id}` in localStorage.

- [MEDIUM] Reminder check endpoints are still available as manual triggers
  - Impact: can be abused if API key leaks; also duplicates scheduler responsibility.
  - Server:
    - `server/routes/reminders.js`:
      - `POST /api/reminders/run-check` (API key)
      - `POST /api/reminders/run-check-auth` (auth)

- [OPEN] “Monthly mileage request” and “planned maintenance reminders” are not clearly implemented as separate flows
  - Found: generic reminders + notifications.
  - Not found (in web scope): explicit monthly mileage request scheduler + UI flow for answering mileage.

### 2.3 Telegram

- [OK] Server-side Telegram API routes exist (protected by API key)
  - Server:
    - `server/routes/telegram.js` uses `server/middleware/apiKey.js` and then `auth` on selected routes.
    - `server/controllers/telegramController.js`

- [NOTE] There is a separate `telegram-bot/` folder
  - This is outside web client/server scope, but is part of the repo and likely used for the actual bot runtime.

### 2.4 Viber

- [GAP] No Viber integration found in web client/server code
  - Searches for `viber` in `server/**/*.js` and `client/src/**/*` returned no matches.

---

## 3) Quick recommendations (ordered)

1. Remove or protect OCR debug endpoint
   - `server/routes/ocr.js` (`/plate-debug`).

2. Replace hardcoded client password flow
   - `client/src/pages/MyClients.jsx`.

3. Add missing AdminPanel tabs (Services + Insurance) or remove unused components
   - `client/src/pages/AdminPanel.jsx`.

4. Make reminder enable/disable server-driven (persist to DB) or remove toggle
   - `client/src/pages/Reminders.jsx` + server scheduler.

5. Decide and implement Viber integration or remove from roadmap for now.

---

## 4) Files referenced

Server:
- `server/index.js`
- `server/routes/admin.js`
- `server/routes/appointments.js`
- `server/controllers/appointmentController.js`
- `server/routes/relationships.js`
- `server/controllers/relationshipController.js`
- `server/routes/reminders.js`
- `server/services/reminderScheduler.js`
- `server/routes/webPush.js`
- `server/services/webPushService.js`
- `server/routes/telegram.js`
- `server/controllers/telegramController.js`
- `server/routes/ocr.js`
- `server/routes/vehicleParts.js`
- `server/controllers/vehiclePartsController.js`

Client:
- `client/src/pages/AdminPanel.jsx`
- `client/src/components/admin/ServicesManagement.jsx`
- `client/src/components/admin/InsuranceManagement.jsx`
- `client/src/pages/MyClients.jsx`
- `client/src/pages/MyMechanics.jsx`
- `client/src/pages/Profile.jsx`
- `client/src/pages/Reminders.jsx`
- `client/src/pages/Notifications.jsx`
- `client/src/components/NotificationBell.jsx`
- `client/src/sw.js`
- `client/src/api/dao/notificationsDao.js`
- `client/src/api/dao/webPushDao.js`
