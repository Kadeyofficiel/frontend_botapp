/* Groupes : jusqu'à 8 comptes d'un même serveur, un meneur qui fait tourner le script. */
window.Views = window.Views || {};
Views.groups = (function () {
  const { $, $$, esc, initials, options } = UI;

  function render(root) {
    const S = Api.state, acc = Api.helpers.acc;
    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('group')} Groupes</h1><p>Jusqu’à 8 comptes d’un même serveur qui jouent ensemble.</p></div>
        <div class="right"><button class="btn-primary" id="gr-new">${icon('plus')} Nouveau groupe</button></div>
      </div>
      ${UI.explain('groups', `Le <b>meneur</b> fait tourner le script du groupe ; les autres entrent dans son groupe en jeu, puis le suivent de map en map.
        Dans un script : <code>s.group</code> donne les membres, <code>s.group.gather()</code> attend qu’ils soient tous sur la map, <code>s.goTo(map, { group: true })</code> fait voyager le groupe ensemble.
        <ul><li>Chaque compte joue le dernier personnage qu’il a joué.</li><li>Un compte n’est que dans un seul groupe.</li></ul>`)}
      ${S.groups.length ? `<div class="grid-2">${S.groups.map(g => {
        const online = g.members.filter(id => acc(id)?.state === 'ingame').length;
        return `<section class="card group-card">
          <div class="card-h"><h3>${icon('group')} ${esc(g.name)}</h3><span class="tag">${esc(g.server || '')}</span>
            <div class="right"><span class="pill ${online === g.members.length ? 'pill-ok' : online ? 'pill-warn' : ''}"><i class="dot"></i>${online}/${g.members.length} en jeu</span></div></div>
          <div class="card-b" style="display:flex;flex-direction:column;gap:12px">
            <div class="members">${g.members.map(id => { const a = acc(id); if (!a) return ''; return `<span class="member ${id === g.leaderId ? 'lead' : ''}" title="${id === g.leaderId ? 'Meneur' : 'Membre'}"><span class="avatar" style="background:var(--surface-3)">${initials(a.character?.name || a.nick)}</span>${id === g.leaderId ? icon('crown') + ' ' : ''}${esc(a.character?.name || a.nick)}</span>`; }).join('')}</div>
            <div class="dim">${icon('code')} Script : <b>${esc(g.script || 'aucun')}</b></div>
            <div class="btn-row">
              <button class="btn-success sm" data-start="${g.id}">${icon('play')} Démarrer le groupe</button>
              <button class="btn sm" data-edit="${g.id}">${icon('edit')} Modifier</button>
              <button class="btn-ghost sm" data-del="${g.id}" style="margin-left:auto;color:var(--red)">${icon('trash')} Supprimer</button></div>
          </div></section>`; }).join('')}</div>`
      : `<div class="card">${UI.empty('group', 'Aucun groupe', 'Crée un groupe : choisis ses comptes, son meneur et son script.', '<button class="btn-primary" id="gr-new2">Nouveau groupe</button>')}</div>`}
    </div>`;

    $('#gr-new', root).onclick = () => edit();
    const n2 = $('#gr-new2', root); if (n2) n2.onclick = () => edit();
    $$('[data-edit]', root).forEach(b => b.onclick = () => edit(S.groups.find(g => g.id === b.dataset.edit)));
    $$('[data-start]', root).forEach(b => b.onclick = () => UI.run(b, () => Api.groups.start(b.dataset.start), 'Groupe démarré.'));
    $$('[data-del]', root).forEach(b => b.onclick = async () => { const g = S.groups.find(x => x.id === b.dataset.del); if (await UI.confirm({ title: 'Supprimer « ' + g.name + ' » ?', text: 'Les comptes restent dans Comptes ; seul le groupe disparaît.', ok: 'Supprimer', danger: true })) UI.run(null, () => Api.groups.remove(g.id), 'Groupe supprimé.'); });
  }

  function edit(g) {
    const S = Api.state;
    const draft = g ? structuredClone(g) : { name: '', script: '', members: [], leaderId: null };
    const scripts = S.scripts.session.filter(s => !s.template && s.ok).map(s => s.file.replace(/\.js$/, ''));
    UI.modal({
      title: g ? 'Modifier le groupe' : 'Nouveau groupe', icon: 'group', wide: true,
      body: `<div class="grid-2"><label class="field"><span>Nom</span><input type="text" id="g-name" value="${esc(draft.name)}" placeholder="ex. Team récolte"></label>
        <label class="field"><span>Script du meneur</span><select id="g-script"><option value="">aucun</option>${options(scripts, draft.script)}</select></label></div>
        <div class="field"><span>Comptes <b id="g-count"></b></span><div class="pick-list" id="g-pick"></div>
          <span class="hint">Coche jusqu’à 8 comptes d’un même serveur, puis choisis le meneur ${icon('crown')}. Le script tourne sur le meneur une fois les autres entrés dans son groupe en jeu (au plus 3 min après : il part avec ceux qui sont là).</span></div>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="g-save">Enregistrer</button>',
      onMount: (m, close) => {
        const draw = () => {
          const servers = new Set(draft.members.map(id => Api.helpers.acc(id)?.character?.server).filter(Boolean));
          $('#g-count', m).textContent = `(${draft.members.length}/8)`;
          $('#g-pick', m).innerHTML = S.accounts.map(a => {
            const inOther = a.groupId && a.groupId !== draft.id;
            const on = draft.members.includes(a.id);
            const wrongServer = !on && servers.size && a.character && !servers.has(a.character.server);
            const dis = inOther || wrongServer || (!on && draft.members.length >= 8);
            return `<div class="pick-row" style="${dis ? 'opacity:.5' : ''}">
              <input type="checkbox" data-m="${a.id}" ${on ? 'checked' : ''} ${dis ? 'disabled' : ''}>
              <div class="grow"><b>${esc(a.character?.name || a.nick)}</b> <span class="muted">${esc(a.nick + a.tag)} · ${esc(a.character?.server || 'serveur inconnu')}</span>
                ${inOther ? '<span class="tag">déjà dans un autre groupe</span>' : wrongServer ? '<span class="tag yellow">autre serveur</span>' : ''}</div>
              ${on ? `<button class="btn${draft.leaderId === a.id ? '-primary' : ''} sm" data-lead="${a.id}">${icon('crown')} ${draft.leaderId === a.id ? 'Meneur' : 'Mettre meneur'}</button>` : ''}</div>`;
          }).join('');
          $$('[data-m]', m).forEach(cb => cb.onchange = () => {
            const id = cb.dataset.m;
            draft.members = cb.checked ? [...draft.members, id] : draft.members.filter(x => x !== id);
            if (!draft.members.includes(draft.leaderId)) draft.leaderId = draft.members[0] || null;
            draw();
          });
          $$('[data-lead]', m).forEach(b => b.onclick = () => { draft.leaderId = b.dataset.lead; draw(); });
          hydrateIcons(m);
        };
        draw();
        $('#g-save', m).onclick = e => {
          draft.name = $('#g-name', m).value.trim(); draft.script = $('#g-script', m).value;
          draft.server = Api.helpers.acc(draft.leaderId)?.character?.server || '';
          UI.run(e.target, () => Api.groups.save(draft), 'Groupe enregistré.').then(close).catch(() => {});
        };
      },
    });
  }

  return { render };
})();
