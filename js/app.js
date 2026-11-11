/* Routeur, barre du haut, navigation et colonne des sessions. */
window.App = (function () {
  const { $, $$, esc, initials } = UI;
  const S = Api.state;
  const sel = new Set();           // sessions cochées (cibles des commandes)
  const collapsed = new Set();     // groupes repliés dans la colonne
  let sbFilter = '';

  const NAV = [
    { id: 'accueil', label: 'Tableau de bord', icon: 'home' },
    { id: 'bot', label: 'Bot', icon: 'bot' },
    { id: 'stats', label: 'Statistiques', icon: 'activity' },
    { id: 'hdv', label: 'HDV', icon: 'coins' },
    { id: 'calcul', label: 'Rentabilité', icon: 'zap' },
    { id: 'agent', label: 'Agent IA', icon: 'sparkles' },
    { id: 'comptes', label: 'Comptes', icon: 'users', count: () => S.accounts.length },
    { id: 'proxies', label: 'Proxies', icon: 'globe', count: () => S.proxies.length },
    { id: 'groupes', label: 'Groupes', icon: 'group', count: () => S.groups.length || '' },
    { id: 'scripts', label: 'Scripts', icon: 'code' },
    { id: 'reglages', label: 'Réglages', icon: 'settings' },
  ];

  const route = () => { const [, page = 'accueil', arg] = location.hash.split('/'); return { page, arg }; };

  function renderTop() {
    const p = S.proxies, ok = p.filter(x => x.state === 'ok' && x.enabled).length, used = p.filter(x => x.clients > 0).length;
    $('#top-proxies').innerHTML = `${icon('globe')} ${ok} prêts · ${used} en jeu`;
    $('#top-user').innerHTML = `${icon('user')} <b>${esc(S.user.name)}</b>`;
    const ws = $('#ws-status');
    ws.className = 'pill ' + (S.connection.ok ? 'pill-ok' : 'pill-err');
    ws.innerHTML = `<i class="dot"></i><span>${S.connection.ok ? 'Bot connecté' : 'Bot injoignable'}</span>`;
    ws.title = S.connection.label;
    const b = $('#banner');
    b.hidden = S.connection.ok; b.className = 'banner err'; b.textContent = 'La page ne joint plus ton bot : reconnexion en cours…';
  }

  function renderNav() {
    const { page } = route();
    $('#mainnav').innerHTML = NAV.map(n => {
      const href = n.id === 'bot' ? '#/bot/' + (App.lastBot || S.sessions[0]?.id || '') : '#/' + n.id;
      const c = n.count && n.count();
      return `<a href="${href}" class="${page === n.id ? 'active' : ''}">${icon(n.icon)}${n.label}${c !== undefined && c !== '' ? `<span class="count">${c}</span>` : ''}</a>`;
    }).join('') + `<span class="spacer"></span><span class="pill ${S.sessions.length ? 'pill-ok' : ''}">${icon('activity')} ${S.sessions.length} en jeu</span>`;
  }

  function renderSidebar() {
    const { page, arg } = route();
    const sb = $('#sidebar');
    sb.hidden = !(page === 'accueil' || page === 'bot');
    if (sb.hidden) return;
    const { acc } = Api.helpers;
    [...sel].forEach(id => { if (!S.sessions.find(s => s.id === id)) sel.delete(id); });
    const list = S.sessions.filter(s => { const a = acc(s.accountId); return !sbFilter || (a.nick + (a.character?.name || '')).toLowerCase().includes(sbFilter.toLowerCase()); });
    const buckets = new Map();
    list.forEach(s => { const g = S.groups.find(g => g.id === acc(s.accountId).groupId); const k = g ? g.id : '_solo'; if (!buckets.has(k)) buckets.set(k, { name: g ? g.name : 'Sans groupe', icon: g ? 'group' : 'user', items: [] }); buckets.get(k).items.push(s); });

    const item = s => {
      const a = acc(s.accountId), c = a.character || {};
      const st = s.status.includes('combat') ? 'busy' : 'on';
      return `<div class="sb-item ${page === 'bot' && arg === s.id ? 'active' : ''}" data-open="${s.id}" title="Ouvrir la vue de ${esc(c.name)}">
        <input type="checkbox" data-sel="${s.id}" ${sel.has(s.id) ? 'checked' : ''} title="Cocher : reçoit les commandes du tableau de bord">
        <div class="avatar" style="background:${s.color}">${initials(c.name)}<i class="st ${st}"></i></div>
        <div style="min-width:0"><div class="sb-name">${esc(c.name)}</div><div class="sb-sub ${st === 'busy' ? 'warn' : 'ok'}">${esc(s.status)}${s.scriptRunning ? ' · ' + esc(s.script) : ''}</div></div></div>`;
    };

    sb.innerHTML = `
      <div class="sb-head"><span class="sb-title">${icon('activity')} Sessions <span class="tag">${S.sessions.length}</span></span>
        <a class="btn-ghost sm" href="#/comptes" title="Connecter d'autres comptes">${icon('plus')}</a></div>
      ${S.sessions.length > 4 ? `<div class="sb-search input-icon">${icon('search')}<input type="search" id="sb-filter" placeholder="Filtrer…" value="${esc(sbFilter)}"></div>` : ''}
      <div class="sb-list" id="sb-list">
        ${S.sessions.length ? [...buckets].map(([k, b]) => `
          <div class="sb-group ${collapsed.has(k) ? 'collapsed' : ''}">
            <div class="sb-group-h" data-toggle="${k}">${icon('chevron', 'chev')}${icon(b.icon)}${esc(b.name)}<span class="n">${b.items.length}</span></div>
            <div class="sb-items">${b.items.map(item).join('')}</div>
          </div>`).join('')
        : `<div class="sb-empty"><b>Aucune session</b>Connecte un compte depuis <a href="#/comptes">Comptes</a> : sa session apparaîtra ici.</div>`}
      </div>
      <div class="sb-foot">
        <label class="check" style="align-items:center"><input type="checkbox" id="sb-all" ${S.sessions.length && sel.size === S.sessions.length ? 'checked' : ''}> Tout cocher</label>
        <span style="margin-left:auto">${sel.size} cochée${sel.size > 1 ? 's' : ''}</span>
      </div>`;

    $$('[data-open]', sb).forEach(el => el.onclick = e => { if (e.target.matches('input')) return; location.hash = '#/bot/' + el.dataset.open; });
    $$('[data-sel]', sb).forEach(cb => cb.onchange = () => { cb.checked ? sel.add(cb.dataset.sel) : sel.delete(cb.dataset.sel); App.render(); });
    $$('[data-toggle]', sb).forEach(h => h.onclick = () => { const k = h.dataset.toggle; collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); renderSidebar(); });
    const all = $('#sb-all', sb); all.onchange = () => { sel.clear(); if (all.checked) S.sessions.forEach(s => sel.add(s.id)); App.render(); };
    const f = $('#sb-filter', sb); if (f) f.oninput = () => { sbFilter = f.value; renderSidebar(); const n = $('#sb-filter'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  }

  const VIEWS = { accueil: 'dashboard', bot: 'bot', comptes: 'accounts', proxies: 'proxies', groupes: 'groups', scripts: 'scripts', reglages: 'settings', stats: 'stats', agent: 'agent', hdv: 'hdv', calcul: 'calc' };

  /** Rendu complet de la page courante, en gardant le focus et le défilement. */
  function render() {
    const { page, arg } = route();
    const view = Views[VIEWS[page]] || Views.dashboard;
    const root = $('#view');
    // mémorise focus + scrolls
    const active = document.activeElement;
    const keyOf = el => el.id ? '#' + el.id : [...el.attributes].filter(a => a.name.startsWith('data-')).map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') || null;
    const focusKey = active && root.contains(active) && active !== root ? keyOf(active) : null;
    let caret = null; try { caret = focusKey && active.selectionStart != null ? [active.selectionStart, active.selectionEnd] : null; } catch (e) {}
    const scrolls = {}; $$('[data-keep-scroll]', root).forEach(el => scrolls[el.dataset.keepScroll] = [el.scrollTop, el.scrollHeight - el.scrollTop - el.clientHeight < 30]);
    const tops = {}; $$('[data-keep-scroll-top]', root).forEach(el => tops[el.dataset.keepScrollTop] = el.scrollTop);
    const mainScroll = root.scrollTop;

    renderTop(); renderNav(); renderSidebar();
    if (page === 'bot' && arg) App.lastBot = arg;
    document.title = 'Bothors · ' + (NAV.find(n => n.id === page)?.label || 'Tableau de bord');
    view.render(root, { arg, sel });
    hydrateIcons(root);

    root.scrollTop = mainScroll;
    $$('[data-keep-scroll]', root).forEach(el => { const s = scrolls[el.dataset.keepScroll]; if (!s || s[1] || el.dataset.follow === '1') el.scrollTop = el.scrollHeight; else el.scrollTop = s[0]; });
    $$('[data-keep-scroll-top]', root).forEach(el => { el.scrollTop = tops[el.dataset.keepScrollTop] || 0; });
    if (focusKey) { const el = root.querySelector(focusKey); if (el) { el.focus(); if (caret) try { el.setSelectionRange(...caret); } catch (e) {} } }
  }

  // Re-rendu quand les données changent (regroupé sur une frame).
  // Seules les pages qui affichent ce sujet sont redessinées ; les autres ne mettent à jour que les barres.
  const TOPICS = {
    accueil: ['sessions', 'events', 'console', 'scripts', 'accounts', 'proxies'], bot: ['sessions', 'accounts'],
    comptes: ['accounts', 'proxies', 'scripts', 'events', 'settings'], proxies: ['proxies'], groupes: ['groups', 'accounts', 'scripts'],
    scripts: ['scripts', 'accounts'], reglages: ['settings'], stats: [], agent: ['agent', 'groups'], hdv: ['hdv'], calcul: [],
  };
  let pending = null;
  const schedule = topic => {
    const full = (TOPICS[route().page] || TOPICS.accueil).includes(topic) || topic === 'connection';
    if (pending === 'full') return;
    const first = !pending; pending = full ? 'full' : 'light';
    if (first) requestAnimationFrame(() => { const p = pending; pending = null; if (p === 'full') render(); else { renderTop(); renderNav(); renderSidebar(); } });
  };
  ['sessions', 'accounts', 'proxies', 'groups', 'scripts', 'settings', 'events', 'console', 'connection', 'agent', 'hdv'].forEach(t => Api.on(t, () => schedule(t)));
  addEventListener('hashchange', () => { $('#view').scrollTop = 0; render(); });

  // Thème
  const setTheme = t => { document.documentElement.dataset.theme = t; const b = $('#btn-theme'); b.innerHTML = icon(t === 'dark' ? 'sun' : 'moon'); try { localStorage.setItem('theme', t); } catch (e) {} };
  let saved = 'dark'; try { saved = localStorage.getItem('theme') || 'dark'; } catch (e) {}
  setTheme(saved);
  $('#btn-theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#btn-logout').onclick = async () => { if (await UI.confirm({ title: 'Se déconnecter ?', text: 'Tu quittes le tableau de bord. Tes bots continuent de tourner.', ok: 'Se déconnecter' })) Api.logout(); };
  $('#btn-help').onclick = () => UI.modal({
    title: 'Par où commencer ?', icon: 'help', wide: true,
    body: `<ol style="margin:0;padding-left:18px;line-height:1.9">
      <li><b>Proxies</b> : colle tes proxies, puis « Tester tout ». Ceux « pour le jeu » servent aux connexions ; ceux « pour créer des comptes » servent au site Ankama.</li>
      <li><b>Réglages</b> : ajoute ta clé CapSolver (anti-robot), éventuellement les numéros SMS, les codes paysafecard et un webhook Discord pour les alertes.</li>
      <li><b>Comptes</b> : ajoute tes comptes Ankama (ou crées-en), choisis un script pour chacun, puis « connecter ».</li>
      <li><b>Scripts</b> : importe tes scripts .js ; « Documentation pour IA » te donne de quoi en faire écrire un par Claude ou ChatGPT.</li>
      <li><b>Tableau de bord</b> : coche des sessions à gauche pour leur envoyer un script, un script de combat ou une commande <code>.bot</code>.</li>
      <li><b>Bot</b> : clique un personnage à gauche pour voir son journal, ses stats, son inventaire, son chat et sa carte.</li>
      <li><b>Groupes</b> : jusqu’à 8 comptes qui jouent ensemble derrière un meneur.</li></ol>`,
    foot: '<button class="btn-primary" data-close>Compris</button>',
  });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !e.target.closest('input, textarea, select')) { const s = $('#view input[type=search]'); if (s) { e.preventDefault(); s.focus(); } }
  });

  return { render, sel, route };
})();
hydrateIcons(document);
App.render();
