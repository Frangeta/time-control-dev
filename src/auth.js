/**
 * auth.js — Autenticación Firebase + UI del modal de login/registro.
 */
import { auth } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';

// ── Observador de estado de auth ────────────────────────────────────────────

/**
 * Registra callbacks para login y logout.
 * Devuelve la función de cleanup (unsubscribe).
 */
export function initAuth(onLogin, onLogout) {
  return onAuthStateChanged(auth, user => {
    if (user) onLogin(user);
    else       onLogout();
  });
}

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function register(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

// ── Modal de Auth (generado dinámicamente, sin tocar index.html) ────────────

let _modal = null;

export function createAuthModal() {
  if (_modal) return _modal;

  _modal = document.createElement('div');
  _modal.id = 'auth-overlay';
  _modal.innerHTML = `
    <div class="auth-card">
      <div class="auth-logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="url(#ag)"/>
          <defs><linearGradient id="ag" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#1a6cf5"/><stop offset="1" stop-color="#00c896"/>
          </linearGradient></defs>
          <circle cx="16" cy="16" r="9" fill="none" stroke="white" stroke-width="1.8" opacity="0.9"/>
          <line x1="16" y1="16" x2="16" y2="10" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
          <line x1="16" y1="16" x2="20" y2="18.5" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="16" cy="16" r="1.5" fill="white"/>
        </svg>
        <span>TimeFlow</span>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" id="atab-login"  onclick="authSwitchTab('login')">Iniciar sesión</button>
        <button class="auth-tab"        id="atab-reg"    onclick="authSwitchTab('register')">Crear cuenta</button>
      </div>

      <form id="auth-form" onsubmit="authSubmit(event)">
        <div class="auth-field">
          <label>Correo electrónico</label>
          <input type="email" id="auth-email" placeholder="tu@correo.com" required autocomplete="email"/>
        </div>
        <div class="auth-field">
          <label>Contraseña</label>
          <input type="password" id="auth-pass" placeholder="Mínimo 6 caracteres" required autocomplete="current-password" minlength="6"/>
        </div>
        <div id="auth-err" class="auth-err" style="display:none"></div>
        <button type="submit" class="auth-submit" id="auth-submit-btn">Iniciar sesión</button>
      </form>

      <div id="auth-loading" class="auth-loading" style="display:none">
        <div class="auth-spinner"></div>
        <span>Conectando…</span>
      </div>
    </div>
  `;

  // CSS inline para no tocar index.html
  const style = document.createElement('style');
  style.textContent = `
    #auth-overlay {
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(10,20,35,.92);
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(8px);
    }
    .auth-card {
      background: var(--navy2,#162638);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 16px;
      padding: 36px 32px;
      width: 100%; max-width: 380px;
      box-shadow: 0 24px 64px rgba(0,0,0,.5);
    }
    .auth-logo {
      display: flex; align-items: center; gap: 10px;
      font-family: var(--ff-head,'Syne'); font-size: 20px;
      font-weight: 700; color: var(--text1,#e8f0f8);
      margin-bottom: 28px; justify-content: center;
    }
    .auth-tabs {
      display: flex; border-bottom: 1px solid rgba(255,255,255,.08);
      margin-bottom: 24px;
    }
    .auth-tab {
      flex: 1; padding: 9px; background: none; border: none;
      border-bottom: 2px solid transparent; cursor: pointer;
      font-family: var(--ff-body,'Outfit'); font-size: 13px;
      color: var(--text3,#5c7fa0); transition: color .15s, border-color .15s;
      margin-bottom: -1px;
    }
    .auth-tab.active {
      color: var(--text1,#e8f0f8);
      border-bottom-color: var(--blue,#2d7ff9);
    }
    .auth-field { margin-bottom: 16px; }
    .auth-field label {
      display: block; font-size: 11px; font-weight: 600;
      letter-spacing: .06em; text-transform: uppercase;
      color: var(--text3,#5c7fa0); margin-bottom: 6px;
    }
    .auth-field input {
      width: 100%; padding: 10px 14px; box-sizing: border-box;
      background: rgba(255,255,255,.06);
      border: 1px solid var(--border2,rgba(255,255,255,.1));
      border-radius: 8px; color: var(--text1,#e8f0f8);
      font-family: var(--ff-body,'Outfit'); font-size: 14px;
      transition: border-color .15s;
    }
    .auth-field input:focus {
      outline: none; border-color: var(--blue,#2d7ff9);
    }
    .auth-err {
      background: rgba(239,68,68,.12);
      border: 1px solid rgba(239,68,68,.3);
      border-radius: 8px; padding: 10px 14px;
      color: #fca5a5; font-size: 13px; margin-bottom: 16px;
    }
    .auth-submit {
      width: 100%; padding: 12px;
      background: var(--blue,#2d7ff9); color: white;
      border: none; border-radius: 8px; cursor: pointer;
      font-family: var(--ff-body,'Outfit'); font-size: 14px;
      font-weight: 600; transition: opacity .15s;
    }
    .auth-submit:hover { opacity: .85; }
    .auth-submit:disabled { opacity: .5; cursor: not-allowed; }
    .auth-loading {
      display: flex; align-items: center; justify-content: center;
      gap: 12px; padding: 12px 0;
      color: var(--text2,#94b4d4); font-size: 14px;
    }
    .auth-spinner {
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid rgba(45,127,249,.3);
      border-top-color: var(--blue,#2d7ff9);
      animation: spin .7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);
  document.body.appendChild(_modal);
  return _modal;
}

export function showAuthModal() {
  if (!_modal) createAuthModal();
  _modal.style.display = 'flex';
}

export function hideAuthModal() {
  if (_modal) _modal.style.display = 'none';
}

// Helpers para el formulario (expuestos a window desde main.js)
export function authSwitchTab(mode) {
  const isLogin = mode === 'login';
  document.getElementById('atab-login').classList.toggle('active', isLogin);
  document.getElementById('atab-reg').classList.toggle('active', !isLogin);
  document.getElementById('auth-submit-btn').textContent = isLogin ? 'Iniciar sesión' : 'Crear cuenta';
  document.getElementById('auth-err').style.display = 'none';
  document.getElementById('auth-form').dataset.mode = mode;
  const passInput = document.getElementById('auth-pass');
  passInput.autocomplete = isLogin ? 'current-password' : 'new-password';
}

export function showAuthError(msg) {
  const el = document.getElementById('auth-err');
  el.textContent = msg;
  el.style.display = 'block';
}

export function setAuthLoading(loading) {
  document.getElementById('auth-loading').style.display = loading ? 'flex' : 'none';
  document.getElementById('auth-form').style.display    = loading ? 'none' : 'block';
}
