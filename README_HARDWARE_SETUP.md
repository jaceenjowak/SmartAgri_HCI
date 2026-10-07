# SmartAgri hardware setup (Phase 4)

## Safety first
- Test with the pump disconnected from its power supply until the ESP32 relay state and water sensor polarity are verified.
- The relay and pump must use an appropriate external power supply and driver/relay module. Do not power a pump directly from an ESP32 GPIO.
- Firmware defaults to active-low relay and active-low water detection. Verify both against your actual modules.
- The firmware has a local no-water override and a communication fail-safe. Do not remove these safeguards.

## Backend setup
1. Use Node.js 18+.
2. In `backend`, copy `.env.example` to `.env` (or merge the new keys into your existing `.env`). Keep the existing real Supabase URL/key and a random JWT secret of at least 32 characters.
3. Set `ENABLE_SIMULATION=false` for hardware mode.
4. Set `IOT_DEVICE_ID=smartagri-esp32-001` (or the ID in firmware), `IOT_DEVICE_KEY` to a random secret of at least 32 characters, and `IOT_USER_ID` to the `public.users.id` for the account that owns the device.
5. Ensure the SQL migration in `backend/migrations/001_smartagri_supabase.sql` has been applied in Supabase. The configured account must have rows in `thresholds` and `pump_state`.
6. Run `npm install`, then `npm test`, then `npm start` from `backend`.
7. Check `http://localhost:5000/api/health`. It should report `mode: "hardware"`, `simulation: false`, and `iot_configured: true`.

## ESP32 setup
1. Open `firmware/SmartAgri_Phase4_ESP32_IoT.ino` in Arduino IDE and install ESP32 board support plus ArduinoJson.
2. Set `WIFI_SSID` and `WIFI_PASSWORD` to the same Wi-Fi network as the PC. Use the PC's LAN IPv4 address in `SERVER_BASE_URL`, for example `http://192.168.1.15:5000`; do not use `localhost`.
3. Set `DEVICE_ID` and `DEVICE_KEY` to exactly match backend `.env` values.
4. Verify pins: soil analog output GPIO 34, water digital output GPIO 27, relay input GPIO 26. Calibrate `SOIL_DRY_RAW` and `SOIL_WET_RAW` using actual sensor measurements.
5. Confirm Windows Firewall allows inbound Node.js traffic on the private network.
6. Upload and open Serial Monitor at 115200 baud. Check health request, sensor HTTP 201, pump-command HTTP 200, and status HTTP 200.
7. With the pump still disconnected, verify the dashboard displays source `esp32`, changing moisture, water status, and desired pump command. Test no-water behavior and network-loss fail-safe before connecting the pump.
8. Only connect the pump after relay polarity, power, tubing, water supply, and fail-safe behavior have been verified physically.

## Mode behavior
- `ENABLE_SIMULATION=true`: the dashboard's simulated reading form is available. The relay is not controlled.
- `ENABLE_SIMULATION=false`: simulated reading submissions are rejected; the ESP32 device API is enabled and manual pump actions become desired commands that the ESP32 polls every two seconds.

## Known physical calibration requirements
No source code can guarantee correct moisture percentages, water-detection polarity, relay polarity, Wi-Fi reachability, or pump wiring without your actual hardware measurements. Treat calibration constants and pin assignments as starting values and verify before operating a live pump.
