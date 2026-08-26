const CTRL = 0xffe3;
const ENTER = 0xff0d;
export const MAX_PASTE = 8192;
const MAX_URL = 2048;

function ctrlKey(rfb, keysym, code) {
  rfb.sendKey(CTRL, "ControlLeft", true);
  rfb.sendKey(keysym, code);
  rfb.sendKey(CTRL, "ControlLeft", false);
}

function requireRfb(rfb) {
  if (!rfb || typeof rfb.clipboardPasteFrom !== 'function' || typeof rfb.sendKey !== 'function') {
    throw new Error('Brak aktywnego połączenia');
  }
}

function clearRemoteClipboard(rfb, schedule) {
  schedule(() => {
    try { rfb.clipboardPasteFrom(""); } catch { /* disconnected: nothing to retain locally */ }
  }, 250);
}

export function parseAddress(raw) {
  const value = raw.trim();
  if (!value || value.length > MAX_URL) throw new Error("Nieprawidłowy adres");
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Dozwolone jest tylko http/https");
  if (url.username || url.password) throw new Error("Adres nie może zawierać danych logowania");
  return { href: url.href, host: url.host };
}

export function pasteToRemote(rfb, field, schedule = setTimeout) {
  requireRfb(rfb);
  const text = field.value;
  if (!text || text.length > MAX_PASTE) throw new Error(`Tekst musi mieć 1–${MAX_PASTE} znaków`);
  field.value = "";
  rfb.clipboardPasteFrom(text);
  ctrlKey(rfb, 0x76, "KeyV");
  clearRemoteClipboard(rfb, schedule);
}

export function openAddress(rfb, raw, schedule = setTimeout) {
  requireRfb(rfb);
  const { href } = parseAddress(raw);
  rfb.clipboardPasteFrom(href);
  ctrlKey(rfb, 0x6c, "KeyL");
  ctrlKey(rfb, 0x76, "KeyV");
  rfb.sendKey(ENTER, "Enter");
  clearRemoteClipboard(rfb, schedule);
}

export function makeIdleController({ timeoutMs, onIdle, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let timer = null;
  const arm = () => {
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      onIdle();
    }, timeoutMs);
  };
  arm();
  return { activity: arm, stop: () => timer !== null && clearTimer(timer) };
}

export function applyViewportMode(UI, WebUtil, mode) {
  if (!UI?.rfb || !['fit', 'pan'].includes(mode)) throw new Error('Nieprawidłowy tryb widoku');
  const fit = mode === 'fit';
  WebUtil.writeSetting('resize', fit ? 'scale' : 'off');
  WebUtil.writeSetting('view_clip', !fit);
  UI.updateSetting('resize');
  UI.updateSetting('view_clip');
  UI.applyResizeMode();
  UI.updateViewClip();
  UI.rfb.dragViewport = !fit;
  UI.updateViewDrag();
  UI.rfb.focus();
}

function addButton(toolbar, label, action) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', action);
  toolbar.append(button);
  return button;
}

function createDialog(title) {
  const dialog = document.createElement('dialog');
  dialog.className = 'pld-dialog';
  const heading = document.createElement('h2');
  heading.textContent = title;
  const body = document.createElement('div');
  body.className = 'pld-dialog-body';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Anuluj';
  close.addEventListener('click', () => dialog.close());
  dialog.append(heading, body, close);
  document.body.append(dialog);
  return { dialog, body };
}

