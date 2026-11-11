/* Calculateur de rentabilité Pévétons → parchemins → kamas → €.
   Prix du kamas en direct (ventekamas.com, via Api.kamasRates). Réglages gardés dans le navigateur. */
window.Views = window.Views || {};
Views.calc = (function () {
  const { $, $$, esc, nf } = UI;
  const SCROLLS = [
    { id: 'petit', name: 'Petit parchemin', cost: 2 },
    { id: 'moyen', name: 'Parchemin moyen', cost: 3 },
    { id: 'grand', name: 'Grand parchemin', cost: 5 },
    { id: 'puissant', name: 'Puissant parchemin', cost: 16 },
    { id: 'sort', name: 'Parchemin de point de sort', cost: 100 },
  ];
  const DEFAULTS = {
    matchs: 100, winrate: 50, comptes: 10, pevPerWin: 1, maxWins: 0,
    server: 'allisteria', method: 'paypal', rateOverride: '',
    prices: { petit: 14000, moyen: 45000, grand: 30000, puissant: 50000, sort: 287000 },
    choice: 'best', hdvTax: 2, commission: 0,
    abo: 1.61, fees: 5, cert: 0.07, mail: 0.02, stock: 250,
  };
  let p = structuredClone(DEFAULTS);
  try { const s = JSON.parse(localStorage.getItem('calc') || 'null'); if (s) p = { ...p, ...s, prices: { ...p.prices, ...s.prices } }; } catch (e) {}
  const save = () => { try { localStorage.setItem('calc', JSON.stringify(p)); } catch (e) {} };
  let rates = null, loading = false;
  const METHODS = { paypal: 'PayPal', skrill: 'Skrill', bitcoin: 'Bitcoin', usdt: 'USDT', sepa: 'Virement SEPA' };
  const eur = v => (v < 0 ? '−' : '') + Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const eur4 = v => v.toLocaleString('fr-FR', { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' €';
  const kam = v => nf(Math.round(v)) + ' kamas';
  const days = d => d >= 1 ? Math.floor(d) + ' j ' + Math.round((d % 1) * 24) + ' h' : Math.round(d * 24) + ' h';

  let hist = null, histDays = 7;
  function loadRates(force) {
    if ((rates && hist && !force) || loading) return;
    loading = true;
    Promise.all([Api.kamasRates.get(), Api.kamasRates.history(histDays)]).then(([r, h]) => { rates = r; hist = h; loading = false; if (App.route().page === 'calcul') App.render(); });
  }
  // Prix du kamas actualisé toutes les 5 minutes tant que la page est ouverte
  setInterval(() => { if (App.route().page === 'calcul') loadRates(true); }, 5 * 60e3);

  /* Bloc « prix du kamas » : prix actuel + fluctuation sur la période, pour Allisteria et Boune. */
  function priceBlock() {
    const SRV = [['allisteria', 'Allisteria', 'var(--s1)'], ['boune', 'Boune', 'var(--s2)']];
    const pts = hist?.points || [];
    const serie = id => pts.map(x => x.prices.find(y => y.server === id)?.[p.method]).filter(v => v != null);
    const cards = SRV.map(([id, name, col]) => {
      const now = rates.prices.find(x => x.server === id)?.[p.method] || 0, s = serie(id);
      const min = s.length ? Math.min(...s) : now, max = s.length ? Math.max(...s) : now;
      const ago24 = s.length > 24 ? s[s.length - 25] : s[0], first = s[0];
      const pct = (a, b) => b ? (a - b) / b * 100 : 0;
      const ch = v => `<span class="${v > 0.05 ? 'ok' : v < -0.05 ? 'err' : 'muted'}">${v > 0.05 ? '▲' : v < -0.05 ? '▼' : '='} ${Math.abs(v).toFixed(1).replace('.', ',')} %</span>`;
      const swing = now ? (max - min) / now * 100 : 0;
      return `<section class="card ${p.server === id ? 'sel-card' : ''}"><div class="card-h"><h3><i class="srv-dot" style="background:${col};width:9px;height:9px"></i>${name}</h3>
          <span class="sub">${METHODS[p.method]}</span>${p.server === id ? '<span class="right tag accent">utilisé dans le calcul</span>' : `<button class="btn-ghost sm right" data-use="${id}">Utiliser</button>`}</div>
        <div class="card-b">
          <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><span style="font-size:26px;font-weight:700">${now.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} €</span><span class="muted">le million de kamas</span></div>
          <div class="btn-row" style="margin:6px 0 10px;font-size:12px"><span>24 h : ${ch(pct(now, ago24))}</span><span>${histDays} j : ${ch(pct(now, first))}</span>
            <span class="muted">min ${min.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} · max ${max.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} · écart ${swing.toFixed(1).replace('.', ',')} %</span></div>
          <div class="chart" id="kh-${id}" style="min-height:150px"></div>
        </div></section>`;
    }).join('');
    const src = !hist ? '' : hist.source === 'relais' ? '<span class="ok">historique du relais</span>' : hist.source === 'navigateur' ? 'relevés gardés dans ce navigateur' : '<span class="warn" title="Courbe inventée pour montrer l’affichage : le vrai historique arrive quand le relais /api/kamas-rates/history est branché">courbe de DÉMO — pas de vrai historique encore</span>';
    return `<div class="section-title">${icon('activity')} Prix du kamas chez ventekamas · ${rates.live ? '<span class="ok">en direct</span>' : 'relevé réel du ' + new Date(rates.generated).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} · ${src}
        <div class="seg" style="margin-left:auto">${[1, 7, 30].map(d => `<button data-hd="${d}" class="${histDays === d ? 'on' : ''}">${d === 1 ? '24 h' : d + ' j'}</button>`).join('')}</div></div>
      <div class="chart-grid" style="margin-bottom:14px">${cards}</div>`;
  }
  function drawPrices(el) {
    const pts = hist?.points || [];
    [['allisteria', 'Allisteria', 'var(--s1)'], ['boune', 'Boune', 'var(--s2)']].forEach(([id, name, col]) => {
      const c = $('#kh-' + id, el); if (!c || !pts.length) return;
      const vals = pts.map(x => x.prices.find(y => y.server === id)?.[p.method] ?? null);
      const lab = pts.map(x => { const d = new Date(x.t); return histDays === 1 ? d.getHours() + ' h' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); });
      Charts.line(c, { series: [{ name: name + ' (€ / M)', color: col, values: vals.map(v => v ?? 0) }], labels: lab, height: 150, fit: true, fmt: v => v.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' €' });
    });
  }

  /* ---------- Le calcul ---------- */
  function compute(q = p) {
    const row = rates?.prices.find(x => x.server === q.server);
    const rate = q.rateOverride !== '' && +q.rateOverride > 0 ? +q.rateOverride : (row?.[q.method] || 0);
    const scrolls = SCROLLS.map(s => {
      const price = +q.prices[s.id] || 0, net = price * (1 - q.hdvTax / 100);
      return { ...s, price, net, perPev: net / s.cost, eurPerPev: net / s.cost / 1e6 * rate };
    });
    const best = scrolls.reduce((a, b) => b.perPev > a.perPev ? b : a);
    const used = q.choice === 'best' ? best : scrolls.find(s => s.id === q.choice);
    const winsDay = q.matchs * q.winrate / 100, pevDay = winsDay * q.pevPerWin;
    const kamasDay = pevDay * used.perPev, brutDay = kamasDay / 1e6 * rate;
    const commDay = brutDay * q.commission / 100;
    const aboWeek = q.abo * (1 + q.fees / 100), aboDay = aboWeek / 7, oneTime = q.cert + q.mail;
    let life = null;
    if (q.maxWins > 0 && winsDay > 0) {
      const d = q.maxWins / winsDay, weeks = Math.ceil(d / 7);
      const brut = q.maxWins * q.pevPerWin * used.perPev / 1e6 * rate, comm = brut * q.commission / 100, costs = oneTime + weeks * aboWeek;
      life = { days: d, weeks, brut, comm, costs, profit: brut - comm - costs };
    }
    const profitDay = life ? life.profit / life.days : brutDay - commDay - aboDay;
    const fleetDay = profitDay * q.comptes;
    const startup = life ? 0 : oneTime * q.comptes;
    const consumedMonth = life ? q.comptes * 30 / life.days : 0;
    return { rate, row, scrolls, best, used, winsDay, pevDay, kamasDay, brutDay, commDay, aboDay, aboWeek, oneTime, life, profitDay, fleetDay, startup, consumedMonth,
      month: fleetDay * 30 - startup, year: fleetDay * 365 - startup, parchDay: pevDay / used.cost };
  }

  /* Meilleure façon de dépenser N pévétons (sac à dos non borné). */
  function bestSpend(n, scrolls) {
    const v = new Array(n + 1).fill(0), pick = new Array(n + 1).fill(-1);
    for (let i = 1; i <= n; i++) { v[i] = v[i - 1]; pick[i] = -1; scrolls.forEach((s, k) => { if (s.cost <= i && v[i - s.cost] + s.net > v[i]) { v[i] = v[i - s.cost] + s.net; pick[i] = k; } }); }
    const count = scrolls.map(() => 0); let i = n, left = 0;
    while (i > 0) { if (pick[i] === -1) { left++; i--; } else { count[pick[i]]++; i -= scrolls[pick[i]].cost; } }
    return { kamas: v[n], count, left };
  }

  /* ---------- Rendu ---------- */
  const num = (key, label, attrs = '', hint = '') => `<label class="field"><span>${label}</span><input type="number" data-k="${key}" value="${esc(key.includes('.') ? p.prices[key.split('.')[1]] : p[key])}" ${attrs}>${hint ? `<span class="hint">${hint}</span>` : ''}</label>`;

  function render(root) {
    loadRates();
    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('coins')} Rentabilité Pévétons</h1><p>Combien rapportent tes bots en échangeant leurs Pévétons contre des parchemins, revendus en kamas puis en euros au prix du jour.</p></div>
        <div class="right"><button class="btn" id="c-reset">${icon('refresh')} Valeurs par défaut</button></div>
      </div>
      <div class="split" style="grid-template-columns:330px minmax(0,1fr);align-items:start">
        <div class="side-stack" style="position:static">
          <section class="card"><div class="card-h"><h3>${icon('swords')} Volume & winrate</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            <div class="grid-2">${num('matchs', 'Combats / jour', 'min="0"')}${num('comptes', 'Comptes lancés', 'min="1"')}</div>
            <label class="field"><span>Winrate : <b id="wr-v">${p.winrate} %</b></span><input type="range" data-k="winrate" min="0" max="100" value="${p.winrate}" style="accent-color:var(--accent)"></label>
            <div class="grid-2">${num('pevPerWin', 'Pévétons / victoire', 'min="0" step="0.1"')}${num('maxWins', 'Victoires max / compte', 'min="0"', '0 = pas de limite')}</div>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('scroll')} Prix des parchemins</h3><span class="sub">kamas / unité</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            ${SCROLLS.map(s => `<div style="display:grid;grid-template-columns:1fr 120px;gap:8px;align-items:center"><span>${s.name} <span class="tag">${s.cost} pév.</span></span><input type="number" data-k="prices.${s.id}" value="${p.prices[s.id]}" min="0"></div>`).join('')}
            <div class="grid-2">${num('hdvTax', 'Taxe HDV (%)', 'min="0" step="0.5"', 'mise en vente des parchemins')}
              <label class="field"><span>Échanger contre</span><select data-k="choice"><option value="best" ${p.choice === 'best' ? 'selected' : ''}>Le plus rentable</option>${SCROLLS.map(s => `<option value="${s.id}" ${p.choice === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></label></div>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('activity')} Prix du kamas</h3><span class="sub" id="rate-src"></span>
            <div class="right"><button class="icon-btn" id="c-refresh" title="Recharger depuis ventekamas.com">${icon('refresh')}</button></div></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            <div class="grid-2"><label class="field"><span>Serveur</span><select data-k="server"><option value="allisteria" ${p.server === 'allisteria' ? 'selected' : ''}>Allisteria</option><option value="boune" ${p.server === 'boune' ? 'selected' : ''}>Boune</option></select></label>
              <label class="field"><span>Paiement</span><select data-k="method">${Object.entries(METHODS).map(([k, l]) => `<option value="${k}" ${p.method === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
            <label class="field"><span>Forcer un prix (€ / million)</span><input type="number" data-k="rateOverride" value="${esc(p.rateOverride)}" step="0.001" min="0" placeholder="vide = prix ventekamas"></label>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('card')} Coûts du compte</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            <div class="grid-2">${num('abo', 'Abonnement (€ / semaine)', 'min="0" step="0.01"')}${num('fees', 'Frais paysafecard (%)', 'min="0" step="0.5"')}</div>
            <div class="grid-2">${num('cert', 'Certification (€)', 'min="0" step="0.01"')}${num('mail', 'Mail (€)', 'min="0" step="0.01"')}</div>
            ${num('commission', 'Commission prélevée (%)', 'min="0" max="100" step="0.5"', 'laisse 0 si tu ne prends rien')}
          </div></section>
        </div>
        <div id="c-out"></div>
      </div>
    </div>`;

    $$('[data-k]', root).forEach(el => (el.oninput = el.onchange = () => {
      const k = el.dataset.k, v = el.type === 'number' || el.type === 'range' ? (el.value === '' ? (k === 'rateOverride' ? '' : 0) : +el.value) : el.value;
      if (k.startsWith('prices.')) p.prices[k.slice(7)] = v; else p[k] = v;
      if (k === 'winrate') $('#wr-v', root).textContent = v + ' %';
      save(); out(root);
    }));
    $('#c-refresh', root).onclick = () => { rates = null; loadRates(true); UI.toast('Prix du kamas rechargé.', 'ok'); };
    $('#c-reset', root).onclick = () => { p = structuredClone(DEFAULTS); save(); App.render(); };
    out(root);
  }

  function out(root) {
    const el = $('#c-out', root); if (!el) return;
    const src = $('#rate-src', root);
    if (src) src.innerHTML = !rates ? 'chargement…' : rates.live ? `<span class="ok">● en direct</span> ${new Date(rates.generated).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : `<span class="warn" title="Le relais /api/kamas-rates n’est pas encore branché">relevé du ${new Date(rates.generated).toLocaleDateString('fr-FR')}</span>`;
    if (!rates) { el.innerHTML = '<div class="muted">Chargement du prix du kamas…</div>'; return; }
    const r = compute();
    const srv = p.server === 'boune' ? 'Boune' : 'Allisteria';
    const spend = bestSpend(Math.max(0, Math.min(5000, Math.floor(p.stock || 0))), r.scrolls);
    const sens = [30, 40, 50, 60, 70].map(w => ({ w, r: compute({ ...p, winrate: w }) }));
    const days30 = Array.from({ length: 30 }, (_, i) => i + 1);

    const both = ['allisteria', 'boune'].map(id => ({ id, name: id === 'boune' ? 'Boune' : 'Allisteria', r: compute({ ...p, server: id, rateOverride: '' }) }));
    const hrs = hist?.points || [];
    const range = id => { const s = hrs.map(x => x.prices.find(y => y.server === id)?.[p.method]).filter(v => v != null); return s.length ? [Math.min(...s), Math.max(...s)] : null; };
    const f2 = v => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
    el.innerHTML = `
      ${priceBlock()}

      <section class="card" style="margin-bottom:14px"><div class="card-h"><h3>${icon('code')} Détail du calcul</h3><span class="sub">1 compte, 1 jour, ${srv}</span></div>
        <div class="card-b mono" style="line-height:2;font-size:12.5px">
          ${nf(p.matchs)} combats × ${p.winrate} % = <b>${f2(r.winsDay)} victoires</b><br>
          ${f2(r.winsDay)} victoires × ${f2(p.pevPerWin)} Pévéton = <b>${f2(r.pevDay)} Pévétons</b><br>
          ${f2(r.pevDay)} Pévétons ÷ ${r.used.cost} = <b>${f2(r.parchDay)} ${r.used.name.toLowerCase()}${r.parchDay >= 2 ? 's' : ''}</b><br>
          ${f2(r.parchDay)} × ${nf(r.used.price)} kamas × ${f2(1 - p.hdvTax / 100)} (taxe HDV ${p.hdvTax} %) = <b style="color:var(--yellow)">${kam(r.kamasDay)}</b><br>
          ${kam(r.kamasDay)} ÷ 1 000 000 × ${r.rate.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} € = <b class="ok">${eur(r.brutDay)} brut</b><br>
          ${eur(r.brutDay)} − abonnement ${eur(r.aboDay)} / jour (${eur(p.abo)} / sem. + ${p.fees} %)${p.commission ? ` − commission ${p.commission} %` : ''} = <b class="${r.profitDay >= 0 ? 'ok' : 'err'}">${eur(r.profitDay)} de profit</b>
        </div></section>

      <section class="card" style="margin-bottom:14px"><div class="card-h"><h3>${icon('globe')} Allisteria ou Boune ?</h3><span class="sub">mêmes réglages, prix ventekamas du moment (${METHODS[p.method]})</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Serveur</th><th>€ / million</th><th>€ / Pévéton</th><th>Brut / jour / compte</th><th>Profit / jour (flotte)</th><th>Profit / 30 jours</th><th>Fourchette 30 j selon fluctuation</th></tr></thead><tbody>
        ${both.map(b => { const rg = range(b.id); const at = v => compute({ ...p, server: b.id, rateOverride: v }).month; return `<tr class="${p.server === b.id ? 'sel' : ''}">
          <td><b>${b.name}</b></td><td>${b.r.rate.toLocaleString('fr-FR', { minimumFractionDigits: 3 })} €</td><td>${eur4(b.r.used.eurPerPev)}</td><td>${eur(b.r.brutDay)}</td>
          <td class="${b.r.fleetDay >= 0 ? 'ok' : 'err'}"><b>${eur(b.r.fleetDay)}</b></td><td class="${b.r.month >= 0 ? 'ok' : 'err'}"><b>${eur(b.r.month)}</b></td>
          <td class="muted">${rg ? `${eur(at(rg[0]))} → ${eur(at(rg[1]))}` : '—'}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="card-b muted" style="font-size:12px;padding-top:8px">La fourchette recalcule le profit sur 30 jours au prix le plus bas et le plus haut vus sur la période choisie au-dessus.</div></section>

      <div class="explain" style="margin-bottom:14px">${icon('info')}<div>Au prix du jour sur <b>${srv}</b> (${p.rateOverride ? 'prix forcé' : METHODS[p.method]}) : <b>1 million de kamas = ${r.rate.toLocaleString('fr-FR', { maximumFractionDigits: 3 })} €</b>.
        Le parchemin le plus rentable est le <b>${r.best.name.toLowerCase()}</b> : ${nf(Math.round(r.best.perPev))} kamas par Pévéton${r.used.id !== r.best.id ? ` — tu as choisi le ${r.used.name.toLowerCase()}, ${Math.round((1 - r.used.perPev / r.best.perPev) * 100)} % de moins` : ''}.</div></div>

      <section class="card"><div class="card-h"><h3>${icon('scroll')} Valeur d’un Pévéton selon le parchemin</h3><span class="sub">prix net après taxe HDV ${p.hdvTax} %</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Parchemin</th><th>Coût</th><th>Prix</th><th>Kamas / Pévéton</th><th>€ / Pévéton</th><th style="width:30%"></th></tr></thead><tbody>
        ${r.scrolls.slice().sort((a, b) => b.perPev - a.perPev).map(s => `<tr class="${s.id === r.used.id ? 'sel' : ''}"><td><b>${s.name}</b> ${s.id === r.best.id ? '<span class="tag green">le plus rentable</span>' : ''}</td><td>${s.cost} pév.</td><td>${kam(s.price)}</td>
          <td><b>${nf(Math.round(s.perPev))}</b></td><td>${eur4(s.eurPerPev)}</td><td><div class="hb-t"><span style="width:${s.perPev / r.best.perPev * 100}%;background:var(--s1)"></span></div></td></tr>`).join('')}
        </tbody></table></div></section>

      ${r.life ? `<div class="section-title" style="margin-top:16px">Par compte (vie complète : ${nf(p.maxWins)} victoires)</div>
      <div class="stats">
        <div class="stat"><div class="v">${days(r.life.days)}</div><div class="k">Durée de vie du compte</div><div class="delta muted">${nf(Math.round(r.winsDay))} victoires / jour</div></div>
        <div class="stat"><div class="v ok">${eur(r.life.brut)}</div><div class="k">Brut total / compte</div></div>
        <div class="stat"><div class="v warn">${eur(r.life.costs + r.life.comm)}</div><div class="k">Coûts / compte</div><div class="delta muted">${r.life.weeks} sem. d’abo + cert + mail${p.commission ? ' + commission' : ''}</div></div>
        <div class="stat"><div class="v ${r.life.profit >= 0 ? 'ok' : 'err'}">${eur(r.life.profit)}</div><div class="k">Profit final / compte</div><div class="delta ${r.life.profit >= 0 ? 'ok' : 'err'}">${r.life.profit >= 0 ? '✓ rentable' : '✗ pas rentable'}</div></div>
      </div>` : ''}

      <div class="section-title" style="margin-top:16px">Par jour (1 compte)</div>
      <div class="stats">
        <div class="stat"><div class="v">${nf(Math.round(r.winsDay))}</div><div class="k">Victoires / jour</div><div class="delta muted">${nf(p.matchs)} combats × ${p.winrate} %</div></div>
        <div class="stat"><div class="v accent">${nf(Math.round(r.pevDay))}</div><div class="k">Pévétons / jour</div><div class="delta muted">≈ ${r.parchDay.toFixed(1).replace('.', ',')} ${r.used.name.toLowerCase()}${r.parchDay >= 2 ? 's' : ''}</div></div>
        <div class="stat"><div class="v" style="color:var(--yellow)">${kam(r.kamasDay)}</div><div class="k">Kamas / jour</div></div>
        <div class="stat"><div class="v ok">${eur(r.brutDay)}</div><div class="k">Brut / jour</div></div>
        <div class="stat"><div class="v ${r.profitDay >= 0 ? 'ok' : 'err'}">${eur(r.profitDay)}</div><div class="k">Profit / jour</div><div class="delta muted">après abo ${eur(r.aboDay)}/j${p.commission ? ' et commission' : ''}</div></div>
      </div>

      <div class="section-title" style="margin-top:16px">Flotte totale (× ${nf(p.comptes)} comptes en parallèle)</div>
      <div class="stats">
        <div class="stat"><div class="v ok">${eur(r.brutDay * p.comptes)}</div><div class="k">Brut / jour</div><div class="delta muted">${nf(p.matchs * p.comptes)} combats / jour</div></div>
        <div class="stat"><div class="v ${r.fleetDay >= 0 ? 'ok' : 'err'}">${eur(r.fleetDay)}</div><div class="k">Profit / jour</div></div>
        <div class="stat"><div class="v ${r.month >= 0 ? 'ok' : 'err'}">${eur(r.month)}</div><div class="k">Profit / 30 jours</div>${r.startup ? `<div class="delta muted">dont ${eur(r.startup)} de départ</div>` : ''}</div>
        <div class="stat"><div class="v ${r.year >= 0 ? 'ok' : 'err'}">${eur(r.year)}</div><div class="k">Profit / an</div></div>
        ${r.life ? `<div class="stat"><div class="v">${r.consumedMonth.toFixed(1).replace('.', ',')}</div><div class="k">Comptes consommés / mois</div><div class="delta muted">1 compte dure ${days(r.life.days)}</div></div>` : ''}
      </div>

      <div class="chart-grid" style="margin-top:2px">
        <section class="card"><div class="card-h"><h3>${icon('activity')} 30 jours de flotte</h3><span class="sub">€ cumulés</span><div class="right">${Charts.legend([{ name: 'Brut', color: 'var(--s1)' }, { name: 'Coûts', color: 'var(--s2)' }])}</div></div><div class="card-b"><div class="chart" id="c-chart"></div>
          <div class="muted" style="font-size:12px;margin-top:6px">L’écart entre les deux courbes est ton profit : ${eur(r.month)} sur 30 jours.</div></div></section>
        <section class="card"><div class="card-h"><h3>${icon('swords')} Et si le winrate change ?</h3><span class="sub">flotte de ${nf(p.comptes)} comptes</span></div>
          <div class="table-wrap"><table class="t"><thead><tr><th>Winrate</th><th>Pévétons / j</th><th>Profit / jour</th><th>Profit / mois</th></tr></thead><tbody>
          ${sens.map(({ w, r: x }) => `<tr class="${w === Math.round(p.winrate / 10) * 10 ? 'sel' : ''}"><td><b>${w} %</b></td><td>${nf(Math.round(x.pevDay * p.comptes))}</td><td class="${x.fleetDay >= 0 ? 'ok' : 'err'}">${eur(x.fleetDay)}</td><td class="${x.month >= 0 ? 'ok' : 'err'}">${eur(x.month)}</td></tr>`).join('')}
          </tbody></table></div></section>
      </div>

      <section class="card" style="margin-top:14px"><div class="card-h"><h3>${icon('bag')} J’ai des Pévétons : que prendre ?</h3></div><div class="card-b" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center">
        <label class="field" style="width:160px"><span>Pévétons en stock</span><input type="number" id="c-stock" value="${p.stock}" min="0" max="5000"></label>
        <div style="flex:1;min-width:260px">${spend.count.some(Boolean) ? r.scrolls.map((s, i) => spend.count[i] ? `<span class="tag accent" style="margin:2px">${spend.count[i]} × ${s.name}</span>` : '').join('') + (spend.left ? ` <span class="muted">+ ${spend.left} Pévéton${spend.left > 1 ? 's' : ''} restant${spend.left > 1 ? 's' : ''}</span>` : '') : '<span class="muted">Pas assez de Pévétons.</span>'}
          <div style="margin-top:8px">= <b style="color:var(--yellow)">${kam(spend.kamas)}</b> net · <b class="ok">${eur(spend.kamas / 1e6 * r.rate)}</b></div></div>
      </div></section>

      <section class="card" style="margin-top:14px"><div class="card-h"><h3>${icon('file')} Résumé</h3><div class="right"><button class="btn sm" id="c-copy">${icon('copy')} Copier</button></div></div>
        <div class="card-b" id="c-sum" style="white-space:pre-line;color:var(--text-2)">${esc(summary(r, srv))}</div></section>`;

    const ch = $('#c-chart', el);
    const draw = () => document.body.contains(ch) ? Charts.line(ch, {
      labels: days30.map(d => 'J' + d), fmt: v => Charts.short(v) + ' €',
      series: [{ name: 'Brut', color: 'var(--s1)', values: days30.map(d => r.brutDay * p.comptes * d) },
        { name: 'Coûts', color: 'var(--s2)', values: days30.map(d => (r.brutDay * p.comptes - r.fleetDay) * d + r.startup) }],
    }) : removeEventListener('resize', draw);
    draw(); addEventListener('resize', draw);
    drawPrices(el);
    $$('[data-use]', el).forEach(b => b.onclick = () => { p.server = b.dataset.use; save(); App.render(); });
    $$('[data-hd]', el).forEach(b => b.onclick = () => { histDays = +b.dataset.hd; hist = null; loadRates(true); });
    const stock = $('#c-stock', el);
    stock.onchange = () => { p.stock = +stock.value; save(); out(root); };
    $('#c-copy', el).onclick = () => navigator.clipboard?.writeText($('#c-sum', el).textContent).then(() => UI.toast('Résumé copié.', 'ok'));
  }

  function summary(r, srv) {
    return `Avec ${nf(p.matchs)} combats/jour et ${p.winrate} % de winrate, un bot gagne ${nf(Math.round(r.winsDay))} combats/jour, soit ${nf(Math.round(r.pevDay))} Pévétons/jour.
Échangés contre des ${r.used.name.toLowerCase()}s (${nf(Math.round(r.used.perPev))} kamas par Pévéton après taxe HDV), cela fait ${kam(r.kamasDay)} par jour.
Au prix du kamas sur ${srv} (${r.rate.toLocaleString('fr-FR')} € le million) : ${eur(r.brutDay)} brut par jour et par compte.
${r.life ? `Un compte dure ${days(r.life.days)} (${nf(p.maxWins)} victoires) : ${eur(r.life.brut)} brut, ${eur(r.life.costs + r.life.comm)} de coûts, ${eur(r.life.profit)} de profit.\n` : ''}Avec ${nf(p.comptes)} comptes en parallèle : ${eur(r.fleetDay)} de profit par jour, ${eur(r.month)} par mois, ${eur(r.year)} par an.`;
  }

  return { render };
})();
