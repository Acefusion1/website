import json, wave, numpy as np

SR = 44100; DUR = 120.0
N = int(SR * DUR)
L = np.zeros(N); Rc = np.zeros(N)
rng = np.random.default_rng(3)
ev = json.load(open('events.json'))
SLOW = ev['slow']; FIN = ev['finish']
BPM = 150; BEAT = 60 / BPM; BAR = 4 * BEAT; E8 = BEAT / 2

def in_slow(t): return any(a - 0.05 <= t < b for a, b in SLOW)
def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)

def add(t0, sig, gain=1.0, pan=0.0):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0: return
    if i < 0: sig = sig[-i:]; i = 0
    sig = sig[:N - i] * gain
    L[i:i + len(sig)] += sig * (1 - pan) ; Rc[i:i + len(sig)] += sig * (1 + pan)

def env(n, a=0.005, d=0.1, s=0.6, r=0.1, dur=None):
    t = np.arange(n) / SR; dur = dur if dur is not None else n / SR - r
    e = np.where(t < a, t / a, np.where(t < a + d, 1 - (1 - s) * (t - a) / d, s))
    rel = np.clip((t - dur) / r, 0, 1); return e * (1 - rel)

def saw(f, n, harm=10, det=0.0):
    t = np.arange(n) / SR; out = np.zeros(n)
    for k in range(1, harm + 1):
        if f * k > 12000: break
        out += np.sin(2 * np.pi * f * k * t * (1 + det)) / k
    return out
def square(f, n, vib=0.0):
    t = np.arange(n) / SR; ph = 2 * np.pi * f * t + vib * np.sin(2 * np.pi * 5.5 * t) * np.clip(t / 0.3, 0, 1)
    return sum(np.sin(k * ph) / k for k in (1, 3, 5, 7))
def noise(n): return rng.standard_normal(n)
def band(sig, lo, hi):
    S = np.fft.rfft(sig); fr = np.fft.rfftfreq(len(sig), 1 / SR)
    S *= ((fr >= lo) & (fr <= hi)); return np.fft.irfft(S, len(sig))

# --- instruments
def pad(t0, notes, dur, gain=0.05):
    n = int((dur + 0.6) * SR)
    for m in notes:
        for d, p in ((-0.004, -0.5), (0.004, 0.5), (0.0, 0)):
            add(t0, saw(mtof(m), n, 6, d) * env(n, 0.25, 0.3, 0.8, 0.6, dur), gain, p)
def stab(t0, notes, gain=0.035):
    n = int(0.22 * SR)
    for m in notes: add(t0, saw(mtof(m), n, 8) * env(n, 0.003, 0.15, 0.0, 0.05), gain, 0.3)
def bass(t0, m, dur, gain=0.16):
    n = int(dur * SR); add(t0, saw(mtof(m), n, 6) * env(n, 0.004, 0.08, 0.7, 0.03), gain)
def lead(t0, m, dur, gain=0.07):
    n = int((dur + 0.05) * SR); add(t0, square(mtof(m), n, 0.012 * 2 * np.pi) * env(n, 0.01, 0.1, 0.75, 0.05, dur), gain, -0.15)
def bell(t0, m, gain=0.06):
    n = int(1.2 * SR); t = np.arange(n) / SR; f = mtof(m)
    add(t0, (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6)) * np.exp(-t * 3.5), gain, 0.4)
def kick(t0, gain=0.5):
    n = int(0.3 * SR); t = np.arange(n) / SR
    f = 50 + 120 * np.exp(-t * 30); add(t0, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9), gain)
def snare(t0, gain=0.22):
    n = int(0.22 * SR); t = np.arange(n) / SR
    add(t0, (band(noise(n), 1500, 9000) * 0.9 + 0.5 * np.sin(2 * np.pi * 190 * t)) * np.exp(-t * 18), gain)
HAT = band(noise(int(0.08 * SR)), 7000, 16000)
OHAT = band(noise(int(0.3 * SR)), 6000, 16000)
def hat(t0, gain=0.06, open_=False):
    h = OHAT if open_ else HAT; t = np.arange(len(h)) / SR
    add(t0, h * np.exp(-t * (12 if open_ else 50)), gain, 0.5)
def crash(t0, gain=0.25):
    n = int(2.5 * SR); t = np.arange(n) / SR; add(t0, band(noise(n), 3000, 16000) * np.exp(-t * 1.6), gain, -0.2)
def whoosh(t0, dur, lo, hi, gain):
    n = int(dur * SR); t = np.arange(n) / SR
    e = np.sin(np.pi * t / dur) ** 2
    add(t0 - dur * 0.4, band(noise(n), lo, hi) * e, gain)
def thud(t0, gain=0.25):
    n = int(0.25 * SR); t = np.arange(n) / SR
    add(t0, (np.sin(2 * np.pi * 70 * t) + 0.3 * band(noise(n), 100, 900)) * np.exp(-t * 16), gain)
