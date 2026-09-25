// ============================================================
// SafeSense VR — نقطة الدخول + Routing بسيط بدون مكتبات
// #/ → الرئيسية · #/setup → الإعداد · #/train → المحاكاة · #/admin → المشرف
// ============================================================
import './styles.css'
import { renderHome, renderSetup, startTraining } from './ui.js'
import { renderAdminLogin, renderDashboard, XR_READY_NOTES } from './admin/admin.js'
import { isAdminLoggedIn } from './services/storage.js'

const app = document.getElementById('app')

// حالة عامة خفيفة (تُحفظ في الذاكرة أثناء الجلسة)
const state = {
  studentName: '',
  userType: 'general',
  scenarioId: 'fire-basic',
  startLevel: 'easy',
  filters: {},
  adminTab: 'overview',
  openSession: null,
}

let cleanupTrain = null
function disposeTrain() {
  if (cleanupTrain) { try { cleanupTrain() } catch {} cleanupTrain = null }
  document.body.classList.remove('emergency')
}

function route() {
  const hash = location.hash || '#/'
  disposeTrain()
  window.scrollTo(0, 0)
  app.innerHTML = ''
  if (hash.startsWith('#/setup')) renderSetup(app, state)
  else if (hash.startsWith('#/train')) cleanupTrain = startTraining(app, state)
  else if (hash.startsWith('#/admin')) {
    if (!isAdminLoggedIn() && hash !== '#/admin') { location.hash = '#/admin'; return }
    if (!isAdminLoggedIn()) renderAdminLogin(app)
    else renderDashboard(app, state)
  }
  else renderHome(app)
}

window.addEventListener('hashchange', route)
route()

// إتاحة ملاحظات WebXR في الكونسول للمطورين
console.info('%cSafeSense VR v1.0.0 — ' + XR_READY_NOTES, 'color:#0e7c5b')
