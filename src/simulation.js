// ============================================================
// SafeSense VR — منطق المحاكاة: الإنذار، الطوارئ، المساعدة، الصوت
// ============================================================
import { WORLD } from './scene.js'

// ---------- مدير الصوت: mp3 إن وُجد، وإلا WebAudio fallback ----------
export class AudioManager {
  constructor() {
    this.ctx = null
    this.alarmNodes = null
    this.alarmGain = null
    this.volume = 1
    this.enabled = true
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      if (!AC) return null
      this.ctx = new AC()
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {})
    return this.ctx
  }

  // صفارة إنذار مولّدة (تناوب تردد) — fallback عند غياب mp3
  startAlarm() {
    if (this.alarmNodes) return
    const ctx = this._ensureCtx()
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 660
    gain.gain.value = 0.06 * this.volume
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 1.6
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 220
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(); lfo.start()
    this.alarmNodes = { osc, lfo }
    this.alarmGain = gain
    // محاولة تشغيل ملف mp3 فوقه إن وُجد (لا يتعطل إن غاب)
    this._tryMp3('/assets/audio/fire-alarm.mp3', true)
  }

  _tryMp3(src, loop) {
    try {
      const a = new Audio(src)
      a.loop = loop
      a.volume = 0.5 * this.volume
      a.play().catch(() => { /* الملف غير موجود — نكتفي بالـ fallback */ })
      if (src.includes('fire-alarm')) this._mp3Alarm = a
    } catch { /* تجاهل */ }
  }

  setAlarmVolume(v) {
    this.volume = v
    if (this.alarmGain) this.alarmGain.gain.value = 0.06 * v
    if (this._mp3Alarm) this._mp3Alarm.volume = 0.5 * v
  }

  stopAlarm() {
    try { this.alarmNodes?.osc?.stop(); this.alarmNodes?.lfo?.stop() } catch {}
    this.alarmNodes = null
    this.alarmGain = null
    try { this._mp3Alarm?.pause() } catch {}
    this._mp3Alarm = null
  }

  playSuccess() {
    const ctx = this._ensureCtx()
    this._tryMp3('/assets/audio/success.mp3', false)
    if (!ctx) return
    try {
      const notes = [523, 659, 784, 1047]
      notes.forEach((f, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'sine'; o.frequency.value = f
        const t = ctx.currentTime + i * 0.14
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.03)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
        o.connect(g); g.connect(ctx.destination)
        o.start(t); o.stop(t + 0.4)
      })
    } catch {}
  }

  beep(freq = 880, dur = 0.15) {
    const ctx = this._ensureCtx()
    if (!ctx) return
    try {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'; o.frequency.value = freq
      g.gain.value = 0.12
      o.connect(g); g.connect(ctx.destination)
      o.start(); o.stop(ctx.currentTime + dur)
    } catch {}
  }
}

// ---------- توجيه صوتي (Web Speech API) مع fallback نصي ----------
export function speak(text, userType) {
  // يُستخدم أساسًا لضعف البصر، ومتاح للجميع
  try {
    if (!('speechSynthesis' in window)) return false
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ar-SA'
    u.rate = userType === 'learning' ? 0.85 : 1
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

// ---------- رسائل المساعدة حسب نوع المستخدم ----------
export function helpContent(userType, scenario) {
  const exitName = scenario.correctExit === 'main' ? 'المخرج الرئيسي (شرق)' : 'المخرج البديل (غرب)'
  switch (userType) {
    case 'visual':
      return {
        title: 'توجيه صوتي 🗣️',
        text: `استمر بالتقدم. ${exitName}. اتبع صوت الإنذار والأسهم الصفراء اللامعة.`,
        speak: `انتبه. اتجه نحو ${exitName} ثم إلى منطقة التجمع.`,
      }
    case 'hearing':
      return {
        title: 'تنبيه بصري ⚠️',
        text: `⬆️ اتبع الأسهم الخضراء الكبيرة نحو ${exitName} ثم إلى منطقة التجمع!`,
        flash: true,
      }
    case 'motor':
      return {
        title: 'مسار ميسّر ♿',
        text: `الممر أمامك واسع وخالٍ من العوائق. تقدم بهدوء نحو ${exitName}. يمكنك إبطاء السرعة من الأسفل.`,
      }
    case 'learning':
      return {
        title: 'خطوة واحدة 🙂',
        text: `اخرج من الفصل.`,
        steps: ['اخرج من الفصل', 'اتبع الأسهم', 'اذهب إلى منطقة التجمع'],
      }
    default:
      return {
        title: 'مساعدة 💡',
        text: `اتبع الأسهم نحو ${exitName} ثم واصل إلى منطقة التجمع خارج المدرسة.`,
      }
  }
}

export function instructionFor(userType, scenario, phase) {
  const exitName = scenario.correctExit === 'main' ? 'المخرج الرئيسي' : 'المخرج البديل'
  if (userType === 'learning') {
    if (phase === 'pre') return 'اجلس. انتظر.'
    if (phase === 'go-class') return 'اخرج من الفصل.'
    return 'اتبع الأسهم.'
  }
  if (phase === 'pre') return 'أنت داخل الفصل. انتظر بدء حالة الطوارئ واستعد للإخلاء.'
  return `${scenario.briefing || ''} (${exitName})`
}

// ---------- فحص المواقع: مخارج / دخان / تجمع ----------
export function detectZones(pos, scenario) {
  const res = { atMainExit: false, atAltExit: false, inSmoke: false, atAssembly: false, atWrongArea: false }
  if (pos.x > 13.6 && pos.z > 8.4 && pos.z < 11.6) res.atMainExit = true
  if (pos.x < -13.6 && pos.z > 8.4 && pos.z < 11.6) res.atAltExit = true
  for (const s of scenario.smokeZones || []) {
    if (Math.hypot(pos.x - s.x, pos.z - s.z) < s.r) res.inSmoke = true
  }
  const a = WORLD.assembly
  if (Math.hypot(pos.x - a.x, pos.z - a.z) < a.r) res.atAssembly = true
  // منطقة خاطئة: العودة داخل الفصل بعمق بعد مغادرته، أو الذهاب لأقصى الشمال
  if (pos.z < 2 && pos.x < -4) res.atWrongArea = true
  return res
}
