/* HDV : ventes en direct, recettes sur la durée, objets en vente, marché, règles de vente auto.
   Serveurs : Allisteria et Boune. */
window.Views = window.Views || {};
Views.hdv = (function () {
  const { $, $$, esc, nf, time, ago, options } = UI;
  const st = { server: '', period: '24h', tab: 'listings', q: '', sort: 'revenue', sel: new Set(), marketSort: 'volume' };
  const PERIODS = { '1h': '1 h', '12h': '12 h', '24h': '24 h', '7d': '7 j', '30d': '30 j' };
  const COL = { Allisteria: 'var(--s1)', Boune: 'var(--s2)' };
  const k = n => nf(Math.round(n)) + ' K';
  const STRAT = { undercut: '1 kama sous le moins cher', average: 'Prix moyen du marché', fixed: 'Prix fixe' };

  function render(root) {
    const S = Api.state, H = S.hdv, A = Api.hdv;
    const s = A.stats({ period: st.period, server: st.server });
    const srvF = x => !st.server || x.server === st.server;
    const listings = H.listings.filter(srvF);
    const live = H.sales.filter(srvF).slice(-40).reverse();
    const today = A.stats({ period: '24h', server: st.server });
    const onSale = listings.reduce((a, l) => a + l.price, 0);
    const series = s.byServer.map(b => ({ name: b.server, color: COL[b.server], values: b.values }));

    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('coins')} HDV · Ventes</h1><p>Tout ce que tes bots vendent à l’hôtel des ventes, en direct et sur la durée.</p></div>
        <div class="right">
          <div class="seg">${[['', 'Tous les serveurs'], ...A.servers.map(x => [x, x])].map(([v, l]) => `<button data-srv="${v}" class="${st.server === v ? 'on' : ''}">${v ? `<i style="width:8px;height:8px;border-radius:50%;background:${COL[v]};display:inline-block"></i>` : ''}${l}</button>`).join('')}</div>
          <button class="btn-primary" id="hdv-sell">${icon('plus')} Mettre en vente</button>
        </div>
      </div>
      ${UI.explain('hdv', `Les ventes arrivent <b>en direct</b> à droite dès qu’un objet part. Les règles de vente automatique (onglet « Vente auto ») remettent en vente et ajustent les prix toutes seules.
        <ul><li>Taxes Dofus : <b>2 %</b> du prix à chaque mise en vente, <b>1 %</b> à chaque modification de prix.</li><li>Les prix sont <b>par lot</b> (×1, ×10 ou ×100) ; le prix moyen est ramené à l’unité.</li></ul>`)}

      <div class="toolbar"><div class="seg">${Object.entries(PERIODS).map(([v, l]) => `<button data-per="${v}" class="${st.period === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <span class="muted">${nf(s.count)} ventes sur ${PERIODS[st.period]}${st.server ? ' · ' + st.server : ' · Allisteria + Boune'}</span></div>

      <div class="stats">
        <div class="stat"><div class="v" style="color:var(--yellow)">${Charts.short(s.revenue)}</div><div class="k">Recette totale (kamas)</div></div>
        <div class="stat"><div class="v">${nf(s.units)}</div><div class="k">Unités vendues</div></div>
        <div class="stat"><div class="v">${s.avg.toFixed(1).replace('.', ',')}</div><div class="k">Prix moyen (kamas / unité)</div></div>
        <div class="stat"><div class="v">${s.velocity.toFixed(1).replace('.', ',')}</div><div class="k">Vélocité (unités / h)</div></div>
        <div class="stat"><div class="v err">${Charts.short(s.taxList + s.taxEdit)}</div><div class="k">Taxes payées</div><div class="delta muted">mise en vente ${Charts.short(s.taxList)} · modif. ${Charts.short(s.taxEdit)}</div></div>
        <div class="stat"><div class="v accent">${listings.length}</div><div class="k">Lots en vente</div><div class="delta muted">valeur ${Charts.short(onSale)} kamas</div></div>
      </div>

      <div class="split" style="grid-template-columns:minmax(0,1fr) 340px">
        <div>
          <section class="card"><div class="card-h"><h3>${icon('activity')} Recette sur la durée</h3><span class="sub">kamas ${st.period === '7d' || st.period === '30d' ? 'par jour' : st.period === '1h' ? 'par 5 min' : 'par heure'}</span><div class="right">${Charts.legend(series)}</div></div>
            <div class="card-b"><div class="chart" id="hdv-chart"></div></div></section>

          <section class="card">
            <div class="subnav" style="background:transparent;border-radius:12px 12px 0 0">
              ${[['listings', 'tag', 'En vente', listings.length], ['items', 'layers', 'Ventes par ressource', s.items.length], ['market', 'globe', 'Marché analysé', ''], ['rules', 'zap', 'Vente auto', H.rules.filter(r => r.on && srvF(r)).length]].map(([v, ic, l, n]) => `<button data-tab="${v}" class="${st.tab === v ? 'on' : ''}">${icon(ic)}${l}${n !== '' ? `<span class="badge">${n}</span>` : ''}</button>`).join('')}
            </div>
            ${TABS[st.tab](s, listings)}
          </section>
        </div>

        <div class="side-stack">
          <section class="card"><div class="card-h"><h3><span class="live-dot"></span> Ventes live</h3><span class="right sub">aujourd’hui <b style="color:var(--yellow)">${Charts.short(today.revenue)}</b> kamas</span></div>
            <div class="live-list" data-keep-scroll-top="live">
              ${live.length ? live.map(v => `<div class="live-row ${v.fresh && Date.now() - v.t < 6000 ? 'fresh' : ''}">
                <span class="emo">${v.emoji}</span>
                <div style="min-width:0;flex:1"><div class="cell-main" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(v.item)} <span class="muted">×${v.lot}</span></div>
                  <div class="cell-sub"><i class="srv-dot" style="background:${COL[v.server]}"></i>${esc(v.server)} · ${esc(v.bot)} · ${ago(v.t)}</div></div>
                <b style="color:var(--yellow)">+${nf(v.price)}</b></div>`).join('')
              : UI.empty('coins', 'En attente de ventes…', 'Les ventes s’afficheront ici dès qu’un objet part.')}
            </div></section>
        </div>
      </div>
    </div>`;
    mount(root, s, listings, series);
  }

  const TABS = {
    listings: (s, listings) => {
      const q = st.q.toLowerCase();
      const L = listings.filter(l => !q || (l.item + l.bot).toLowerCase().includes(q)).sort((a, b) => b.since - a.since);
      const n = [...st.sel].filter(id => L.find(l => l.id === id)).length;
      return `<div class="card-b" style="padding-bottom:0"><div class="toolbar">
          <div class="input-icon grow">${icon('search')}<input type="search" id="hdv-q" placeholder="Filtrer par objet ou bot…" value="${esc(st.q)}"></div>
          ${n ? `<span class="tag accent">${n} coché${n > 1 ? 's' : ''}</span><button class="btn-danger sm" id="hdv-unlist">${icon('x')} Retirer de l’HDV</button>` : ''}</div></div>
        <div class="table-wrap" style="max-height:420px">${L.length ? `<table class="t"><thead><tr><th class="w-check"><input type="checkbox" id="hdv-all"></th><th>Objet</th><th>Lot</th><th>Prix du lot</th><th>Prix / u</th><th>Marché / u</th><th>Bot</th><th>En vente depuis</th><th></th></tr></thead><tbody>
          ${L.map(l => { const m = Api.state.hdv.market[l.server]?.find(x => x.item === l.item); const pu = l.price / l.lot; const diff = m ? (pu - m.unit) / m.unit : 0;
            return `<tr class="${st.sel.has(l.id) ? 'sel' : ''}"><td><input type="checkbox" data-sel="${l.id}" ${st.sel.has(l.id) ? 'checked' : ''}></td>
            <td><span style="font-size:18px;margin-right:6px">${l.emoji}</span><b>${esc(l.item)}</b></td><td><span class="tag">×${l.lot}</span></td>
            <td style="color:var(--yellow);font-weight:600">${nf(l.price)}</td><td>${pu.toFixed(1).replace('.', ',')}</td>
            <td>${m ? `${m.unit} <span class="${diff > .08 ? 'err' : diff < -.08 ? 'warn' : 'ok'}" title="${diff > .08 ? 'Plus cher que le marché : risque de ne pas partir' : diff < -.08 ? 'Moins cher que le marché : tu perds peut-être des kamas' : 'Dans le prix du marché'}">${diff >= 0 ? '+' : ''}${Math.round(diff * 100)} %</span>` : '—'}</td>
            <td><i class="srv-dot" style="background:${COL[l.server]}"></i>${esc(l.bot)}</td><td class="muted">${ago(l.since)}</td>
            <td class="actions"><button class="btn sm" data-reprice="${l.id}" title="Modifier le prix (taxe 1 %)">${icon('edit')} Prix</button><button class="icon-btn danger" data-unlist="${l.id}" title="Retirer de l’HDV">${icon('x')}</button></td></tr>`; }).join('')}
          </tbody></table>` : UI.empty('tag', 'Rien en vente', 'Clique « Mettre en vente » ou crée une règle de vente auto.')}</div>`;
    },
    items: s => `<div class="table-wrap" style="max-height:460px">${s.items.length ? `<table class="t"><thead><tr><th>Ressource</th><th>Recette</th><th>Unités</th><th>Ventes</th><th>Prix moyen / u</th><th>Part</th><th>Dernière vente</th></tr></thead><tbody>
      ${s.items.map(it => `<tr><td><span style="font-size:18px;margin-right:6px">${it.emoji}</span><b>${esc(it.item)}</b></td><td style="color:var(--yellow);font-weight:600">${nf(it.revenue)}</td><td>${nf(it.units)}</td><td>${it.sales}</td>
        <td>${(it.revenue / it.units).toFixed(1).replace('.', ',')}</td><td style="width:160px"><div class="hb-t"><span style="width:${it.revenue / s.items[0].revenue * 100}%;background:var(--s3)"></span></div></td><td class="muted">${ago(it.last)}</td></tr>`).join('')}
      </tbody></table>` : UI.empty('layers', 'Aucune vente', 'Aucune vente enregistrée pour ce serveur sur cette période.')}</div>`,
    market: () => {
      const H = Api.state.hdv;
      const servers = st.server ? [st.server] : Api.hdv.servers;
      const sorters = { volume: (a, b) => b.volume - a.volume, prix: (a, b) => b.unit - a.unit, tendance: (a, b) => b.trend - a.trend };
      return `<div class="card-b" style="padding-bottom:0"><div class="toolbar"><span class="muted">Prix relevés par tes bots à chaque passage à l’HDV.</span>
        <div class="seg" style="margin-left:auto">${Object.keys(sorters).map(v => `<button data-msort="${v}" class="${st.marketSort === v ? 'on' : ''}">${v}</button>`).join('')}</div>
        ${servers.map(x => `<button class="btn sm" data-refresh="${x}">${icon('refresh')} Actualiser ${x}</button>`).join('')}</div></div>
        <div class="table-wrap" style="max-height:460px"><table class="t"><thead><tr><th>Objet</th><th>Serveur</th><th>Prix moyen / u</th><th>Moins cher / u</th><th>Volume 24 h</th><th>Tendance 7 j</th><th></th></tr></thead><tbody>
        ${servers.flatMap(x => H.market[x].map(m => ({ ...m, server: x }))).sort(sorters[st.marketSort]).map(m => `<tr>
          <td><span style="font-size:18px;margin-right:6px">${m.emoji}</span><b>${esc(m.item)}</b></td><td><i class="srv-dot" style="background:${COL[m.server]}"></i>${m.server}</td>
          <td>${m.unit}</td><td>${m.min}</td><td>${nf(m.volume)}</td><td class="${m.trend > 0 ? 'ok' : m.trend < 0 ? 'err' : ''}">${m.trend > 0 ? '▲' : m.trend < 0 ? '▼' : '='} ${Math.abs(m.trend)} %</td>
          <td class="actions"><button class="btn sm" data-sellitem="${esc(m.item)}|${m.server}">Vendre</button></td></tr>`).join('')}
        </tbody></table></div>`;
    },
    rules: () => {
      const R = Api.state.hdv.rules.filter(r => !st.server || r.server === st.server);
      return `<div class="card-b" style="padding-bottom:0"><div class="toolbar"><span class="muted">Le bot vend ses ressources tout seul selon ces règles, et ajuste les prix à chaque passage.</span>
        <button class="btn-primary sm" id="rule-new" style="margin-left:auto">${icon('plus')} Nouvelle règle</button></div></div>
        <div class="table-wrap">${R.length ? `<table class="t"><thead><tr><th>Active</th><th>Ressource</th><th>Serveur</th><th>Lot</th><th>Prix</th><th>Plancher</th><th>Garder</th><th>Lots max</th><th></th></tr></thead><tbody>
        ${R.map(r => `<tr style="${r.on ? '' : 'opacity:.55'}"><td><label class="switch"><input type="checkbox" data-rtoggle="${r.id}" ${r.on ? 'checked' : ''}><i></i></label></td>
          <td><b>${esc(r.item)}</b></td><td><i class="srv-dot" style="background:${COL[r.server]}"></i>${r.server}</td><td><span class="tag">×${r.lot}</span></td>
          <td>${r.strategy === 'fixed' ? nf(r.price) + ' K' : STRAT[r.strategy]}</td><td title="Ne vend jamais en dessous">${nf(r.floor)} K</td><td title="Quantité gardée dans l’inventaire">${nf(r.keep)}</td><td>${r.maxListings}</td>
          <td class="actions"><button class="icon-btn" data-redit="${r.id}" title="Modifier">${icon('edit')}</button><button class="icon-btn danger" data-rdel="${r.id}" title="Supprimer">${icon('trash')}</button></td></tr>`).join('')}
        </tbody></table>` : UI.empty('zap', 'Aucune règle', 'Crée une règle : le bot mettra en vente cette ressource tout seul.')}</div>`;
    },
  };

  function mount(root, s, listings, series) {
    const A = Api.hdv;
    $$('[data-srv]', root).forEach(b => b.onclick = () => { st.server = b.dataset.srv; App.render(); });
    $$('[data-per]', root).forEach(b => b.onclick = () => { st.period = b.dataset.per; App.render(); });
    $$('[data-tab]', root).forEach(b => b.onclick = () => { st.tab = b.dataset.tab; App.render(); });
    $('#hdv-sell', root).onclick = () => sellDialog();
    const ch = $('#hdv-chart', root);
    const draw = () => document.body.contains(ch) ? Charts.bars(ch, { stacks: series, labels: s.labels }) : removeEventListener('resize', draw);
    draw(); addEventListener('resize', draw);

    const q = $('#hdv-q', root); if (q) q.oninput = () => { st.q = q.value; App.render(); };
    $$('[data-sel]', root).forEach(cb => cb.onchange = () => { cb.checked ? st.sel.add(cb.dataset.sel) : st.sel.delete(cb.dataset.sel); App.render(); });
    const all = $('#hdv-all', root); if (all) all.onchange = () => { $$('[data-sel]', root).forEach(cb => all.checked ? st.sel.add(cb.dataset.sel) : st.sel.delete(cb.dataset.sel)); App.render(); };
    const un = $('#hdv-unlist', root); if (un) un.onclick = async () => { const ids = [...st.sel]; if (await UI.confirm({ title: `Retirer ${ids.length} lot(s) ?`, text: 'Les objets reviennent dans l’inventaire du bot. La taxe de mise en vente déjà payée n’est pas remboursée.', ok: 'Retirer', danger: true })) UI.run(un, () => A.unlist(ids), 'Lots retirés.').then(() => st.sel.clear()); };
    $$('[data-unlist]', root).forEach(b => b.onclick = () => UI.run(b, () => A.unlist([b.dataset.unlist]), 'Lot retiré.'));
    $$('[data-reprice]', root).forEach(b => b.onclick = () => repriceDialog(Api.state.hdv.listings.find(l => l.id === b.dataset.reprice)));
    $$('[data-msort]', root).forEach(b => b.onclick = () => { st.marketSort = b.dataset.msort; App.render(); });
    $$('[data-refresh]', root).forEach(b => b.onclick = () => UI.run(b, () => A.refreshMarket(b.dataset.refresh), 'Prix actualisés.'));
    $$('[data-sellitem]', root).forEach(b => b.onclick = () => { const [item, server] = b.dataset.sellitem.split('|'); sellDialog({ item, server }); });
    const rn = $('#rule-new', root); if (rn) rn.onclick = () => ruleDialog();
    $$('[data-rtoggle]', root).forEach(c => c.onchange = () => A.toggleRule(c.dataset.rtoggle));
    $$('[data-redit]', root).forEach(b => b.onclick = () => ruleDialog(Api.state.hdv.rules.find(r => r.id === b.dataset.redit)));
    $$('[data-rdel]', root).forEach(b => b.onclick = async () => { if (await UI.confirm({ title: 'Supprimer cette règle ?', text: 'Les lots déjà en vente restent en vente.', ok: 'Supprimer', danger: true })) A.removeRule(b.dataset.rdel); });
  }

  function marketUnit(server, item) { return Api.state.hdv.market[server]?.find(m => m.item === item)?.unit || 0; }

  function sellDialog(pre = {}) {
    const A = Api.hdv;
    const d = { server: pre.server || st.server || A.servers[0], item: pre.item || A.items[0][0], lot: 100, count: 1, price: 0, sessionId: '' };
    UI.modal({
      title: 'Mettre en vente', icon: 'tag', wide: true,
      body: '<div id="sd" style="display:flex;flex-direction:column;gap:12px"></div>',
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="sd-go">Mettre en vente</button>',
      onMount: (m, close) => {
        const draw = () => {
          const bots = A.botsOn(d.server);
          if (!bots.find(b => b.id === d.sessionId)) d.sessionId = bots[0]?.id || '';
          const mu = marketUnit(d.server, d.item);
          if (!d.price) d.price = Math.max(1, Math.round(mu * d.lot * .99));
          const pu = d.price / d.lot, diff = mu ? (pu - mu) / mu : 0;
          const inv = d.sessionId ? Api.helpers.ses(d.sessionId)?.inventory.find(i => i.name === d.item) : null;
          $('#sd', m).innerHTML = `<div class="grid-3">
              <label class="field"><span>Serveur</span><select id="sd-srv">${options(A.servers, d.server)}</select></label>
              <label class="field"><span>Bot vendeur</span><select id="sd-bot">${bots.length ? bots.map(b => `<option value="${b.id}" ${b.id === d.sessionId ? 'selected' : ''}>${esc(Api.helpers.acc(b.accountId).character.name)}</option>`).join('') : '<option value="">aucun bot en jeu sur ce serveur</option>'}</select></label>
              <label class="field"><span>Objet</span><select id="sd-item">${A.items.map(([n, e]) => `<option value="${esc(n)}" ${n === d.item ? 'selected' : ''}>${e} ${esc(n)}</option>`).join('')}</select></label></div>
            <div class="grid-3">
              <div class="field"><span>Taille du lot</span><div class="seg">${A.lots.map(l => `<button type="button" data-lot="${l}" class="${d.lot === l ? 'on' : ''}">×${l}</button>`).join('')}</div></div>
              <label class="field"><span>Nombre de lots</span><input type="number" id="sd-count" min="1" max="50" value="${d.count}"></label>
              <label class="field"><span>Prix du lot (kamas)</span><input type="number" id="sd-price" min="1" value="${d.price}"></label></div>
            <div class="card" style="padding:12px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px">
              <div><div class="label">Marché / u</div><b>${mu || '—'}</b></div>
              <div><div class="label">Ton prix / u</div><b class="${diff > .08 ? 'err' : diff < -.08 ? 'warn' : 'ok'}">${pu.toFixed(1).replace('.', ',')} (${diff >= 0 ? '+' : ''}${Math.round(diff * 100)} %)</b></div>
              <div><div class="label">Taxe 2 %</div><b class="err">${nf(Math.ceil(d.price * .02) * d.count)} K</b></div>
              <div><div class="label">Si tout part</div><b style="color:var(--yellow)">${nf(d.price * d.count)} K</b></div></div>
            ${!bots.length ? `<div class="explain warn" style="margin:0">${icon('alert')}<div>Aucun bot n’est en jeu sur <b>${d.server}</b>. Connecte un compte de ce serveur depuis Comptes.</div></div>`
              : inv ? `<div class="muted">${esc(inv.name)} dans l’inventaire : <b>${nf(inv.qty)}</b> (il faut ${nf(d.lot * d.count)}).</div>` : `<div class="muted">Le bot doit avoir l’objet dans son inventaire ou sa banque (il passe la chercher si besoin).</div>`}`;
          $('#sd-srv', m).onchange = e => { d.server = e.target.value; d.price = 0; draw(); };
          $('#sd-bot', m).onchange = e => { d.sessionId = e.target.value; draw(); };
          $('#sd-item', m).onchange = e => { d.item = e.target.value; d.price = 0; draw(); };
          $$('[data-lot]', m).forEach(b => b.onclick = () => { d.lot = +b.dataset.lot; d.price = 0; draw(); });
          $('#sd-count', m).onchange = e => { d.count = Math.max(1, +e.target.value); draw(); };
          $('#sd-price', m).onchange = e => { d.price = Math.max(1, +e.target.value); draw(); };
        };
        draw();
        $('#sd-go', m).onclick = e => UI.run(e.target, () => Api.hdv.sell(d), `${d.count} lot(s) mis en vente.`).then(close).catch(() => {});
      },
    });
  }

  function repriceDialog(l) {
    const mu = marketUnit(l.server, l.item);
    UI.modal({
      title: 'Modifier le prix · ' + l.item + ' ×' + l.lot, icon: 'edit',
      body: `<label class="field"><span>Nouveau prix du lot</span><input type="number" id="rp" value="${l.price}" min="1"><span class="hint">Marché : ${mu} / u soit ${nf(mu * l.lot)} le lot. Taxe de modification : 1 %.</span></label>
        <div class="btn-row"><button class="btn sm" data-p="${Math.max(1, mu * l.lot - 1)}">Aligner sur le marché −1</button><button class="btn sm" data-p="${Math.round(mu * l.lot * 1.05)}">Marché +5 %</button></div>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="rp-go">Enregistrer</button>',
      onMount: (m, close) => {
        $$('[data-p]', m).forEach(b => b.onclick = () => $('#rp', m).value = b.dataset.p);
        $('#rp-go', m).onclick = e => UI.run(e.target, () => Api.hdv.reprice(l.id, +$('#rp', m).value), 'Prix modifié.').then(close);
      },
    });
  }

  function ruleDialog(r) {
    const A = Api.hdv;
    const d = r ? { ...r } : { on: true, server: st.server || A.servers[0], item: A.items[0][0], lot: 100, strategy: 'undercut', price: 0, floor: 0, keep: 0, maxListings: 5 };
    UI.modal({
      title: r ? 'Modifier la règle' : 'Nouvelle règle de vente', icon: 'zap', wide: true,
      body: `<div class="grid-3">
          <label class="field"><span>Serveur</span><select id="r-srv">${options(A.servers, d.server)}</select></label>
          <label class="field"><span>Ressource</span><select id="r-item">${A.items.map(([n, e]) => `<option value="${esc(n)}" ${n === d.item ? 'selected' : ''}>${e} ${esc(n)}</option>`).join('')}</select></label>
          <label class="field"><span>Lot</span><select id="r-lot">${options(A.lots.map(String), String(d.lot), v => '×' + v)}</select></label></div>
        <div class="grid-3">
          <label class="field"><span>Prix</span><select id="r-strat">${options(Object.keys(STRAT), d.strategy, v => STRAT[v])}</select></label>
          <label class="field"><span>Prix fixe du lot</span><input type="number" id="r-price" value="${d.price}" ${d.strategy === 'fixed' ? '' : 'disabled'}></label>
          <label class="field"><span>Prix plancher du lot</span><input type="number" id="r-floor" value="${d.floor}"><span class="hint">ne vend jamais en dessous</span></label></div>
        <div class="grid-2">
          <label class="field"><span>Quantité à garder</span><input type="number" id="r-keep" value="${d.keep}"><span class="hint">laissée dans l’inventaire (ex. pour le craft)</span></label>
          <label class="field"><span>Lots en vente en même temps (max)</span><input type="number" id="r-max" value="${d.maxListings}" min="1" max="50"></label></div>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="r-go">Enregistrer</button>',
      onMount: (m, close) => {
        $('#r-strat', m).onchange = e => $('#r-price', m).disabled = e.target.value !== 'fixed';
        $('#r-go', m).onclick = e => {
          Object.assign(d, { server: $('#r-srv', m).value, item: $('#r-item', m).value, lot: +$('#r-lot', m).value, strategy: $('#r-strat', m).value, price: +$('#r-price', m).value, floor: +$('#r-floor', m).value, keep: +$('#r-keep', m).value, maxListings: +$('#r-max', m).value });
          UI.run(e.target, () => A.saveRule(d), 'Règle enregistrée.').then(close).catch(() => {});
        };
      },
    });
  }

  return { render };
})();
