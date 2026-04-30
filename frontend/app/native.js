/**
 * native.js — Capacitor bridge
 *
 * Detecta se o app está rodando dentro do Capacitor (Android/iOS)
 * ou no browser, e expõe uma API unificada para os módulos do app.
 *
 * Uso:
 *   import { Native } from './native.js';
 *   await Native.haptic('light');
 *   await Native.hideSplash();
 */

const isNative = () =>
  typeof window !== 'undefined' &&
  typeof window.Capacitor !== 'undefined' &&
  window.Capacitor.isNativePlatform();

// ─── Lazy plugin loaders ───────────────────────────────────────────
async function getStatusBar() {
  if (!isNative()) return null;
  const { StatusBar } = await import('@capacitor/status-bar');
  return StatusBar;
}

async function getSplashScreen() {
  if (!isNative()) return null;
  const { SplashScreen } = await import('@capacitor/splash-screen');
  return SplashScreen;
}

async function getHaptics() {
  if (!isNative()) return null;
  const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
  return { Haptics, ImpactStyle, NotificationType };
}

async function getApp() {
  if (!isNative()) return null;
  const { App } = await import('@capacitor/app');
  return App;
}

async function getKeyboard() {
  if (!isNative()) return null;
  const { Keyboard } = await import('@capacitor/keyboard');
  return Keyboard;
}

// ─── Native API pública ────────────────────────────────────────────
export const Native = {

  /** true quando rodando no Android ou iOS via Capacitor */
  isNative,

  /** Plataforma atual: 'android' | 'ios' | 'web' */
  platform() {
    if (!isNative()) return 'web';
    return window.Capacitor.getPlatform();
  },

  // ─── SplashScreen ────────────────────────────────────────
  async hideSplash() {
    const splash = await getSplashScreen();
    if (!splash) return;
    await splash.hide({ fadeOutDuration: 300 });
  },

  // ─── StatusBar ───────────────────────────────────────────
  async setStatusBar({ style = 'DARK', color = '#161B22' } = {}) {
    const sb = await getStatusBar();
    if (!sb) return;
    await sb.setStyle({ style: style === 'DARK' ? 'DARK' : 'LIGHT' });
    if (this.platform() === 'android') {
      await sb.setBackgroundColor({ color });
    }
  },

  async showStatusBar() {
    const sb = await getStatusBar();
    if (sb) await sb.show();
  },

  async hideStatusBar() {
    const sb = await getStatusBar();
    if (sb) await sb.hide();
  },

  // ─── Haptics ─────────────────────────────────────────────
  /**
   * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'} type
   */
  async haptic(type = 'light') {
    const h = await getHaptics();
    if (!h) return;

    const { Haptics, ImpactStyle, NotificationType } = h;

    switch (type) {
      case 'light':   await Haptics.impact({ style: ImpactStyle.Light });   break;
      case 'medium':  await Haptics.impact({ style: ImpactStyle.Medium });  break;
      case 'heavy':   await Haptics.impact({ style: ImpactStyle.Heavy });   break;
      case 'success': await Haptics.notification({ type: NotificationType.Success }); break;
      case 'warning': await Haptics.notification({ type: NotificationType.Warning }); break;
      case 'error':   await Haptics.notification({ type: NotificationType.Error });   break;
      default:        await Haptics.impact({ style: ImpactStyle.Light });
    }
  },

  async vibrate(duration = 300) {
    const h = await getHaptics();
    if (h) await h.Haptics.vibrate({ duration });
  },

  // ─── App (back button) ───────────────────────────────────
  /**
   * Registra handler para o botão Voltar do Android.
   * @param {() => void} handler — retorna true se consumiu o evento
   */
  async onBackButton(handler) {
    const app = await getApp();
    if (!app) return;

    app.addListener('backButton', ({ canGoBack }) => {
      handler(canGoBack);
    });
  },

  async exitApp() {
    const app = await getApp();
    if (app) await app.exitApp();
  },

  // ─── Keyboard ────────────────────────────────────────────
  async onKeyboardShow(callback) {
    const kb = await getKeyboard();
    if (kb) kb.addListener('keyboardWillShow', (info) => callback(info));
  },

  async onKeyboardHide(callback) {
    const kb = await getKeyboard();
    if (kb) kb.addListener('keyboardWillHide', callback);
  },

  async hideKeyboard() {
    const kb = await getKeyboard();
    if (kb) await kb.hide();
  },
};

// ─── Bootstrap ao carregar ─────────────────────────────────────────
export async function initNative() {
  if (!isNative()) return;

  // Ajusta StatusBar com o tema atual
  const isDark = document.documentElement.dataset.theme === 'dark';
  await Native.setStatusBar({
    style: isDark ? 'DARK' : 'LIGHT',
    color: isDark ? '#161B22' : '#FFFFFF',
  });

  // Esconde SplashScreen após 300ms (tempo pro app renderizar)
  setTimeout(() => Native.hideSplash(), 300);

  // Botão Voltar: fecha modais abertos antes de sair
  await Native.onBackButton((canGoBack) => {
    const activeModal = document.querySelector('.modal.active, .reset-modal-overlay.active');
    if (activeModal) {
      activeModal.classList.remove('active');
      return;
    }
    if (!canGoBack) Native.exitApp();
  });

  // Adiciona classe no <html> para CSS nativo
  document.documentElement.classList.add('cap-native');
  document.documentElement.classList.add(`cap-${Native.platform()}`);
}
