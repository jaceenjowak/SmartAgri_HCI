# SmartAgri API route contract

All browser routes below are prefixed by `/api` and require `Authorization: Bearer <JWT>` unless marked public. The ESP32 routes use `X-Device-Id` and `X-Device-Key` and do not accept user JWTs.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | public | Backend + Supabase health and active mode |
| POST | `/auth/register` | public | Create farmer account |
| POST | `/auth/login` | public | Login |
| GET | `/auth/me` | user JWT | Current account |
| GET | `/sensor/latest` | user JWT | Latest reading and pump state |
| GET | `/sensor/history?limit=20` | user JWT | Sensor history |
| GET | `/sensor/all` | admin JWT | All sensor readings |
| POST | `/sensor/simulate` | user JWT, simulation mode | Insert test reading |
| POST | `/sensor/reading` | user JWT, retired | Returns 410; use device endpoint for hardware |
| POST | `/irrigation/control` | user JWT | Set desired pump state (physical device polls in hardware mode) |
| GET | `/irrigation/pump-status` | user JWT | Current pump state and last sensor timestamp |
| GET | `/irrigation/logs?limit=50` | user JWT | Irrigation logs |
| GET | `/notifications` | user JWT | Latest 50 notifications |
| GET | `/notifications/unread-count` | user JWT | Unread count |
| PATCH | `/notifications/:id/read` | user JWT | Mark one notification read |
| PATCH | `/notifications/read-all` | user JWT | Mark all notifications read |
| GET | `/thresholds` | user JWT | Current user's thresholds |
| PUT | `/thresholds` | user JWT | Update thresholds |
| POST | `/iot/reading` | device key | Submit ESP32 reading; auto-irrigation decision |
| GET | `/iot/pump-command` | device key | Poll desired pump state |
| POST | `/iot/pump-status` | device key | Report physical pump state |

`/api/iot/*` is a device API. Do not expose `IOT_DEVICE_KEY` in React, source control, or public screenshots. The service-role Supabase key belongs only in `backend/.env`.
