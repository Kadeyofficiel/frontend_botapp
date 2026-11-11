/* Proxies : mode d'attribution, liste testable, ajout en lot, machines (HWID). */
window.Views = window.Views || {};
Views.proxies = (function () {
  const { $, $$, esc, time, options } = UI;
  const st = { q: '', tag: '', stat: 'all', sel: new Set(), add: '', addUse: 'game', addTag: '', addTest: true, addReplace: false, bulkTag: '', log: [] };
  const P = () => Api.proxies;
  const MODES = {
    none: { label: 'Sans proxy', icon: 'wifi', text: 'Toutes les connexions sortent par <b>l’IP de ce PC</b>. Simple, mais Ankama voit tous tes comptes sur la même IP.' },
    same: { label: 'Même proxy', icon: 'link', text: 'Toutes les connexions passent par <b>un seul proxy</b> (le premier actif).' },
    'per-client': { label: 'Un par client', icon: 'users', text: 'Chaque client prend le proxy actif <b>le moins utilisé</b> et le retrouve à sa reconnexion : sa connexion et sa session de jeu sortent par la même IP. Si tous sont pleins, la connexion attend.' },
  };

  const stateTag = p => !p.enabled ? '<span class="tag">désactivé</span>'
    : p.state === 'ok' ? '<span class="tag green">OK</span>' : p.state === 'fail' ? '<span class="tag red">échec</span>'
    : p.state === 'testing' ? '<span class="tag accent">test…</span>' : '<span class="tag yellow">pas testé</span>';
  const latency = p => p.latency == null ? '<span class="muted">—</span>' : `<span class="${p.latency < 900 ? 'ok' : p.latency < 1100 ? 'warn' : 'err'}">${p.latency} ms</span>`;

  function render(root) {
    const S = Api.state, all = S.proxies, m = S.proxyMode;
    [...st.sel].forEach(id => { if (!all.find(p => p.id === id)) st.sel.delete(id); });
    const counts = {
      all: all.length, game: all.filter(p => p.use === 'game').length, create: all.filter(p => p.use === 'create').length,
      ok: all.filter(p => p.state === 'ok').length, fail: all.filter(p => p.state === 'fail').length, untested: all.filter(p => p.state === 'untested').length,
      off: all.filter(p => !p.enabled).length, used: all.filter(p => p.clients > 0).length,
    };
    const STATS = [['all', 'Proxies', ''], ['game', 'Pour le jeu', 'accent'], ['create', 'Pour créer des comptes', 'accent'], ['ok', 'OK', 'ok'], ['fail', 'En échec', 'err'], ['untested', 'Pas testés', 'warn'], ['off', 'Désactivés', ''], ['used', 'Occupés', '']];
    const filt = { all: () => true, game: p => p.use === 'game', create: p => p.use === 'create', ok: p => p.state === 'ok', fail: p => p.state === 'fail', untested: p => p.state === 'untested', off: p => !p.enabled, used: p => p.clients > 0 }[st.stat];
    const q = st.q.toLowerCase();
    const list = all.filter(filt).filter(p => (!st.tag || p.tag === st.tag) && (!q || [p.host, p.session, p.tag].join(' ').toLowerCase().includes(q)))
      .sort((a, b) => (b.pinned - a.pinned));
    const tags = [...new Set(all.map(p => p.tag).filter(Boolean))];
    const places = m.mode === 'per-client' ? counts.game * m.max : null;
    const n = st.sel.size;
    const mc = S.machines;

    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('globe')} Proxies</h1><p>Les IP par lesquelles tes comptes se connectent, et les machines (HWID) qu’ils montrent à Ankama.</p></div>
      </div>

      <section class="card" style="margin-bottom:16px"><div class="card-b" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div><div class="label" style="margin-bottom:6px">Mode d’attribution</div>
          <div class="seg">${Object.entries(MODES).map(([k, v]) => `<button data-mode="${k}" class="${m.mode === k ? 'on' : ''}">${icon(v.icon)} ${v.label}</button>`).join('')}</div></div>
        ${m.mode === 'per-client' ? `<div><div class="label" style="margin-bottom:6px">Clients par proxy</div><input type="number" id="px-max" min="1" max="10" value="${m.max}" style="width:80px"></div>
          <div><div class="label" style="margin-bottom:6px">Places</div><span class="pill ${places ? 'pill-ok' : 'pill-err'}">${counts.used} / ${places} occupées</span></div>` : ''}
        <div class="muted" style="flex:1;min-width:260px">${MODES[m.mode].text}</div>
      </div></section>

      ${UI.explain('proxies', `<b>Deux usages de proxies :</b>
        <ul><li><b>Pour le jeu</b> : uniquement les connexions des comptes (jetons, sessions).</li>
        <li><b>Pour créer des comptes</b> : tout ce qui se fait sur le site Ankama — inscriptions, ajout de téléphone, abonnements, liens de confirmation. Jamais pour jouer.</li></ul>
        Un compte créé prend un proxy de jeu à sa première connexion. Teste tes proxies après les avoir ajoutés : seuls les « OK » sont utilisés.`)}

      <div class="stats">${STATS.map(([k, l, c]) => `<div class="stat click ${st.stat === k ? 'on' : ''}" data-stat="${k}" title="Filtrer la liste"><div class="v ${c}">${counts[k]}</div><div class="k">${l}</div></div>`).join('')}</div>

      <div class="split">
        <div>
          <div class="toolbar">
            <div class="input-icon grow">${icon('search')}<input type="search" id="px-q" placeholder="Rechercher : ip, session, étiquette…   ( / )" value="${esc(st.q)}"></div>
            <select id="px-tagf" style="width:180px"><option value="">Toutes les étiquettes</option>${options(tags, st.tag)}</select>
            <span class="muted">${list.length} affiché${list.length > 1 ? 's' : ''}</span>
          </div>
          ${n ? `<div class="bulkbar"><span class="n">${n} coché${n > 1 ? 's' : ''}</span>
            <button class="btn sm" data-bk="test">${icon('activity')} Tester</button>
            <button class="btn sm" data-bk="on">Activer</button><button class="btn sm" data-bk="off">Désactiver</button>
            <input type="text" id="bk-tag" placeholder="étiquette" value="${esc(st.bulkTag)}" style="width:120px"><button class="btn sm" data-bk="tag">${icon('tag')} Étiqueter</button>
            <button class="btn sm" data-bk="game">Pour le jeu</button><button class="btn sm" data-bk="create">Pour créer des comptes</button>
            <button class="btn-danger sm" data-bk="del">${icon('trash')} Supprimer</button>
            <button class="btn-ghost sm" data-bk="clear" style="margin-left:auto">${icon('x')}</button></div>` : ''}
          <div class="card"><div class="table-wrap" style="max-height:calc(100vh - 380px)">
            ${all.length ? `<table class="t"><thead><tr>
              <th class="w-check"><input type="checkbox" id="px-all" ${list.length && list.every(p => st.sel.has(p.id)) ? 'checked' : ''}></th>
              <th>Proxy</th><th>Usage</th><th>Étiquette</th><th>Latence</th><th>Clients</th><th>Dernier test</th><th></th></tr></thead><tbody>
              ${list.map(p => `<tr class="${st.sel.has(p.id) ? 'sel' : ''}" style="${p.enabled ? '' : 'opacity:.55'}">
                <td><input type="checkbox" data-sel="${p.id}" ${st.sel.has(p.id) ? 'checked' : ''}></td>
                <td><div class="mono">${p.pinned ? icon('pin') + ' ' : ''}${esc(p.host)}:${p.port}</div><div class="cell-sub mono">${esc(p.session)}</div></td>
                <td>${p.use === 'game' ? '<span class="tag accent">jeu</span>' : '<span class="tag orange">création</span>'}</td>
                <td>${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : '<span class="muted">—</span>'}</td>
                <td>${latency(p)}</td>
                <td>${p.clients}/${p.max}</td>
                <td>${stateTag(p)} <span class="cell-sub">${esc(p.last)}</span></td>
                <td class="actions">
                  <button class="icon-btn" data-test="${p.id}" title="Tester ce proxy">${icon('refresh')}</button>
                  <button class="icon-btn" data-pin="${p.id}" title="${p.pinned ? 'Désépingler' : 'Épingler en haut'}">${icon('pin')}</button>
                  <label class="switch" title="${p.enabled ? 'Actif' : 'Désactivé'}"><input type="checkbox" data-en="${p.id}" ${p.enabled ? 'checked' : ''}><i></i></label>
                  <button class="icon-btn danger" data-del="${p.id}" title="Supprimer">${icon('trash')}</button></td>
              </tr>`).join('')}</tbody></table>`
            : UI.empty('globe', 'Aucun proxy', 'Colle tes proxies dans le cadre « Ajouter des proxies » à droite.')}
          </div>
          ${all.length ? `<div class="btn-row" style="padding:10px 12px;border-top:1px solid var(--border)">
            <button class="btn sm" data-ta="all">${icon('activity')} Tester tout (${counts.all})</button>
            <button class="btn sm" data-ta="fail" ${counts.fail ? '' : 'disabled'}>Retester les échecs (${counts.fail})</button>
            <button class="btn sm" data-ta="untested" ${counts.untested ? '' : 'disabled'}>Tester les non testés (${counts.untested})</button></div>` : ''}
          </div>
        </div>

        <div class="side-stack">
          <section class="card"><div class="card-h"><h3>${icon('plus')} Ajouter des proxies</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            <textarea id="add-text" rows="6" placeholder="Un proxy par ligne :&#10;ip:port&#10;ip:port:utilisateur:motdepasse&#10;utilisateur:motdepasse@ip:port&#10;socks5://…&#10;(les lignes « # » sont ignorées)">${esc(st.add)}</textarea>
            <div class="grid-2"><select id="add-use">${options(['game', 'create'], st.addUse, v => v === 'game' ? 'Pour le jeu' : 'Pour créer des comptes')}</select>
              <input type="text" id="add-tag" placeholder="étiquette (fournisseur, pays…)" value="${esc(st.addTag)}"></div>
            <label class="check"><input type="checkbox" id="add-test" ${st.addTest ? 'checked' : ''}> Tester après l’ajout</label>
            <label class="check"><input type="checkbox" id="add-replace" ${st.addReplace ? 'checked' : ''}> Remplacer toute la liste</label>
            <div class="btn-row"><label class="btn sm" style="cursor:pointer">${icon('upload')} Fichier…<input type="file" id="add-file" accept=".txt,.csv" hidden></label>
              <button class="btn-primary" id="add-go" style="margin-left:auto">Ajouter</button></div>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('cpu')} Machines (HWID)</h3><span class="sub right">${mc.length}</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            ${mc.length ? `<select id="mc-sel">${mc.map(x => `<option value="${x.id}" ${S.selectedMachine === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`
              : '<div class="muted">Aucune machine : les connexions montrent celle de <code>system.json</code>.</div>'}
            <div class="muted" style="font-size:12px">${m.mode === 'per-client' ? 'En mode « Un par client », chaque client montre la machine de son proxy (créée à sa première connexion). La machine choisie ici ne sert qu’aux modes « Sans proxy » et « Même proxy ».' : 'La machine choisie est celle que montrent toutes les connexions.'}</div>
            <button class="btn sm" id="mc-gen">${icon('plus')} Générer une machine</button>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('history')} Journal</h3></div>
            <div class="log" style="max-height:200px">${st.log.slice(-30).reverse().map(l => `<div class="l"><span class="ts">${time(l[0])}</span><span>${esc(l[1])}</span></div>`).join('') || '<div class="muted">Rien pour l’instant.</div>'}</div></section>
        </div>
      </div>
    </div>`;

    mount(root);
  }

  function mount(root) {
    const S = Api.state;
    const note = t => st.log.push([new Date(), t]);
    $$('[data-mode]', root).forEach(b => b.onclick = () => UI.run(null, () => P().setMode(b.dataset.mode, S.proxyMode.max)).then(() => note('Mode : ' + b.textContent.trim())));
    const mx = $('#px-max', root); if (mx) mx.onchange = () => UI.run(null, () => P().setMode(S.proxyMode.mode, Math.max(1, +mx.value)));
    $$('[data-stat]', root).forEach(c => c.onclick = () => { st.stat = st.stat === c.dataset.stat ? 'all' : c.dataset.stat; App.render(); });
    const q = $('#px-q', root); if (q) q.oninput = () => { st.q = q.value; App.render(); };
    $('#px-tagf', root).onchange = e => { st.tag = e.target.value; App.render(); };
    $$('[data-sel]', root).forEach(cb => cb.onchange = () => { cb.checked ? st.sel.add(cb.dataset.sel) : st.sel.delete(cb.dataset.sel); App.render(); });
    const all = $('#px-all', root); if (all) all.onchange = () => { $$('[data-sel]', root).forEach(cb => all.checked ? st.sel.add(cb.dataset.sel) : st.sel.delete(cb.dataset.sel)); App.render(); };
    $$('[data-test]', root).forEach(b => b.onclick = () => P().test([b.dataset.test]));
    $$('[data-pin]', root).forEach(b => b.onclick = () => P().pin(b.dataset.pin));
    $$('[data-en]', root).forEach(c => c.onchange = () => P().setEnabled([c.dataset.en], c.checked));
    $$('[data-del]', root).forEach(b => b.onclick = async () => { if (await UI.confirm({ title: 'Supprimer ce proxy ?', text: 'Les comptes qui l’utilisaient en prendront un autre à leur prochaine connexion.', ok: 'Supprimer', danger: true })) P().remove([b.dataset.del]).then(() => note('1 proxy supprimé')); });
    $$('[data-ta]', root).forEach(b => b.onclick = () => {
      const f = { all: () => true, fail: p => p.state === 'fail', untested: p => p.state === 'untested' }[b.dataset.ta];
      const ids = S.proxies.filter(f).map(p => p.id); note(`Test de ${ids.length} proxies…`);
      UI.run(b, () => P().test(ids), () => { const ok = S.proxies.filter(p => ids.includes(p.id) && p.state === 'ok').length; note(`Test terminé : ${ok} OK, ${ids.length - ok} en échec`); return `Test terminé : ${ok}/${ids.length} OK`; });
    });

    const ids = () => [...st.sel];
    const bt = $('#bk-tag', root); if (bt) bt.oninput = () => st.bulkTag = bt.value;
    $$('[data-bk]', root).forEach(b => b.onclick = async () => {
      const k = b.dataset.bk;
      if (k === 'clear') { st.sel.clear(); return App.render(); }
      if (k === 'del') { if (!await UI.confirm({ title: `Supprimer ${ids().length} proxies ?`, text: 'Cette action ne peut pas être annulée.', ok: 'Supprimer', danger: true })) return; await P().remove(ids()); note(ids().length + ' proxies supprimés'); st.sel.clear(); return; }
      const acts = { test: () => P().test(ids()), on: () => P().setEnabled(ids(), true), off: () => P().setEnabled(ids(), false), tag: () => P().setTag(ids(), st.bulkTag), game: () => P().setUse(ids(), 'game'), create: () => P().setUse(ids(), 'create') };
      UI.run(b, acts[k]).catch(() => {});
    });

    const t = $('#add-text', root); t.oninput = () => st.add = t.value;
    $('#add-use', root).onchange = e => st.addUse = e.target.value;
    const tg = $('#add-tag', root); tg.oninput = () => st.addTag = tg.value;
    $('#add-test', root).onchange = e => st.addTest = e.target.checked;
    $('#add-replace', root).onchange = e => st.addReplace = e.target.checked;
    $('#add-file', root).onchange = async e => { const f = e.target.files[0]; if (f) { st.add = (st.add ? st.add + '\n' : '') + await f.text(); App.render(); } };
    $('#add-go', root).onclick = async e => {
      if (st.addReplace && !await UI.confirm({ title: 'Remplacer toute la liste ?', text: 'Tous les proxies actuels seront supprimés avant l’ajout.', ok: 'Remplacer', danger: true })) return;
      UI.run(e.target, () => P().add(st.add, { use: st.addUse, tag: st.addTag, test: st.addTest, replace: st.addReplace }), r => `${r.added} proxies ajoutés`)
        .then(r => { note(`${r.added} proxies ajoutés (${st.addUse === 'game' ? 'jeu' : 'création'})`); st.add = ''; App.render(); }).catch(() => {});
    };
    const ms = $('#mc-sel', root); if (ms) ms.onchange = () => P().selectMachine(ms.value);
    $('#mc-gen', root).onclick = e => UI.run(e.target, () => P().generateMachine(), 'Machine générée.').then(() => note('Machine générée'));
  }

  return { render };
})();
