/* Comptes Ankama : liste, connexion, script par compte, personnage, abonnement, création en masse. */
window.Views = window.Views || {};
Views.accounts = (function () {
  const { $, $$, esc, time, options } = UI;
  const st = { q: '', sel: new Set(), email: '', regN: 1, regShield: true, bulkScript: '' };
  const A = () => Api.accounts;

  const subCell = a => a.sub.state === 'active'
    ? `<span class="tag green">${a.sub.days} j ${a.sub.hours ? a.sub.hours + ' h' : ''}</span><div class="cell-sub nowrap">jusqu’au ${esc(a.sub.until)}</div>`
    : `<span class="tag" title="Connu à sa prochaine connexion">inconnu</span>`;
  const stateCell = a => ({
    offline: '<span class="pill"><i class="dot"></i>Hors ligne</span>',
    connecting: '<span class="pill pill-warn"><i class="dot"></i>Connexion…</span>',
    ingame: '<span class="pill pill-ok"><i class="dot"></i>En jeu</span>',
  })[a.state];

  function render(root) {
    const S = Api.state;
    const scripts = S.scripts.session.filter(s => !s.template && s.ok).map(s => s.file.replace(/\.js$/, ''));
    [...st.sel].forEach(id => { if (!S.accounts.find(a => a.id === id)) st.sel.delete(id); });
    const q = st.q.toLowerCase();
    const proxy = id => S.proxies.find(p => p.id === id);
    const list = S.accounts.filter(a => !q || [a.nick, a.tag, a.email, a.character?.name, proxy(a.proxyId)?.session].join(' ').toLowerCase().includes(q));
    const open = S.accounts.filter(a => a.state !== 'offline').length, ingame = S.accounts.filter(a => a.state === 'ingame').length;
    const reg = A().register;
    const n = st.sel.size;

    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('users')} Comptes</h1><p>${S.accounts.length} comptes · ${open} ouverts · ${ingame} en jeu</p></div>
        <div class="right">
          <label class="check" style="align-items:center" title="Nombre de comptes connectés en même temps quand tu en lances plusieurs">Connexions simultanées
            <input type="number" id="ac-batch" min="1" max="20" value="${A().batch}" style="width:64px"></label>
        </div>
      </div>
      ${UI.explain('accounts', `<b>Tes comptes Ankama</b>, connectés par le bot avec leur email et leur mot de passe. Le bot lance le jeu lui-même (sans client) et fait le jeton par le <b>proxy du compte</b> : la connexion vient de la même IP que le jeton, sinon Ankama la refuse.
        <ul><li>Choisis un <b>script</b> par compte : il démarre tout seul à la connexion.</li>
        <li>En mode « Un par client » (page Proxies), chaque compte garde son proxy ; s’ils sont tous pris, les connexions attendent une place.</li>
        <li>Le menu ${icon('more')} d’une ligne donne : boîte mail (codes Shield), proxy, téléphone, Shield, abonnement, retrait.</li></ul>`)}
      <div class="split">
        <div>
          <div class="toolbar">
            <div class="input-icon grow">${icon('search')}<input type="search" id="ac-q" placeholder="Rechercher : pseudo, email, proxy, personnage…   ( / )" value="${esc(st.q)}"></div>
            <span class="muted">${list.length} compte${list.length > 1 ? 's' : ''}</span>
          </div>
          ${n ? `<div class="bulkbar"><span class="n">${n} coché${n > 1 ? 's' : ''}</span>
            <button class="btn-success sm" id="bk-connect">${icon('play')} Connecter</button>
            <select id="bk-script"><option value="">— script —</option><option value="__none">sans script</option>${options(scripts, st.bulkScript)}</select>
            <button class="btn sm" id="bk-script-go">Appliquer le script</button>
            <button class="btn sm" id="bk-char">${icon('user')} Personnage…</button>
            <button class="btn-ghost sm" id="bk-clear" style="margin-left:auto">${icon('x')} Décocher</button></div>` : ''}
          <div class="card"><div class="table-wrap">
            ${S.accounts.length ? `<table class="t"><thead><tr>
              <th class="w-check"><input type="checkbox" id="ac-all" ${list.length && list.every(a => st.sel.has(a.id)) ? 'checked' : ''}></th>
              <th>Compte</th><th>Abonnement</th><th>Proxy</th><th>Script au démarrage</th><th>Personnage</th><th>État</th><th></th></tr></thead><tbody>
              ${list.map(a => { const p = proxy(a.proxyId); return `<tr class="${st.sel.has(a.id) ? 'sel' : ''}">
                <td><input type="checkbox" data-sel="${a.id}" ${st.sel.has(a.id) ? 'checked' : ''}></td>
                <td><div class="cell-main">${esc(a.nick)}<span class="muted">${esc(a.tag)}</span></div><div class="cell-sub">${esc(a.email)}</div>
                  <div style="margin-top:3px;display:flex;gap:4px">${a.phone ? '' : '<span class="tag yellow" title="Aucun numéro de téléphone sur le compte">sans téléphone</span>'}${a.certified ? '' : '<span class="tag red" title="Ankama Shield actif : un code arrive par email à chaque connexion">Shield actif</span>'}</div></td>
                <td>${subCell(a)}</td>
                <td>${p ? `<div class="mono" style="font-size:11px" title="${esc(p.host)}:${p.port}">${esc(p.session)}</div><div class="cell-sub">${p.latency ? p.latency + ' ms' : 'pas testé'}${p.tag ? ' · ' + esc(p.tag) : ''}</div>` : '<span class="muted">auto</span>'}</td>
                <td><select data-script="${a.id}"><option value="">sans script</option>${options(scripts, a.script)}</select></td>
                <td><button class="btn-ghost sm" data-char="${a.id}" title="Choisir quel personnage jouer à la connexion" style="height:auto!important;padding:4px 6px!important;text-align:left;display:block">
                  ${a.character ? `<span class="ok">${icon('swords')} ${esc(a.character.name)}</span><div class="cell-sub">${esc(a.character.server)} · ${a.charMode === 'last' ? 'dernier joué' : 'choisi à chaque fois'}</div>` : '<span class="muted">par défaut</span>'}</button></td>
                <td>${stateCell(a)}</td>
                <td class="actions">
                  ${a.state === 'offline' ? `<button class="btn-success sm" data-connect="${a.id}" title="Connexion sans client : jeton et connexion par son proxy, le bot joue sans ouvrir le jeu">${icon('play')} Connecter</button>`
                  : a.state === 'ingame' ? `<a class="btn sm" href="#/bot/se_${a.id}">${icon('eye')} Voir</a>` : ''}
                  <button class="icon-btn" data-more="${a.id}" title="Plus d’actions">${icon('more')}</button></td>
              </tr>`; }).join('')}</tbody></table>`
            : UI.empty('users', 'Aucun compte', 'Ajoute un compte Ankama avec le formulaire à droite, ou crées-en automatiquement.')}
          </div></div>
        </div>

        <div class="side-stack">
          <section class="card"><div class="card-h"><h3>${icon('plus')} Ajouter un compte</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:8px">
            <input type="text" id="ac-email" placeholder="email du compte Ankama" value="${esc(st.email)}" autocomplete="off">
            <input type="password" id="ac-pass" placeholder="mot de passe" autocomplete="new-password">
            <button class="btn-primary" id="ac-login">${icon('logout')} Se connecter</button>
            <div class="muted" style="font-size:12px">Connexion par le proxy du compte. Si Ankama demande un <b>code Shield</b>, il arrive par email : le bot le lit seul si la boîte mail est renseignée, sinon tape-le ici. Le mot de passe est gardé chiffré pour reconnecter le compte tout seul.</div>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('sparkles')} Créer des comptes</h3><span class="sub right">${S.registerSource.free} emails libres</span></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            ${reg.running ? `<div><div style="display:flex;justify-content:space-between;margin-bottom:6px"><b>Création en cours…</b><span>${reg.done} / ${reg.target}</span></div>
              <div class="progress"><div style="width:${reg.done / reg.target * 100}%"></div></div></div>
              <button class="btn-danger" id="reg-stop">${icon('stop')} Arrêter</button>`
            : `<div style="display:flex;gap:8px;align-items:center"><input type="number" id="reg-n" min="1" max="${S.registerSource.free}" value="${st.regN}" style="width:80px"><span>compte(s)</span>
              <button class="btn-primary" id="reg-go" style="margin-left:auto">Créer</button></div>
              <label class="check"><input type="checkbox" id="reg-shield" ${st.regShield ? 'checked' : ''}> Désactiver Ankama Shield sur chaque compte une fois créé</label>`}
            <div class="muted" style="font-size:12px">Un compte par email de la réserve (<code>email.txt</code>, <code>email:mot_de_passe</code>, un par ligne ; Gmail : mot de passe d’application). L’inscription passe par un proxy « pour créer des comptes » et la clé CapSolver des Réglages. Le mot de passe du compte est tiré au hasard et gardé.</div>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('history')} Journal</h3></div>
            <div class="events" style="max-height:260px;overflow:auto">${S.events.slice(-8).reverse().map(e => `<div class="ev ${e.kind}"><div class="ic-wrap">${icon(e.icon)}</div><div><div class="t1">${esc(e.text)}</div><div class="t2">${time(e.t)}</div></div></div>`).join('') || '<div class="card-b muted">Rien pour l’instant.</div>'}</div>
          </section>
        </div>
      </div>
    </div>`;

    mount(root, scripts);
  }

  function mount(root, scripts) {
    const S = Api.state, acc = Api.helpers.acc;
    $('#ac-batch', root).onchange = e => A().setBatch(+e.target.value || 1);
    const q = $('#ac-q', root); if (q) q.oninput = () => { st.q = q.value; App.render(); };
    $$('[data-sel]', root).forEach(cb => cb.onchange = () => { cb.checked ? st.sel.add(cb.dataset.sel) : st.sel.delete(cb.dataset.sel); App.render(); });
    const all = $('#ac-all', root); if (all) all.onchange = () => { $$('[data-sel]', root).forEach(cb => all.checked ? st.sel.add(cb.dataset.sel) : st.sel.delete(cb.dataset.sel)); App.render(); };
    $$('[data-script]', root).forEach(s => s.onchange = () => UI.run(null, () => A().setScript(s.dataset.script, s.value), 'Script enregistré : il démarrera à la prochaine connexion.'));
    $$('[data-connect]', root).forEach(b => b.onclick = () => connect([b.dataset.connect], b));
    $$('[data-char]', root).forEach(b => b.onclick = () => charDialog([b.dataset.char]));
    $$('[data-more]', root).forEach(b => b.onclick = () => moreMenu(b, acc(b.dataset.more)));

    const bc = $('#bk-connect', root); if (bc) {
      bc.onclick = () => connect([...st.sel], bc);
      $('#bk-script', root).onchange = e => st.bulkScript = e.target.value;
      $('#bk-script-go', root).onclick = e => { if (!st.bulkScript) return UI.toast('Choisis un script dans la liste.', 'warn'); const v = st.bulkScript === '__none' ? '' : st.bulkScript; UI.run(e.target, () => Promise.all([...st.sel].map(id => A().setScript(id, v))), 'Script appliqué aux comptes cochés.'); };
      $('#bk-char', root).onclick = () => charDialog([...st.sel]);
      $('#bk-clear', root).onclick = () => { st.sel.clear(); App.render(); };
    }

    const email = $('#ac-email', root); email.oninput = () => st.email = email.value;
    $('#ac-login', root).onclick = e => { const p = $('#ac-pass', root); UI.run(e.target, () => A().login(email.value.trim(), p.value), 'Compte ajouté.').then(() => { st.email = ''; App.render(); }).catch(() => {}); };
    $('#ac-pass', root).onkeydown = e => { if (e.key === 'Enter') $('#ac-login', root).click(); };
    const rn = $('#reg-n', root); if (rn) {
      rn.oninput = () => st.regN = +rn.value;
      $('#reg-shield', root).onchange = e => st.regShield = e.target.checked;
      $('#reg-go', root).onclick = e => UI.run(e.target, () => A().startRegister(st.regN, { disableShield: st.regShield })).catch(() => {});
    }
    const rs = $('#reg-stop', root); if (rs) rs.onclick = () => A().stopRegister();
  }

  function connect(ids, btn) {
    const S = Api.state;
    const need = ids.map(Api.helpers.acc).filter(a => a.charMode === 'ask' && a.state === 'offline');
    if (need.length === 1 && ids.length === 1) return pickDialog(need[0]);
    UI.run(btn, () => A().connect(ids, { noClient: true }), ids.length > 1 ? `Connexion de ${ids.length} comptes lancée (${A().batch} à la fois).` : null).catch(() => {});
  }

  function moreMenu(btn, a) {
    const S = Api.state, p = S.proxies.find(x => x.id === a.proxyId);
    UI.menu(btn, [
      { label: 'Boîte mail…', sub: a.mailbox || a.email + ' — le bot y lit les codes Shield', icon: 'mail', onClick: () => mailDialog(a) },
      { label: 'Proxy…', sub: p ? 'actuel : ' + p.host + ' (' + p.session + ')' : 'celui du mode Proxies', icon: 'globe', onClick: () => proxyDialog(a) },
      'sep',
      { label: 'Ajouter un numéro de téléphone', sub: 'numéro loué (clé SMS dans Réglages), vérifié par SMS', icon: 'phone', onClick: () => UI.run(null, () => A().addPhone(a.id), 'Téléphone ajouté.').catch(() => {}) },
      { label: 'Désactiver Ankama Shield', sub: 'plus de code Shield par email à chaque connexion', icon: 'shield', onClick: () => UI.run(null, () => A().disableShield(a.id), 'Shield désactivé.').catch(() => {}) },
      { label: 'Acheter un abonnement…', sub: 'pack DOFUS Retro, payé avec les codes PIN des Réglages', icon: 'card', onClick: () => subDialog(a) },
      'sep',
      { label: 'Retirer de Comptes', sub: 'sa clé est détruite chez Ankama : il faudra son mot de passe pour le remettre', icon: 'trash', danger: true, onClick: async () => { if (await UI.confirm({ title: 'Retirer ' + a.nick + a.tag + ' ?', text: 'Sa clé est détruite chez Ankama : pour le remettre, il faudra retaper son mot de passe.', ok: 'Retirer', danger: true })) UI.run(null, () => A().remove(a.id), 'Compte retiré.'); } },
    ]);
  }

  function charDialog(ids) {
    const S = Api.state, a = Api.helpers.acc(ids[0]);
    UI.modal({
      title: ids.length > 1 ? `Personnage · ${ids.length} comptes` : 'Personnage · ' + a.nick + a.tag, icon: 'user',
      body: `<div class="field"><span>À la connexion</span>
          <label class="check"><input type="radio" name="cm" value="last" ${a.charMode === 'last' ? 'checked' : ''}> <span><b>Jouer le dernier personnage joué</b>${a.character ? `<br><span class="muted">${esc(a.character.name)} · ${esc(a.character.server)}</span>` : ''}</span></label>
          <label class="check"><input type="radio" name="cm" value="ask" ${a.charMode === 'ask' ? 'checked' : ''}> <span><b>Choisir le serveur et le personnage à chaque connexion</b><br><span class="muted">une fenêtre s’ouvre au moment de connecter (une connexion de plusieurs comptes prend le dernier joué)</span></span></label></div>
        <div class="card" style="padding:12px;display:flex;flex-direction:column;gap:10px">
          <label class="check"><input type="checkbox" id="cd-create" ${a.createChar ? 'checked' : ''}> <b>Créer un personnage s’il n’en a aucun sur ce serveur</b></label>
          <div class="grid-2"><label class="field"><span>Serveur</span><select id="cd-server">${options(S.servers, a.createChar?.server)}</select></label>
          <label class="field"><span>Classe</span><select id="cd-breed">${options(S.breeds, a.createChar?.breed)}</select></label></div>
          <div class="field"><span>Sexe</span><div class="seg" id="cd-sex">${[['rnd', 'Au hasard'], ['m', 'Masculin'], ['f', 'Féminin']].map(([k, l]) => `<button type="button" data-v="${k}" class="${(a.createChar?.sex || 'rnd') === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
          <div class="muted" style="font-size:12px">Pour un compte sans personnage (un compte créé par le bot) : à sa prochaine connexion sans client, le bot crée le personnage puis le joue.</div>
        </div>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="cd-save">Enregistrer</button>',
      onMount: (m, close) => {
        $$('#cd-sex button', m).forEach(b => b.onclick = () => { $$('#cd-sex button', m).forEach(x => x.classList.remove('on')); b.classList.add('on'); });
        $('#cd-save', m).onclick = e => {
          const opts = { charMode: $('input[name=cm]:checked', m).value, createChar: $('#cd-create', m).checked ? { server: $('#cd-server', m).value, breed: $('#cd-breed', m).value, sex: $('#cd-sex .on', m).dataset.v } : null };
          UI.run(e.target, () => Promise.all(ids.map(id => A().setCharacter(id, opts))), 'Enregistré.').then(close);
        };
      },
    });
  }

  function pickDialog(a) {
    const S = Api.state;
    UI.modal({
      title: 'Connecter ' + a.nick + a.tag, icon: 'play',
      body: `<div class="grid-2"><label class="field"><span>Serveur</span><select id="pk-server">${options(S.servers, a.character?.server)}</select></label>
        <label class="field"><span>Personnage</span><select id="pk-char">${a.character ? options([a.character.name]) : '<option>— nouveau personnage —</option>'}</select></label></div>
        <div class="muted">Le bot se connecte sans client avec ce personnage.</div>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-success" id="pk-go">Se connecter</button>',
      onMount: (m, close) => $('#pk-go', m).onclick = e => { close(); UI.run(null, () => A().connect([a.id])).catch(() => {}); },
    });
  }

  function subDialog(a) {
    const S = Api.state;
    UI.modal({
      title: 'Abonnement · ' + a.nick + a.tag, icon: 'card',
      body: `<div class="grid-2"><label class="field"><span>Pack</span><select id="sb-pack"><option value="30j">1 mois — 30 jours</option><option value="7j">7 jours</option></select></label>
        <label class="field"><span>Quantité</span><select id="sb-qty">${options(['1', '2', '3', '4', '5'], '1')}</select></label></div>
        <div class="pill ${S.settings.pins.count ? 'pill-ok' : 'pill-err'}" style="align-self:flex-start">${icon('key')} ${S.settings.pins.count} code(s) PIN paysafecard disponible(s)</div>
        <div class="muted" style="font-size:12px">Le bot ouvre le site Ankama dans une fenêtre cachée (par un proxy « pour créer des comptes », jamais un proxy de jeu), choisit le pack et paie avec les codes PIN des Réglages.<br><b>Essai sans payer</b> : fait tout le chemin jusqu’à la page paysafecard et s’arrête là — aucun code tapé, rien payé.</div>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn" id="sb-test">Essai sans payer</button><button class="btn-primary" id="sb-go">Acheter et payer</button>',
      onMount: (m, close) => {
        const opts = dryRun => ({ pack: $('#sb-pack', m).value, qty: +$('#sb-qty', m).value, dryRun });
        $('#sb-test', m).onclick = e => UI.run(e.target, () => A().subscribe(a.id, opts(true)), 'Essai réussi : rien n’a été payé.').then(close).catch(() => {});
        $('#sb-go', m).onclick = async e => { if (await UI.confirm({ title: 'Payer l’abonnement ?', text: 'Un code PIN paysafecard sera utilisé. Cette action ne peut pas être annulée.', ok: 'Payer' })) UI.run(e.target, () => A().subscribe(a.id, opts(false)), 'Abonnement acheté.').then(close).catch(() => {}); };
      },
    });
  }

  function mailDialog(a) {
    UI.modal({
      title: 'Boîte mail · ' + a.nick + a.tag, icon: 'mail',
      body: `<label class="field"><span>Adresse lue pour les codes Shield</span><input type="text" id="mb" value="${esc(a.mailbox || a.email)}"></label>
        <label class="field"><span>Mot de passe de la boîte (IMAP)</span><input type="password" id="mbp" placeholder="laisser vide pour garder l’actuel"><span class="hint">Gmail / Outlook : utilise un « mot de passe d’application ».</span></label>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="mb-go">Enregistrer</button>',
      onMount: (m, close) => $('#mb-go', m).onclick = e => UI.run(e.target, () => A().setMailbox(a.id, $('#mb', m).value), 'Boîte mail enregistrée.').then(close),
    });
  }

  function proxyDialog(a) {
    const S = Api.state, game = S.proxies.filter(p => p.use === 'game' && p.enabled);
    UI.modal({
      title: 'Proxy · ' + a.nick + a.tag, icon: 'globe',
      body: `<label class="field"><span>Proxy de jeu du compte</span><select id="pp"><option value="">Automatique (mode de la page Proxies)</option>${game.map(p => `<option value="${p.id}" ${p.id === a.proxyId ? 'selected' : ''}>${esc(p.host)} (${esc(p.session)}) · ${p.latency || '?'} ms · ${p.clients}/${p.max}</option>`).join('')}</select></label>
        <div class="muted" style="font-size:12px">Le jeton et la connexion au jeu passent par ce proxy. Le changer au milieu d’une session impose une reconnexion.</div>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="pp-go">Enregistrer</button>',
      onMount: (m, close) => $('#pp-go', m).onclick = e => UI.run(e.target, () => A().setProxy(a.id, $('#pp', m).value || null), 'Proxy enregistré.').then(close),
    });
  }

  return { render };
})();
