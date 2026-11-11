/* Vue d'un bot (une session) : en-tête vivant + onglets Journal / Personnage / Inventaire / Chat / Carte. */
window.Views = window.Views || {};
Views.bot = (function () {
  const { $, $$, esc, time, nf, initials, options } = UI;
  const st = { tab: 'journal', persoTab: 'carac', jFilter: 'all', jSearch: '', follow: true, invKind: 'all', invSearch: '', invSort: 'name', chatFilter: 'all', chan: 'general', to: '', say: '', seen: {} };
  const CHANNELS = { general: 'Général', guilde: 'Guilde', groupe: 'Groupe', commerce: 'Commerce', recrutement: 'Recrutement', alignement: 'Alignement', equipe: 'Équipe', prive: 'Message privé à…' };
  const SRC = { all: 'Tout', script: 'Script', combat: 'Combat', recolte: 'Récolte', quete: 'Quête', auth: 'Connexion', info: 'Infos' };
  const KINDS = { all: 'Tout', equipement: 'Équipement', ressource: 'Ressources', consommable: 'Consommables', quete: 'Quête' };

  function render(root, { arg }) {
    const S = Api.state;
    const s = S.sessions.find(x => x.id === arg) || S.sessions[0];
    if (!s) {
      root.innerHTML = `<div class="page">${UI.empty('bot', 'Aucun bot en jeu', 'Connecte un compte : son personnage apparaîtra dans la colonne de gauche, clique-le pour ouvrir sa vue.', '<a class="btn-primary" href="#/comptes">Aller à Comptes</a>')}</div>`;
      return;
    }
    if (s.id !== arg) history.replaceState(null, '', '#/bot/' + s.id);
    const a = Api.helpers.acc(s.accountId), c = a.character || {};
    const seen = st.seen[s.id] ||= { journal: s.journal.length, chat: s.chat.length };
    if (st.tab === 'journal') seen.journal = s.journal.length;
    if (st.tab === 'chat') seen.chat = s.chat.length;
    const newJ = s.journal.length - seen.journal, newC = s.chat.length - seen.chat;
    const inCombat = s.status.includes('combat');

    const tabs = [
      ['journal', 'scroll', 'Journal', newJ > 0 ? `<span class="badge new">${newJ}</span>` : `<span class="badge">${s.journal.length}</span>`],
      ['perso', 'user', 'Personnage', ''],
      ['inv', 'bag', 'Inventaire', `<span class="badge">${s.inventory.length}</span>`],
      ['chat', 'chat', 'Chat', newC > 0 ? `<span class="badge new">${newC}</span>` : ''],
      ['carte', 'map', 'Carte', ''],
      ['stats', 'activity', 'Stats', ''],
    ];

    root.innerHTML = `<div class="page-full">
      <div class="bot-head">
        <div class="bh-row">
          <span class="pill ${inCombat ? 'pill-warn' : 'pill-ok'}"><i class="dot"></i>${esc(s.status)}</span>
          <div class="avatar" style="background:${s.color}">${initials(c.name)}</div>
          <div><div class="bh-name">${esc(c.name)} <span class="tag accent">Niv. ${c.level || '?'}</span> <span class="tag">${esc(c.breed || '')}</span></div>
            <div class="cell-sub">${esc(a.nick + a.tag)} · ${esc(c.server || '')}</div></div>
          <div class="bar" title="Expérience vers le niveau suivant" style="min-width:150px"><div class="track"><div class="fill" style="width:${s.xpPct}%;background:var(--accent)"></div></div><span>${s.xpPct}%</span></div>
          <span class="bh-loc">${icon('pin')} ${esc(s.map.zone)} — ${esc(s.map.sub)} <b>[${s.map.x},${s.map.y}]</b></span>
          <div class="bh-actions">
            <span class="pill ${s.scriptRunning ? 'pill-accent' : ''}" title="Script de session">${icon(s.scriptRunning ? 'play' : 'stop')} ${esc(s.script || 'aucun script')}</span>
            <span class="pill" title="Script de combat">${icon('swords')} ${esc(s.fight || 'aucun')}</span>
            ${s.scriptRunning ? `<button class="btn sm" id="b-stop">${icon('stop')} Arrêter le script</button>` : `<button class="btn-success sm" id="b-start" ${s.script ? '' : 'disabled title="Choisis un script dans Comptes ou le tableau de bord"'}>${icon('play')} Relancer</button>`}
            <button class="btn-danger sm" id="b-disc">${icon('logout')} Déconnecter</button>
          </div>
        </div>
        <div class="bh-row">
          ${UI.bar('heart', 'var(--red)', s.hp, s.hpMax, 'Points de vie')}
          ${UI.bar('zap', '#3b82f6', s.energy, s.energyMax, 'Énergie')}
          ${UI.bar('weight', 'var(--green)', s.pods, s.podsMax, 'Pods (poids porté)')}
          <span class="pill" title="Kamas" style="color:var(--yellow)">${icon('coins')} ${nf(s.kamas)} K</span>
        </div>
      </div>
      <div class="subnav">${tabs.map(([k, ic, l, b]) => `<button class="${st.tab === k ? 'on' : ''}" data-tab="${k}">${icon(ic)}${l}${b}</button>`).join('')}</div>
      <div class="bot-body" id="bot-body">${PANES[st.tab](s, a)}</div>
    </div>`;

    $$('[data-tab]', root).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; App.render(); });
    $('#b-disc', root).onclick = async e => { if (await UI.confirm({ title: 'Déconnecter ' + c.name + ' ?', text: 'Le personnage quitte le jeu et sa session disparaît de la colonne.', ok: 'Déconnecter', danger: true })) UI.run(e.target, () => Api.sessions.disconnect(s.id), c.name + ' déconnecté.'); };
    const stop = $('#b-stop', root); if (stop) stop.onclick = () => UI.run(stop, () => Api.sessions.stopScript([s.id]));
    const start = $('#b-start', root); if (start) start.onclick = () => UI.run(start, () => Api.sessions.startScript([s.id], s.script));
    MOUNT[st.tab] && MOUNT[st.tab](root, s, a);
  }

  /* ---------- Contenu de chaque onglet ---------- */
  const PANES = {
    journal: s => {
      const q = st.jSearch.toLowerCase();
      const lines = s.journal.filter(l => (st.jFilter === 'all' || l[1] === st.jFilter) && (!q || l[2].toLowerCase().includes(q)));
      return `<div class="pane-fill">
        <div class="toolbar" style="padding:10px 16px 0">
          <div class="filters">${Object.entries(SRC).map(([k, v]) => `<button class="chip ${st.jFilter === k ? 'on' : ''}" data-jf="${k}">${v}</button>`).join('')}</div>
          <div class="input-icon grow">${icon('search')}<input type="search" id="j-search" placeholder="Chercher dans le journal…" value="${esc(st.jSearch)}"></div>
          <span class="muted">${lines.length} ligne${lines.length > 1 ? 's' : ''}</span>
          <label class="check" title="Défiler automatiquement vers les dernières lignes"><input type="checkbox" id="j-follow" ${st.follow ? 'checked' : ''}> Suivre</label>
          <button class="btn sm" id="j-file">${icon('download')} Journal complet</button>
        </div>
        <div class="log" style="flex:1" data-keep-scroll="journal" data-follow="${st.follow ? 1 : 0}">
          ${lines.map(l => `<div class="l"><span class="ts">${time(l[0])}</span><span class="src ${l[1]}">${SRC[l[1]] || l[1]}</span><span>${esc(l[2])}</span></div>`).join('') || '<div class="muted">Aucune ligne.</div>'}
        </div>
        <div class="muted" style="padding:6px 16px;border-top:1px solid var(--border);font-size:12px">Les dernières lignes de la session, gardées tant qu’elle dure. Le fichier complet contient tout, paquet par paquet.</div>
      </div>`;
    },

    perso: s => {
      const x = s.stats;
      const STATS = [['vitalite', 'Vitalité', 'heart', 'var(--red)'], ['sagesse', 'Sagesse', 'sparkles', 'var(--purple)'], ['force', 'Force', 'swords', 'var(--orange)'], ['intelligence', 'Intelligence', 'zap', 'var(--red)'], ['chance', 'Chance', 'star', 'var(--cyan)'], ['agilite', 'Agilité', 'activity', 'var(--green)']];
      const max = Math.max(100, ...STATS.map(([k]) => x[k]));
      return `<div class="subnav2">${[['carac', 'Caractéristiques'], ['sorts', 'Sorts']].map(([k, l]) => `<button class="${st.persoTab === k ? 'on' : ''}" data-pt="${k}">${l}</button>`).join('')}</div>
      <div class="bot-pane">${st.persoTab === 'carac' ? `
        <div class="btn-row" style="margin-bottom:12px">
          <span class="tag accent">Points à répartir : ${x.capital}</span><span class="tag yellow">PA ${x.pa}</span><span class="tag green">PM ${x.pm}</span>
          <span class="tag orange">Initiative ${x.initiative}</span><span class="tag cyan">Prospection ${x.prospection}</span></div>
        <div class="card">${STATS.map(([k, l, ic, col]) => `<div class="statline">
            <span class="ico" style="background:color-mix(in srgb, ${col} 18%, transparent);color:${col}">${icon(ic)}</span><b>${l}</b>
            <div class="track" style="height:6px;background:var(--surface-3);border-radius:6px"><div style="height:100%;border-radius:6px;width:${x[k] / max * 100}%;background:${col}"></div></div>
            <span class="val">${x[k]}</span></div>`).join('')}</div>`
      : `<div class="card"><div class="table-wrap"><table class="t"><thead><tr><th>Sort</th><th>Niveau</th><th>ID</th></tr></thead><tbody>
          ${s.spells.map(sp => `<tr><td class="cell-main">${esc(sp.name)}</td><td><span class="tag accent">${sp.level}</span></td><td class="muted mono">${sp.id}</td></tr>`).join('')}
        </tbody></table></div></div>`}</div>`;
    },

    inv: s => {
      const q = st.invSearch.toLowerCase();
      let items = s.inventory.filter(i => (st.invKind === 'all' || i.kind === st.invKind) && (!q || i.name.toLowerCase().includes(q)));
      const sorters = { name: (a, b) => a.name.localeCompare(b.name), qty: (a, b) => b.qty - a.qty, weight: (a, b) => b.qty * b.weight - a.qty * a.weight, lvl: (a, b) => b.lvl - a.lvl };
      items = items.sort(sorters[st.invSort]);
      const w = s.inventory.reduce((n, i) => n + i.qty * i.weight, 0);
      return `<div class="bot-pane">
        <div class="toolbar">
          <div class="filters">${Object.entries(KINDS).map(([k, v]) => `<button class="chip ${st.invKind === k ? 'on' : ''}" data-ik="${k}">${v}</button>`).join('')}</div>
          <div class="input-icon grow">${icon('search')}<input type="search" id="inv-search" placeholder="Chercher un objet…" value="${esc(st.invSearch)}"></div>
          <select id="inv-sort" style="width:180px">${options(['name', 'qty', 'weight', 'lvl'], st.invSort, v => ({ name: 'Trier par nom', qty: 'Par quantité', weight: 'Par poids', lvl: 'Par niveau' })[v])}</select>
        </div>
        <div class="muted" style="margin-bottom:10px">${s.inventory.length} objets · ${nf(w)} pods utilisés sur ${nf(s.podsMax)}</div>
        ${items.length ? `<div class="inv-grid">${items.map(i => `<div class="inv-item" title="${esc(i.name)}${i.equipped ? ' (équipé)' : ''} · niv. ${i.lvl}" data-item="${esc(i.name)}" style="${i.equipped ? 'border-color:var(--green)' : ''}">
          <span class="lvl">${i.kind === 'equipement' ? 'niv.' + i.lvl : ''}</span>${i.emoji}<span class="q">${i.qty > 1 ? nf(i.qty) : ''}</span></div>`).join('')}</div>`
        : UI.empty('bag', 'Aucun objet', 'Rien ne correspond à ce filtre.')}
      </div>`;
    },

    chat: s => {
      const lines = s.chat.filter(l => st.chatFilter === 'all' || l[1] === st.chatFilter);
      return `<div class="pane-fill">
        <div class="toolbar" style="padding:10px 16px 0">
          <div class="filters" style="flex-wrap:wrap">${[['all', 'Tout'], ...Object.entries(CHANNELS).map(([k, v]) => [k, v.replace(' à…', '')])].map(([k, v]) => `<button class="chip ${st.chatFilter === k ? 'on' : ''}" data-cf="${k}">${v}</button>`).join('')}</div>
        </div>
        <div class="log" style="flex:1;font-family:var(--font);font-size:13px" data-keep-scroll="chat">
          ${lines.map(l => `<div class="chat-line"><span class="ts muted mono">${time(l[0])}</span> <span class="ch ch-${l[1]}">[${CHANNELS[l[1]].replace(' à…', '')}] ${esc(l[2])} :</span>${esc(l[3])}</div>`).join('') || UI.empty('chat', 'Pas encore de message', 'Les messages reçus en jeu s’afficheront ici.')}
        </div>
        <div class="composer">
          <select id="say-chan">${options(Object.keys(CHANNELS), st.chan, k => CHANNELS[k])}</select>
          ${st.chan === 'prive' ? `<input type="text" id="say-to" placeholder="nom du personnage" value="${esc(st.to)}" style="width:180px;flex:none">` : ''}
          <input type="text" id="say-text" placeholder="Ce que le personnage dit… (Entrée pour envoyer)" value="${esc(st.say)}">
          <button class="btn-primary" id="say-go">${icon('send')} Envoyer</button>
        </div>
      </div>`;
    },

    carte: s => {
      const e = s.mapEntities;
      const list = (ic, title, arr, fmt) => `<div class="sec"><h4>${icon(ic)} ${title}<span class="n">${arr.length}</span></h4>${arr.length ? arr.map(x => `<div>${fmt(x)}</div>`).join('') : '<div class="muted">Aucun</div>'}</div>`;
      return `<div class="map-wrap">
        <div class="map-stage" id="map-stage">
          <canvas id="map-canvas"></canvas>
          <div class="map-head">Carte ${s.map.id} · [${s.map.x}, ${s.map.y}] · ${esc(s.map.sub)} · cellule ${s.map.cell}</div>
          <button class="map-arrow n" data-mv="n" title="Map du dessus">${icon('arrowUp')}</button>
          <button class="map-arrow s" data-mv="s" title="Map du dessous">${icon('arrowDown')}</button>
          <button class="map-arrow w" data-mv="w" title="Map de gauche">${icon('arrowLeft')}</button>
          <button class="map-arrow e" data-mv="e" title="Map de droite">${icon('arrowRight')}</button>
          <div class="map-legend">
            <span><i style="background:#f0b232"></i>personnage</span><span><i style="background:#6ab0ff"></i>joueur</span><span><i style="background:#f23f43"></i>monstres</span>
            <span><i style="background:#a970ff"></i>PNJ</span><span><i style="background:#23a55a"></i>soleil (sortie)</span><span><i style="background:#8bc34a"></i>ressource</span><span><i style="background:#111"></i>obstacle</span>
            <span class="muted">· clic sur une case : y aller</span></div>
          <div class="map-tip" id="map-tip" hidden></div>
        </div>
        <div class="map-side">
          <div class="sec"><h4>${icon('pin')} Position</h4><div>Zone : ${esc(s.map.zone)}</div><div>${esc(s.map.sub)}</div><div>Carte : ${s.map.id}</div><div>Cellule : ${s.map.cell}</div><div>[${s.map.x}, ${s.map.y}]</div></div>
          ${list('swords', 'Monstres', e.monsters, m => `${esc(m.name)} niv.${m.lvl} <span class="muted">[${m.cell}]</span>`)}
          ${list('user', 'PNJ', e.npcs, n => `${esc(n.name)} <span class="muted">[${n.cell}]</span>`)}
          ${list('users', 'Joueurs', e.players, p => `${esc(p.name)} <span class="muted">[${p.cell}]</span>`)}
          ${list('layers', 'Ressources', e.resources, r => `${esc(r.name)} <span class="muted">[${r.cell}]</span>`)}
          ${list('arrowRight', 'Soleils (sorties)', e.doors, d => `Cellule ${d}`)}
        </div>
      </div>`;
    },
  };

  PANES.stats = () => '<div id="bot-stats"></div>';

  /* ---------- Événements de chaque onglet ---------- */
  const MOUNT = {
    stats: (root, s) => Views.stats.renderInto($('#bot-stats', root), s.id),
    journal: (root, s) => {
      $$('[data-jf]', root).forEach(b => b.onclick = () => { st.jFilter = b.dataset.jf; App.render(); });
      const q = $('#j-search', root); q.oninput = () => { st.jSearch = q.value; App.render(); };
      $('#j-follow', root).onchange = e => { st.follow = e.target.checked; App.render(); };
      $('#j-file', root).onclick = e => UI.run(e.target, () => Api.sessions.journalFile(s.id), f => 'Téléchargement de ' + f);
    },
    perso: root => $$('[data-pt]', root).forEach(b => b.onclick = () => { st.persoTab = b.dataset.pt; App.render(); }),
    inv: (root, s) => {
      $$('[data-ik]', root).forEach(b => b.onclick = () => { st.invKind = b.dataset.ik; App.render(); });
      const q = $('#inv-search', root); q.oninput = () => { st.invSearch = q.value; App.render(); };
      $('#inv-sort', root).onchange = e => { st.invSort = e.target.value; App.render(); };
      $$('[data-item]', root).forEach(el => el.onclick = () => UI.menu(el, [
        { label: 'Utiliser', icon: 'play', onClick: () => UI.run(null, () => Api.sessions.useItem(s.id, el.dataset.item), 'Objet utilisé.') },
        { label: 'Copier le nom', icon: 'copy', onClick: () => navigator.clipboard?.writeText(el.dataset.item) },
      ]));
    },
    chat: (root, s) => {
      $$('[data-cf]', root).forEach(b => b.onclick = () => { st.chatFilter = b.dataset.cf; App.render(); });
      $('#say-chan', root).onchange = e => { st.chan = e.target.value; App.render(); };
      const to = $('#say-to', root); if (to) to.oninput = () => st.to = to.value;
      const t = $('#say-text', root); t.oninput = () => st.say = t.value;
      const go = () => { if (!st.say.trim()) return; if (st.chan === 'prive' && !st.to.trim()) return UI.toast('Indique à qui envoyer le message privé.', 'warn'); const txt = st.say; st.say = ''; UI.run(null, () => Api.sessions.say(s.id, st.chan, st.chan === 'prive' ? st.to : '', txt)).catch(() => {}); };
      t.onkeydown = e => { if (e.key === 'Enter') go(); };
      $('#say-go', root).onclick = go;
    },
    carte: (root, s) => {
      $$('[data-mv]', root).forEach(b => b.onclick = () => UI.run(b, () => Api.sessions.move(s.id, b.dataset.mv)));
      drawMap(root, s);
    },
  };

  /* ---------- Dessin de la carte isométrique ---------- */
  function drawMap(root, s) {
    const stage = $('#map-stage', root), cv = $('#map-canvas', root), tip = $('#map-tip', root);
    const W = 15, H = 34; // 15 cases de large, 34 demi-rangées (format Dofus Retro ≈ 479 cases)
    const seed = n => { let x = Math.sin(n * 9301 + s.map.id * 49297) * 233280; return x - Math.floor(x); };
    const draw = () => {
      const r = stage.getBoundingClientRect(); if (!r.width) return;
      const dpr = devicePixelRatio || 1; cv.width = r.width * dpr; cv.height = r.height * dpr;
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.width, r.height);
      const cw = Math.min((r.width - 80) / (W + .5), (r.height - 80) / (H / 2 + .5) * 2), ch = cw / 2;
      const ox = (r.width - cw * (W + .5)) / 2, oy = (r.height - ch * (H / 2 + .5)) / 2;
      const light = document.documentElement.dataset.theme === 'light';
      const e = s.mapEntities;
      const color = id => {
        if (id === s.map.cell) return '#f0b232';
        if (e.players.some(p => p.cell === id)) return '#6ab0ff';
        if (e.monsters.some(m => m.cell === id)) return '#f23f43';
        if (e.npcs.some(n => n.cell === id)) return '#a970ff';
        if (e.doors.includes(id)) return '#23a55a';
        if (e.resources.some(x => x.cell === id)) return '#8bc34a';
        return seed(id) < .1 ? (light ? '#9aa0a8' : '#111214') : null;
      };
      cells.length = 0;
      for (let row = 0; row < H; row++) for (let col = 0; col < W; col++) {
        const id = row * W + col; const cx = ox + col * cw + (row % 2 ? cw / 2 : 0) + cw / 2, cy = oy + row * ch / 2 + ch / 2;
        cells.push({ id, cx, cy, cw, ch });
        ctx.beginPath(); ctx.moveTo(cx, cy - ch / 2); ctx.lineTo(cx + cw / 2, cy); ctx.lineTo(cx, cy + ch / 2); ctx.lineTo(cx - cw / 2, cy); ctx.closePath();
        const c = color(id);
        ctx.fillStyle = c || (light ? '#c9ccd1' : '#3a3c42'); ctx.fill();
        ctx.strokeStyle = light ? '#b5b9bf' : '#2b2d31'; ctx.lineWidth = 1; ctx.stroke();
        if (c && c !== '#111214' && c !== '#9aa0a8') { ctx.beginPath(); ctx.arc(cx, cy, ch / 3.2, 0, 7); ctx.fillStyle = c; ctx.globalAlpha = .9; ctx.fill(); ctx.globalAlpha = 1; }
      }
    };
    const cells = [];
    const hit = (x, y) => cells.find(c => Math.abs(x - c.cx) / (c.cw / 2) + Math.abs(y - c.cy) / (c.ch / 2) <= 1);
    const label = id => {
      const e = s.mapEntities; const n = [];
      if (id === s.map.cell) n.push('ton personnage');
      e.monsters.filter(m => m.cell === id).forEach(m => n.push(m.name + ' niv.' + m.lvl));
      e.npcs.filter(m => m.cell === id).forEach(m => n.push(m.name));
      e.players.filter(m => m.cell === id).forEach(m => n.push(m.name));
      e.resources.filter(m => m.cell === id).forEach(m => n.push(m.name));
      if (e.doors.includes(id)) n.push('soleil : change de map');
      return 'Cellule ' + id + (n.length ? ' · ' + n.join(', ') : '');
    };
    cv.onmousemove = ev => { const r = cv.getBoundingClientRect(); const c = hit(ev.clientX - r.left, ev.clientY - r.top); tip.hidden = !c; if (c) { tip.textContent = label(c.id); tip.style.left = (ev.clientX - r.left + 14) + 'px'; tip.style.top = (ev.clientY - r.top + 10) + 'px'; } };
    cv.onmouseleave = () => tip.hidden = true;
    cv.onclick = ev => { const r = cv.getBoundingClientRect(); const c = hit(ev.clientX - r.left, ev.clientY - r.top); if (c) UI.run(null, () => Api.sessions.goToCell(s.id, c.id), 'Déplacement vers la cellule ' + c.id).catch(() => {}); };
    requestAnimationFrame(draw);
    if (!window.__mapRO) { window.__mapRO = true; addEventListener('resize', () => st.tab === 'carte' && App.render()); }
  }

  return { render };
})();
