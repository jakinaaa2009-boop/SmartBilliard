# Smart Billiard IoT Management System

Premium full-stack platform for a billiard club: QR start, QPay payment, ESP32 ball-box unlock, live session timers, ball-return protection, and an admin operations console.

## Stack

- Next.js 15, React, TypeScript, Tailwind CSS
- MongoDB + Mongoose
- JWT httpOnly cookies, role-based access (`CLIENT`, `ADMIN`)
- QPay Mongolia (real + mock)
- ESP32 command queue + heartbeat API
- Server-Sent Events + 5s background scheduler

## Quick start

```bash
docker compose up -d
cp .env.example .env.local
npm install
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seeded accounts (local only)

| Role | Login | Password |
| --- | --- | --- |
| Admin | `admin@smartbilliard.mn` | `Admin123!` |
| Client | `99111000` | `User123!` |

QR landing example: [http://localhost:3000/play/DEVICE-001](http://localhost:3000/play/DEVICE-001)

Device secrets are printed by `npm run seed`.

## Environment

Never commit production secrets. Required variables are in `.env.example`.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | Mongo connection |
| `JWT_SECRET` | Auth signing key |
| `MOCK_PAYMENT` | Simulated QPay (disabled in production) |
| `MOCK_IOT` | Simulated ESP32 (disabled in production) |
| `QPAY_USERNAME` / `QPAY_PASSWORD` / `QPAY_INVOICE_CODE` | Live QPay |

Mock modes **cannot run in production** (`NODE_ENV=production` ignores them).

## Customer flow

1. Scan table QR → `/play/DEVICE-00X`
2. Register / login (returns to the same table)
3. Choose a DB-backed time package
4. Pay with QPay QR
5. Backend verifies payment, creates one active session, sends `OPEN_BOX`
6. Relay stays on only for the configured duration, then `CLOSE_BOX`
7. Phone countdown uses `expiresAt` from the server
8. Extend time with another invoice on the same session
9. On expiry: return balls → complete, or missing balls → alarm + admin alert

The browser never unlocks a box. Only a backend-confirmed payment can queue `OPEN_BOX`.

## ESP32

- `firmware/esp32_main` — relay, buzzer, heartbeat, command poll
- `firmware/esp32_sensor` — ball-return count over ESP-NOW

Auth header:

```
Authorization: Bearer <device secret>
```

Poll: `GET /api/iot/devices/:deviceId/command`  
Heartbeat: `POST /api/iot/heartbeat`

## Admin

`/admin` — live tables, devices, users, sessions, payments, finance (revenue − expenses), alerts, reports (CSV/Excel), pricing, system settings.

Dangerous device commands and manual time changes require confirmation and are written to the audit log.
