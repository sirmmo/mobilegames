// Small helpers shared by all games.

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem('mg:' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try { localStorage.setItem('mg:' + key, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

export function shuffle(arr, rnd = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function toast(parent, text, color = 'var(--accent)') {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  el.style.color = color;
  parent.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

/**
 * Show a modal dialog. `buttons` is a list of {label, primary, value}.
 * Resolves with the chosen button's value.
 */
export function dialog({ title, html = '', buttons = [{ label: 'OK', primary: true, value: true }] }) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    const box = document.createElement('div');
    box.className = 'dialog';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = `<h2></h2><div class="body">${html}</div>`;
    box.querySelector('h2').textContent = title;
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.onclick = () => { ov.remove(); resolve(b.value); };
      box.appendChild(btn);
    }
    // Clickable choices inside html: elements with data-value resolve too.
    box.querySelectorAll('[data-value]').forEach((el) => {
      el.addEventListener('click', () => { ov.remove(); resolve(el.dataset.value); });
    });
    ov.appendChild(box);
    document.body.appendChild(ov);
    const first = box.querySelector('.btn.primary, [data-value], .btn');
    if (first) first.focus();
  });
}

export function formatTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function registerSW(path) {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register(path).catch(() => {});
  }
}
