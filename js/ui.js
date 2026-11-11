/* Petits outils d'interface : échappement, notifications, modales, menus. */
window.UI = (function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const time = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const ago = d => { const m = Math.round((Date.now() - new Date(d)) / 60000); return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : `il y a ${Math.round(m / 60)} h`; };
  const nf = n => Number(n).toLocaleString('fr-FR');
  const initials = s => (s || '?').replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase();

  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.textContent = msg;
    $('#toast-root').appendChild(el);
    setTimeout(() => { el.style.opacity = 0; el.style.transition = '.3s'; setTimeout(() => el.remove(), 300); }, kind === 'err' ? 6000 : 3500);
  }

  /** Exécute une action de l'API en gérant le bouton (désactivé pendant l'appel) et les erreurs. */
  async function run(btn, fn, okMsg) {
    if (btn) btn.disabled = true;
    try { const r = await fn(); if (okMsg) toast(typeof okMsg === 'function' ? okMsg(r) : okMsg, 'ok'); return r; }
    catch (e) { toast(e.message || String(e), 'err'); throw e; }
    finally { if (btn) btn.disabled = false; }
  }

  /** Ouvre une modale. `body` est du HTML ; `onMount(root, close)` permet d'y brancher les événements. */
  function modal({ title, icon: ic, body, foot = '', wide = false, onMount }) {
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
      <div class="modal-h">${ic ? icon(ic) : ''}<h3>${esc(title)}</h3><button class="icon-btn" data-close title="Fermer (Échap)">${icon('x')}</button></div>
      <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    bg.addEventListener('mousedown', e => { if (e.target === bg) close(); });
    $$('[data-close]', bg).forEach(b => b.onclick = close);
    $('#modal-root').appendChild(bg);
    onMount && onMount(bg, close);
    const first = $('input, select, textarea', bg); first && first.focus();
    return close;
  }

  /** Confirmation à la place de window.confirm. */
  function confirm({ title, text, ok = 'Confirmer', danger = false }) {
    return new Promise(res => {
      modal({
        title, icon: danger ? 'alert' : 'help', body: `<p style="margin:0">${text}</p>`,
        foot: `<button class="btn" data-close>Annuler</button><button class="${danger ? 'btn-danger solid' : 'btn-primary'}" id="cf-ok">${esc(ok)}</button>`,
        onMount: (root, close) => { $('#cf-ok', root).onclick = () => { close(); res(true); }; $$('[data-close]', root).forEach(b => b.addEventListener('click', () => res(false))); },
      });
    });
  }

  /** Menu contextuel accroché à un bouton. items: [{label, sub, icon, danger, onClick} | 'sep'] */
  function menu(anchor, items) {
    $$('.menu').forEach(m => m.remove());
    const m = document.createElement('div'); m.className = 'menu';
    m.innerHTML = items.map((it, i) => it === 'sep' ? '<hr>' : `<button data-i="${i}" class="${it.danger ? 'danger' : ''}">${icon(it.icon || 'right')}<span>${esc(it.label)}${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</span></button>`).join('');
    document.body.appendChild(m);
    const r = anchor.getBoundingClientRect();
    const top = Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8);
    m.style.top = top + 'px'; m.style.left = Math.max(8, Math.min(r.right - m.offsetWidth, innerWidth - m.offsetWidth - 8)) + 'px';
    $$('button', m).forEach(b => b.onclick = () => { m.remove(); items[b.dataset.i].onClick(); });
    setTimeout(() => document.addEventListener('mousedown', function h(e) { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', h); } }), 0);
  }

  /** Encadré d'explication repliable (mémorisé par navigateur). */
  function explain(id, html, kind = '') {
    let hidden = false; try { hidden = localStorage.getItem('explain:' + id) === '0'; } catch (e) {}
    if (hidden) return `<button class="btn-ghost sm" data-explain-show="${id}" style="margin-bottom:12px">${icon('help')} Comment ça marche ?</button>`;
    return `<div class="explain ${kind}" data-explain="${id}">${icon(kind === 'warn' ? 'alert' : 'info')}<div>${html}</div><button class="icon-btn x" title="Masquer l'explication" data-explain-hide="${id}">${icon('x')}</button></div>`;
  }
  document.addEventListener('click', e => {
    const h = e.target.closest('[data-explain-hide]'), s = e.target.closest('[data-explain-show]');
    if (!h && !s) return;
    try { localStorage.setItem('explain:' + (h || s).dataset[h ? 'explainHide' : 'explainShow'], h ? '0' : '1'); } catch (err) {}
    window.App && App.render();
  });

  const empty = (ic, title, text, actions = '') => `<div class="empty">${icon(ic)}<b>${esc(title)}</b><div>${text}</div>${actions ? `<div class="btn-row">${actions}</div>` : ''}</div>`;
  const bar = (ic, color, v, max, label) => `<div class="bar" title="${label}">${icon(ic)}<div class="track"><div class="fill" style="width:${Math.max(0, Math.min(100, v / max * 100))}%;background:${color}"></div></div><span>${nf(v)}/${nf(max)}</span></div>`;
  const options = (list, sel, fmt = x => x) => list.map(v => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(fmt(v))}</option>`).join('');

  return { esc, $, $$, time, ago, nf, initials, toast, run, modal, confirm, menu, explain, empty, bar, options };
})();