def crowd(t0, dur, gain):
    n = int(dur * SR); t = np.arange(n) / SR
    c = sum(band(noise(n), 300 + 250 * k, 900 + 400 * k) * (0.6 + 0.4 * np.sin(2 * np.pi * (0.3 + 0.13 * k) * t + k)) for k in range(4))
    e = np.clip(t / 0.4, 0, 1) * np.clip((dur - t) / 1.5, 0, 1)
    add(t0, c * e, gain, 0.0)

# chord progression: IV - V - iii - vi in C (the anime "royal road")
CHORDS = [(53, [65, 69, 72, 76]), (55, [67, 71, 74, 77]), (52, [64, 67, 71, 74]), (57, [69, 72, 76, 79])]
MEL = [
    [69, '-', 72, '-', 71, 72, 74, '-'], [74, '-', 76, '-', 74, 72, 71, 67],
    [71, '-', 72, 74, 76, '-', 79, '-'], [76, '-', '-', 74, 72, '-', '-', None],
    [69, 72, 77, '-', 76, 74, 72, '-'], [74, '-', 71, '-', 67, '-', 71, 74],
    [76, 74, 72, 71, 72, '-', 74, '-'], [72, '-', '-', '-', '-', '-', None, None],
]

# --- intro (0 - 9)
for i in range(5):
    root, ch = CHORDS[i % 4]; t0 = 0.3 + i * BAR
    pad(t0, ch, BAR, 0.035)
    for k in range(8):
        if t0 + k * E8 < 8.8: bell(t0 + k * E8, ch[k % 4] + 12, 0.03)
bell(7.35, 96, 0.07); bell(7.45, 100, 0.06); bell(7.55, 103, 0.06)  # eye sparkle
for k in range(16): snare(8.2 + k * 0.05, 0.05 + 0.15 * k / 16)
crash(9.0, 0.3); kick(9.0, 0.6)
crowd(0.0, 12.5, 0.02)

# --- main groove (9 - finish)
bar_i = 0; t = 9.0
while t < FIN - 0.01:
    root, ch = CHORDS[bar_i % 4]; mel = MEL[bar_i % 8]
    slow_bar = in_slow(t) or in_slow(t + BAR * 0.5)
    if slow_bar:
        pad(t, [c - 12 for c in ch[:3]], BAR, 0.04)
        for b in range(2): kick(t + b * BEAT * 2, 0.35); kick(t + b * BEAT * 2 + 0.22, 0.2)  # heartbeat
    else:
        pad(t, ch, BAR, 0.022)
        for k in range(8):
            tt = t + k * E8
            if tt >= FIN: break
            bass(tt, root - 12 + (12 if k % 2 else 0), E8 * 0.9)
            if k % 2: stab(tt, ch[:3]); hat(tt, 0.05, open_=True)
            else: hat(tt, 0.06)
            if k in (0, 4, 5): kick(tt)
            if k in (2, 6): snare(tt)
        if bar_i >= 4:  # melody enters after 4 bars
            k = 0
            while k < 8:
                m = mel[k]
                if isinstance(m, int):
                    ln = 1
                    while k + ln < 8 and mel[k + ln] == '-': ln += 1
                    if t + k * E8 < FIN: lead(t + k * E8, m, ln * E8 * 0.92)
                    k += ln
                else: k += 1
    t += BAR; bar_i += 1

# --- jump whooshes
for tj, tl in zip(ev['jumps'], ev['lands']):
    if tj > FIN: continue
    if in_slow(tj) or in_slow(tl):
        whoosh(tj + (tl - tj) * 0.3, max(1.2, (tl - tj) * 0.9), 200, 1500, 0.22); thud(tl, 0.35)
    else:
        whoosh(tj + 0.15, 0.45, 800, 5000, 0.12); thud(tl, 0.18)

# --- finish fanfare
crash(FIN, 0.4); kick(FIN, 0.7)
crowd(FIN - 3, 120 - FIN + 3, 0.06)
fan = [(0, 67, 0.25), (0.25, 72, 0.25), (0.5, 76, 0.25), (0.75, 79, 1.0), (1.9, 77, 0.25), (2.15, 79, 0.25), (2.4, 84, 2.6)]
for dt, m, ln in fan:
    lead(FIN + 0.2 + dt, m, ln, 0.08); lead(FIN + 0.2 + dt, m - 12, ln, 0.04)
pad(FIN + 0.2, [60, 64, 67, 72], 4.5, 0.04)
pad(FIN + 4.7, [65, 69, 72, 77], 1.6, 0.035); pad(FIN + 6.3, [60, 64, 67, 72, 76], 3.0, 0.04)
for k in range(12): bell(FIN + 4.7 + k * E8, [72, 76, 79, 84][k % 4], 0.03)

# --- master
mix = np.stack([L, Rc], 1)
fade = np.ones(N); fi = int(118.6 * SR); fade[fi:] = np.linspace(1, 0, N - fi); mix *= fade[:, None]
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 0.9 / np.max(np.abs(mix))
w = wave.open('music.wav', 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((mix * 32767).astype(np.int16).tobytes()); w.close()
print('ok', FIN)
