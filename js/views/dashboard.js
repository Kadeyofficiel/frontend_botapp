/* Tableau de bord : vue d'ensemble, événements, console et commandes vers les sessions cochées. */
window.Views = window.Views || {};
Views.dashboard = (function () {
  const { $, $$, esc, time, ago, options } = UI;
  const st = { filter: 'all', script: '1to60', fight: 'defaut', cmd: '', hist: [], hIdx: -1 };

  function render(root, { sel }) {
    const S = Api.state;
    const sessionScripts = S.scripts.session.filter(s => !s.template && s.ok).map(s => s.file.replace(/\.js$/, ''));
    const fightScripts = S.scripts.fight.filter(s => !s.template && s.ok).map(s => s.file.replace(/\.js$/, ''));
    if (!sessionScripts.includes(st.script)) st.script = sessionScripts[0];
    if (!fightScripts.includes(st.fight)) st.fight = fightScripts[0];
    const okPx = S.proxies.filter(p => p.state === 'ok' && p.enabled).length;
    const alerts = S.events.filter(e => e.kind === 'err').length;
    const running = S.sessions.filter(s => s.scriptRunning).length;
    const ids = [...sel];
    const names = ids.map(id => Api.helpers.acc(Api.state.sessions.find(s => s.id === id).accountId).character?.name);
    const logs = S.console.filter(l => st.filter === 'all' || l[1] === st.filter);

    root.innerHTML = `<div class="dash">
      <div class="kpis">
        <a class="stat click" href="#/comptes"><div class="v ok">${S.sessions.length}</div><div class="k">Sessions en jeu · ${S.accounts.length} comptes</div></a>
        <div class="stat"><div class="v accent">${running}</div><div class="k">Scripts qui tournent</div></div>
        <a class="stat click" href="#/proxies"><div class="v ${okPx ? '' : 'warn'}">${okPx}<span class="muted" style="font-size:14px"> / ${S.proxies.length}</span></div><div class="k">Proxies prêts</div></a>
        <div class="stat"><div class="v ${alerts ? 'err' : ''}">${alerts}</div><div class="k">Alertes à regarder</div></div>
      </div>

      <section class="card">
        <div class="card-h"><h3>${icon('bell')} Événements</h3><span class="sub">connexions, alertes, proxies, comptes</span>
          <div class="right"><button class="btn-ghost sm" id="ev-clear">Vider</button></div></div>
        <div class="scroll events" data-keep-scroll="events">
          ${S.events.length ? [...S.events].reverse().map(e => `<div class="ev ${e.kind}"><div class="ic-wrap">${icon(e.icon)}</div>
            <div style="min-width:0;flex:1"><div class="t1">${esc(e.text)}</div>${e.sub ? `<div class="t2">${esc(e.sub)}</div>` : ''}</div>
            <span class="t2" title="${time(e.t)}">${ago(e.t)}</span></div>`).join('')
          : UI.empty('bell', 'Rien pour l’instant', 'Les connexions, déconnexions et alertes s’afficheront ici.')}
        </div>
      </section>

      <section class="card">
        <div class="card-h"><h3>${icon('terminal')} Console</h3>
          <div class="filters">${[['all', 'Tout'], ['script', 'Scripts'], ['combat', 'Combats'], ['info', 'Infos']].map(([k, l]) => `<button class="chip ${st.filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
          <div class="right"><button class="btn-ghost sm" id="co-clear">Vider</button></div></div>
        <div class="scroll log" data-keep-scroll="console">
          ${logs.map(l => `<div class="l"><span class="ts">${time(l[0])}</span><span class="src ${l[1]}">${l[1]}</span><span>${esc(l[2])}</span></div>`).join('') || '<div class="muted">Console vide.</div>'}
        </div>
      </section>

      <section class="card cmdbar">
        <div class="cmd-target">${icon(ids.length ? 'check' : 'info')}
          ${ids.length ? `Les actions ci-dessous s’appliquent à <b>${ids.length} session${ids.length > 1 ? 's' : ''}</b> : ${esc(names.join(', '))}`
          : S.sessions.length ? 'Coche une ou plusieurs sessions dans la colonne de gauche : les actions ci-dessous s’appliqueront à elles.'
          : 'Aucune session en ligne : connecte un compte depuis <a href="#/comptes">Comptes</a>.'}
          <button class="btn-danger sm" id="stop-all" style="margin-left:auto" ${S.sessions.length ? '' : 'disabled'} title="Arrête le script de toutes les sessions, cochées ou non">${icon('stop')} Tout arrêter</button>
        </div>
        <div class="cmd-row">
          <span class="label" title="Ce que fait le personnage en jeu">${icon('play')} Script de session</span>
          <select id="d-script">${options(sessionScripts, st.script)}</select>
          <div class="btn-row">
            <button class="btn-success sm" data-a="start" ${ids.length ? '' : 'disabled'}>${icon('play')} Démarrer</button>
            <button class="btn sm" data-a="stop" ${ids.length ? '' : 'disabled'}>${icon('stop')} Arrêter</button>
            <button class="btn sm" data-a="reload" ${ids.length ? '' : 'disabled'} title="Relit le fichier et redémarre le script">${icon('refresh')} Recharger</button>
            <button class="btn-ghost sm" data-a="status" ${ids.length ? '' : 'disabled'} title="Affiche l'état dans la console">${icon('info')} État</button>
          </div>
        </div>
        <div class="cmd-row">
          <span class="label" title="Comment le personnage joue ses combats">${icon('swords')} Script de combat</span>
          <select id="d-fight">${options(fightScripts, st.fight)}</select>
          <div class="btn-row">
            <button class="btn-primary sm" data-a="fload" ${ids.length ? '' : 'disabled'}>${icon('upload')} Charger</button>
            <button class="btn sm" data-a="funload" ${ids.length ? '' : 'disabled'}>${icon('x')} Retirer</button>
            <button class="btn sm" data-a="freload" ${ids.length ? '' : 'disabled'}>${icon('refresh')} Recharger</button>
            <button class="btn-ghost sm" data-a="fstatus" ${ids.length ? '' : 'disabled'}>${icon('info')} État</button>
          </div>
        </div>
        <div class="cmd-row" style="grid-template-columns:150px 1fr">
          <span class="label">${icon('terminal')} Commande</span>
          <div class="cmd-input"><span class="prompt">›</span>
            <input type="text" id="d-cmd" value="${esc(st.cmd)}" placeholder="Une commande .bot pour les sessions cochées (ex. .bot script info) — ↑ ↓ : historique" autocomplete="off">
            <button class="btn-primary" id="d-send">${icon('send')} Envoyer</button></div>
        </div>
      </section>
    </div>`;

    const scr = $('#d-script', root), fgt = $('#d-fight', root);
    scr.onchange = () => st.script = scr.value; fgt.onchange = () => st.fight = fgt.value;
    $$('[data-f]', root).forEach(b => b.onclick = () => { st.filter = b.dataset.f; App.render(); });
    $('#ev-clear', root).onclick = () => Api.clearEvents();
    $('#co-clear', root).onclick = () => Api.clearConsole();
    $('#stop-all', root).onclick = async e => { if (await UI.confirm({ title: 'Tout arrêter ?', text: 'Le script de <b>toutes</b> les sessions s’arrête. Les personnages restent connectés.', ok: 'Tout arrêter', danger: true })) UI.run(e.target, () => Api.sessions.stopAll(), 'Tous les scripts sont arrêtés.'); };
    const A = Api.sessions;
    const acts = {
      start: () => A.startScript(ids, st.script), stop: () => A.stopScript(ids), reload: () => A.reloadScript(ids), status: () => A.scriptStatus(ids),
      fload: () => A.loadFight(ids, st.fight), funload: () => A.unloadFight(ids), freload: () => A.reloadFight(ids), fstatus: () => A.fightStatus(ids),
    };
    $$('[data-a]', root).forEach(b => b.onclick = () => UI.run(b, acts[b.dataset.a]).catch(() => {}));
    const cmd = $('#d-cmd', root);
    const send = () => { const v = cmd.value.trim(); if (!v) return; st.hist.push(v); st.hIdx = -1; st.cmd = ''; UI.run(null, () => A.command(ids, v)).catch(() => {}); cmd.value = ''; };
    cmd.oninput = () => st.cmd = cmd.value;
    cmd.onkeydown = e => {
      if (e.key === 'Enter') send();
      if (e.key === 'ArrowUp' && st.hist.length) { st.hIdx = st.hIdx < 0 ? st.hist.length - 1 : Math.max(0, st.hIdx - 1); cmd.value = st.cmd = st.hist[st.hIdx]; e.preventDefault(); }
      if (e.key === 'ArrowDown' && st.hIdx >= 0) { st.hIdx++; if (st.hIdx >= st.hist.length) { st.hIdx = -1; cmd.value = st.cmd = ''; } else cmd.value = st.cmd = st.hist[st.hIdx]; e.preventDefault(); }
    };
    $('#d-send', root).onclick = send;
  }
  return { render };
})();
