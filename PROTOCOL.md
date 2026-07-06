# How the PC-60FW oximeter sends data — a plain-language guide

> Everything you need to know about the PC-60FW's Bluetooth communication,
> explained from scratch. Sources at the end.

---

## 1. The big picture (in 30 seconds)

The oximeter **doesn't wait for anyone to ask anything**. As soon as you put
your finger on it, it turns on and starts **transmitting on its own**, several
times per second, small packets of bytes over Bluetooth Low Energy (BLE). Your
app's job is just to:

1. **Connect** to the device;
2. **Subscribe to notifications** (say "let me know when new data arrives");
3. **Interpret the bytes** that arrive.

You don't need to send any command to receive SpO₂, pulse and waveform —
it's all "free", pushed by the device.

---

## 2. Where the data flows through (the "channel")

BLE organizes everything into **services** and **characteristics** (think
"folders" and "files"). The PC-60FW uses a generic serial-port service called
**Nordic UART Service (NUS)**:

| What | UUID | Role |
|------|------|------|
| Service | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | The "folder" where everything lives |
| **Notify** characteristic (your app's RX) | `6e400003-...` | The oximeter **sends** data to you here |
| **Write** characteristic (your app's TX) | `6e400002-...` | You would **send** commands here (not needed to read vitals) |

Your `index.html` only uses the notify one — and that's enough.

---

## 3. What are those hexadecimal numbers?

Everything sent over Bluetooth is **bytes** — numbers from 0 to 255.
Hexadecimal is just a compact way to write those numbers, using base 16:

- `0x61` in hex = **97** in decimal → an SpO₂ of 97%
- `0x48` = **72** → a pulse of 72 bpm
- `0xAA` = 170, `0x55` = 85 → used as the "signature" marking the start of a packet

So when the page log shows `aa 55 0f 08 01 61 48 ...`, that's a sequence of
numbers. The "secret" of the protocol is knowing **which position means
what** — and that's what the community figured out through reverse
engineering.

---

## 4. Anatomy of a packet (frame)

Every PC-60FW packet follows this template:

```
AA 55 | TT | LL | FF | data... | CS
```

| Field | Meaning |
|-------|---------|
| `AA 55` | **Start of packet.** Always these 2 bytes — used to find where a frame begins in the middle of the stream. |
| `TT` | **Token/category:** `0x0F` = measurement data · `0xF0` = device data (battery, status) |
| `LL` | **Length:** how many bytes still follow after this field |
| `FF` | **Function/type:** indicates what the content is (`0x01` vitals, `0x02` waveform, etc.) |
| `data...` | The content itself |
| `CS` | **Checksum** (CRC-8 Maxim): a verification byte to detect corrupted data |

---

## 5. The packets that arrive, one by one

### 5.1 Vitals — SpO₂, pulse and perfusion 🩸

**Arrives ~once per second** while the finger is on the device.

```
AA 55 0F 08 01 [SpO2] [Pulse] ?? [PI] 00 C0 [CS]
position: 0  1  2  3  4    5       6    7   8   9 10   11
```

| Byte | What | How to interpret |
|------|------|-------------------|
| 5 | SpO₂ | Direct value in % (e.g. `0x61` = 97%) |
| 6 | Pulse | Direct value in bpm (e.g. `0x48` = 72) |
| 8 | Perfusion index (PI) | Divide by 10 (e.g. `0x2D` = 45 → PI 4.5) |

> While the device is still "searching" for the signal, it may send 0 or
> invalid values — that's why the app ignores SpO₂ outside 1–100.

### 5.2 Plethysmographic waveform (the pulse "wave") 📈

**Arrives ~12 times per second, with 5 samples each** → **~60 samples/second**
in total. It's the most frequent packet of all.

```
AA 55 0F 07 02 [a1] [a2] [a3] [a4] [a5] [CS]
position: 0  1  2  3  4   5    6    7    8    9   10
```

Each sample (`a1`…`a5`) is a byte where:

- **bits 0–6** (value 0–127): the **amplitude** of the wave at that instant;
- **bit 7** (when the byte is ≥ 128, i.e. ≥ `0x80`): a **beat detected**
  marker — the device itself "stamps" the sample right after the peak of
  each pulse.

To read the amplitude while ignoring the marker: `value & 0x7F`.

> ⚠️ The current `index.html` only reads **the first sample** of each
> packet — the displayed waveform has 1/5 of the real resolution. Fixing
> this is the most valuable upgrade.

### 5.3 Battery 🔋

**Arrives every now and then** (no guaranteed fixed period).

```
AA 55 F0 03 03 [level] [CS]
```

The level byte ranges from **0 to 3**: 0 ≈ empty, 3 ≈ full. Same scale as
the little bars on the device's display — there's no exact percentage.

### 5.4 Still-mysterious packets ❓

- Type `0x21` (within `0x0F`): known structure, unknown meaning —
  suspected to be finger/measurement status.
- A short "heartbeat" packet with token `0xF0`: the device saying "I'm
  alive"; can be ignored.

Your page's hex log exists precisely to capture these — if something odd
shows up there, it's one of these packets waiting to be decoded.

---

## 6. Important detail: packets arrive "chopped up"

BLE delivers data in **chunks** that **don't respect** packet boundaries.
A single notification can bring:

- half a packet (the rest comes in the next one);
- a packet and a half;
- several packets glued together.

That's why the code keeps a **buffer**: it accumulates everything that
arrives, looks for `AA 55`, reads the length field, and only processes a
packet once it's complete. Never assume "1 notification = 1 packet".

---

## 7. Timeline of a typical session

```
You put your finger on
   └─ oximeter turns on and starts advertising
        └─ app connects and subscribes to notifications
             ├─ waveform: ~12 packets/s (5 samples each, ~60 Hz)
             ├─ vitals: ~1 packet/s (SpO₂, pulse, PI)
             └─ battery/status: sporadic
You remove your finger
   └─ after a few seconds the oximeter turns OFF by itself
        └─ the connection drops (this is NORMAL, not a bug)
             └─ the app waits and reconnects once the finger is back
```

---

## 8. Rules of the game (limitations worth knowing)

- **1 connection at a time.** If the ViHealth app is connected, your page
  can't see the device (and vice versa). While connected, it also
  disappears from any BLE scanner.
- **Only transmits while measuring.** No finger = off = invisible over
  Bluetooth.
- **No memory.** The device doesn't keep history accessible over BLE —
  whatever your app doesn't record on the spot is lost.
- **Doesn't send raw sensor data.** SpO₂/pulse/PI values already come
  calculated by the device's chip; there's no access to the raw
  red/infrared LED signals.
- **"Warm-up" values.** In the first few seconds the numbers may come
  in as zero or unstable until the device locks onto the signal.

---

## 9. What you can build with this data

| Available data | What it enables |
|-----------------|---------------|
| SpO₂ + pulse at 1 Hz | History, trend charts, CSV export, alerts (e.g. SpO₂ < 90%) |
| Waveform at ~60 Hz | Nice, faithful wave, experimental respiratory rate estimation |
| Beat marker (bit 7) | Inter-beat intervals → pulse variability, irregular rhythm detection |
| Derived statistics | Session min/avg/max, time below 90%, desaturation count |

---

## Sources

- [afibTuner](https://github.com/johnreine/afibTuner) — detailed the waveform packets (5 samples + beat bit)
- [sza2/viatom_pc60fw](https://github.com/sza2/viatom_pc60fw) — frame structure and CRC-8 checksum
- [anaesthetics.app](https://anaesthetics.app/blog/posts/2020/bluetooth/) — first published reverse engineering with Web Bluetooth
- [ESPHome / Home Assistant thread](https://community.home-assistant.io/t/esphome-config-to-read-from-pc-60fw-bluetooth-pulse-oximeter-and-display-locally/884140) — independent confirmation of vitals and battery

> ⚠️ Protocol mapped by the community, with no official documentation from the manufacturer.
> Educational/personal use — not validated for clinical use.
