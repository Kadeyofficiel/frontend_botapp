/* Statistiques : kamas, XP, combats, ressources, temps de jeu — globales ou par bot.
   Utilisé aussi dans l'onglet « Stats » de la vue Bot (renderInto). */
window.Views = window.Views || {};
Views.stats = (function () {
  const { $, $$, esc, nf, options } = UI;
  const st = { period: '7d', bot: '' };
  const cache = new Map(); // évite de recharger à chaque rafraîchissement (30 s)
  const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)'];
  const PERIODS = { '24h': '24 h', '7d': '7 jours', '30d': '30 jours' };
  const sum = a => a.reduce((x, y) => x + y, 0);
  const hours = m => m >= 60 ? Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0') : m + ' min';

  // Appelle cb tout de suite si les données sont en cache (pas de clignotement), sinon après chargement.
  const load = (period, ids) => ({
    then(cb) {
      const key = period + '|' + ids.join(','), c = cache.get(key);
      if (c && Date.now() - c.t < 30000) return cb(c.d);
      Api.stats.get({ period, sessionIds: ids }).then(d => { cache.set(key, { t: Date.now(), d }); cb(d); }).catch(e => UI.toast(e.message, 'err'));
    },
  });

  function render(root) {
    const S = Api.state;
    const bots = S.sessions.map(s => ({ id: s.id, name: Api.helpers.acc(s.accountId).character?.name }));
    if (st.bot && !bots.find(b => b.id === st.bot)) st.bot = '';
    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('activity')} Statistiques</h1><p>Ce que rapportent tes bots : kamas, expérience, combats, récoltes et temps de jeu.</p></div>
        <div class="right">
          <div class="seg">${Object.entries(PERIODS).map(([k, l]) => `<button data-p="${k}" class="${st.period === k ? 'on' : ''}">${l}</button>`).join('')}</div>
          <select id="st-bot" style="width:190px"><option value="">Tous les bots (${bots.length})</option>${bots.map(b => `<option value="${b.id}" ${st.bot === b.id ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select>
          <button class="btn" id="st-csv">${icon('download')} Exporter (CSV)</button>
        </div>
      </div>
      <div id="st-body">${bots.length ? '<div class="muted">Chargement…</div>' : UI.empty('activity', 'Aucun bot en jeu', 'Les statistiques apparaissent dès qu’un compte est connecté.', '<a class="btn-primary" href="#/comptes">Connecter un compte</a>')}</div>
    </div>`;
    $$('[data-p]', root).forEach(b => b.onclick = () => { st.period = b.dataset.p; App.render(); });
    $('#st-bot', root).onchange = e => { st.bot = e.target.value; App.render(); };
    if (!bots.length) return;
    const ids = st.bot ? [st.bot] : [];
    load(st.period, ids).then(d => { const body = $('#st-body', root); if (body) fill(body, d, { showTable: true }); $('#st-csv', root).onclick = () => csv(d); });
  }

  /** Onglet Stats de la vue Bot. */
  function renderInto(el, sessionId) {
    el.innerHTML = `<div class="bot-pane"><div class="toolbar"><div class="seg">${Object.entries(PERIODS).map(([k, l]) => `<button data-p="${k}" class="${st.period === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <a class="btn-ghost sm" href="#/stats" style="margin-left:auto">${icon('activity')} Toutes les statistiques</a></div><div id="st-body"><div class="muted">Chargement…</div></div></div>`;
    $$('[data-p]', el).forEach(b => b.onclick = () => { st.period = b.dataset.p; App.render(); });
    load(st.period, [sessionId]).then(d => { const body = $('#st-body', el); if (body) fill(body, d, { showTable: false }); });
  }

  function fill(body, d, { showTable }) {
    const B = d.bots, hourly = st.period === '24h';
    const tot = k => sum(B.map(b => sum(b[k])));
    const won = tot('won'), lost = tot('lost'), kamas = tot('kamas'), xp = tot('xp');
    const play = sum(B.map(b => b.playMin));
    const resAll = {}; B.forEach(b => Object.entries(b.resources).forEach(([r, v]) => resAll[r] = (resAll[r] || 0) + v));
    const resTotal = sum(Object.values(resAll));
    // ≤ 3 bots : une couleur par bot (palette validée). Au-delà : total sur une seule série, détail dans le tableau.
    const perBot = B.length > 1 && B.length <= 3;
    const series = key => perBot ? B.map((b, i) => ({ name: b.name, color: SERIES[i], values: b[key] }))
      : [{ name: B.length === 1 ? B[0].name : 'Tous les bots', color: SERIES[0], values: d.labels.map((_, i) => sum(B.map(b => b[key][i]))) }];
    const unit = hourly ? 'par heure' : 'par jour';

    body.innerHTML = `
      <div class="stats">
        <div class="stat"><div class="v" style="color:var(--yellow)">${Charts.short(kamas)}</div><div class="k">Kamas gagnés</div></div>
        <div class="stat"><div class="v">${play ? Charts.short(Math.round(kamas / (play / 60))) : 0}</div><div class="k">Kamas / heure de jeu</div></div>
        <div class="stat"><div class="v accent">${Charts.short(xp)}</div><div class="k">Expérience gagnée</div></div>
        <div class="stat"><div class="v">${won}<small> / ${lost}</small></div><div class="k">Combats gagnés / perdus</div>
          <div class="delta ${won + lost && lost / (won + lost) > .1 ? 'warn' : 'ok'}">${won + lost ? Math.round(won / (won + lost) * 100) : 0} % de victoires</div></div>
        <div class="stat"><div class="v">${Charts.short(resTotal)}</div><div class="k">Ressources récoltées</div></div>
        <div class="stat"><div class="v">${hours(play)}</div><div class="k">Temps de jeu cumulé</div></div>
      </div>
      <div class="chart-grid">
        <section class="card"><div class="card-h"><h3>${icon('coins')} Kamas gagnés</h3><span class="sub">${unit}</span><div class="right">${Charts.legend(series('kamas'))}</div></div><div class="card-b"><div class="chart" id="ch-kamas"></div></div></section>
        <section class="card"><div class="card-h"><h3>${icon('star')} Expérience gagnée</h3><span class="sub">${unit}</span><div class="right">${Charts.legend(series('xp'))}</div></div><div class="card-b"><div class="chart" id="ch-xp"></div></div></section>
        <section class="card"><div class="card-h"><h3>${icon('swords')} Combats</h3><span class="sub">${unit}</span><div class="right">${Charts.legend([{ name: 'Victoires', color: SERIES[0] }, { name: 'Défaites', color: SERIES[1] }])}</div></div><div class="card-b"><div class="chart" id="ch-fights"></div></div></section>
        <section class="card"><div class="card-h"><h3>${icon('layers')} Ressources récoltées</h3><span class="sub">les 8 premières</span></div><div class="card-b"><div id="ch-res"></div></div></section>
      </div>
      ${showTable ? `<section class="card" style="margin-top:14px"><div class="card-h"><h3>${icon('bot')} Par bot</h3><span class="sub">sur ${PERIODS[st.period]}</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Personnage</th><th>Niv.</th><th>Kamas</th><th>Kamas / h</th><th>XP</th><th>Combats V / D</th><th>Victoires</th><th>Ressources</th><th>Temps de jeu</th><th></th></tr></thead><tbody>
        ${B.map(b => { const w = sum(b.won), l = sum(b.lost), k = sum(b.kamas); return `<tr>
          <td class="cell-main">${esc(b.name)}</td><td>${b.level ?? '—'}</td><td style="color:var(--yellow)">${nf(k)}</td>
          <td>${nf(Math.round(k / Math.max(1, b.playMin / 60)))}</td><td>${nf(sum(b.xp))}</td><td>${w} / ${l}</td>
          <td><span class="tag ${w + l && l / (w + l) > .1 ? 'yellow' : 'green'}">${w + l ? Math.round(w / (w + l) * 100) : 0} %</span></td>
          <td>${nf(sum(Object.values(b.resources)))}</td><td>${hours(b.playMin)}</td>
          <td class="actions"><a class="btn sm" href="#/bot/${b.id}">${icon('eye')} Voir</a></td></tr>`; }).join('')}
        </tbody></table></div></section>` : ''}`;

    const draw = () => {
      if (!document.body.contains(body)) return removeEventListener('resize', draw);
      Charts.line($('#ch-kamas', body), { series: series('kamas'), labels: d.labels });
      Charts.bars($('#ch-xp', body), { stacks: series('xp'), labels: d.labels });
      Charts.bars($('#ch-fights', body), { stacks: [{ name: 'Victoires', color: SERIES[0], values: d.labels.map((_, i) => sum(B.map(b => b.won[i]))) }, { name: 'Défaites', color: SERIES[1], values: d.labels.map((_, i) => sum(B.map(b => b.lost[i]))) }], labels: d.labels, fmt: v => String(Math.round(v)) });
      Charts.hbars($('#ch-res', body), { rows: Object.entries(resAll).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label, value })), color: SERIES[2] });
    };
    draw();
    addEventListener('resize', draw);
  }

  function csv(d) {
    const rows = [['tranche', 'personnage', 'kamas', 'xp', 'victoires', 'defaites']];
    d.bots.forEach(b => d.labels.forEach((l, i) => rows.push([l, b.name, b.kamas[i], b.xp[i], b.won[i], b.lost[i]])));
    const blob = new Blob(['﻿' + rows.map(r => r.join(';')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bothors-stats-' + st.period + '.csv'; a.click();
  }

  return { render, renderInto };
})();