export function startMobilePanel(UI, WebUtil) {
  if (document.getElementById('pld-toolbar')) return;

  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = './app/mobile-panel.css';
  document.head.append(css);

  const toolbar = document.createElement('nav');
  toolbar.id = 'pld-toolbar';
  toolbar.setAttribute('aria-label', 'Sterowanie pulpitem');
  document.body.append(toolbar);

  addButton(toolbar, '⌨ Klawiatura', () => document.getElementById('noVNC_keyboard_button').click());

  const paste = createDialog('Wklej zwykły tekst');
  const pasteInput = document.createElement('textarea');
  pasteInput.maxLength = MAX_PASTE;
  pasteInput.rows = 5;
  pasteInput.placeholder = 'Hasła i OTP wpisuj wyłącznie klawiaturą.';
  const pasteStatus = document.createElement('p');
  pasteStatus.setAttribute('role', 'status');
  const pasteSend = document.createElement('button');
  pasteSend.type = 'button';
  pasteSend.textContent = 'Wklej do aktywnego pola';
  pasteSend.addEventListener('click', () => {
    try {
      pasteToRemote(UI.rfb, pasteInput);
      pasteStatus.textContent = 'Wysłano i wyczyszczono.';
      paste.dialog.close();
      UI.rfb.focus();
    } catch (error) {
      pasteStatus.textContent = error.message;
    }
  });
  paste.dialog.addEventListener('close', () => { pasteInput.value = ''; });
  paste.body.append(pasteInput, pasteStatus, pasteSend);
  addButton(toolbar, '📋 Wklej', () => {
    pasteStatus.textContent = '';
    paste.dialog.showModal();
    pasteInput.focus();
  });

  const address = createDialog('Otwórz adres');
  const addressInput = document.createElement('input');
  addressInput.type = 'url';
  addressInput.maxLength = MAX_URL;
  addressInput.placeholder = 'https://example.com/';
  const addressHost = document.createElement('p');
  addressHost.setAttribute('role', 'status');
  const addressOpen = document.createElement('button');
  addressOpen.type = 'button';
  addressOpen.textContent = 'Otwórz';
  addressOpen.disabled = true;
  addressInput.addEventListener('input', () => {
    try {
      const parsed = parseAddress(addressInput.value);
      addressHost.textContent = `Host: ${parsed.host}`;
      addressOpen.disabled = false;
    } catch {
      addressHost.textContent = 'Podaj pełny adres http/https.';
      addressOpen.disabled = true;
    }
  });
  addressOpen.addEventListener('click', () => {
    try {
      openAddress(UI.rfb, addressInput.value);
      address.dialog.close();
      UI.rfb.focus();
    } catch (error) {
      addressHost.textContent = error.message;
    }
  });
  address.dialog.addEventListener('close', () => {
    addressInput.value = '';
    addressHost.textContent = '';
    addressOpen.disabled = true;
  });
  address.body.append(addressInput, addressHost, addressOpen);
  addButton(toolbar, '🌐 Adres', () => address.dialog.showModal());

  let fitted = UI.getSetting('resize') === 'scale';
  const view = addButton(toolbar, fitted ? '🔎 100% + pan' : '⛶ Dopasuj', () => {
    if (!UI.rfb) return;
    fitted = !fitted;
    applyViewportMode(UI, WebUtil, fitted ? 'fit' : 'pan');
    view.textContent = fitted ? '🔎 100% + pan' : '⛶ Dopasuj';
    view.setAttribute('aria-pressed', String(!fitted));
  });
  view.setAttribute('aria-pressed', String(!fitted));

  const idleNotice = createDialog('Sesja rozłączona');
  const idleText = document.createElement('p');
  idleText.textContent = '15 minut bezczynności. Serwer nadal działa.';
  const reconnect = document.createElement('button');
  reconnect.type = 'button';
  reconnect.textContent = 'Połącz ponownie';
  reconnect.addEventListener('click', () => window.location.reload());
  idleNotice.body.append(idleText, reconnect);

  WebUtil.writeSetting('reconnect', false);
  const idle = makeIdleController({
    timeoutMs: 15 * 60 * 1000,
    onIdle: () => {
      pasteInput.value = '';
      UI.rfb?.disconnect();
      if (!idleNotice.dialog.open) idleNotice.dialog.showModal();
    },
  });
  for (const event of ['pointerdown', 'touchstart', 'keydown', 'input']) {
    document.addEventListener(event, idle.activity, { passive: true });
  }
}
