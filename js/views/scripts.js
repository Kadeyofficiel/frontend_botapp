/* Scripts : import (vérifiés avant enregistrement), documentation pour IA, versions, renommage. */
window.Views = window.Views || {};
Views.scripts = (function () {
  const { $, $$, esc } = UI;
  let results = [];

  const KINDS = [
    ['session', 'Scripts de session', 'ce que fait le personnage en jeu : main(s)', 'play'],
    ['fight', 'Scripts de combat', 'comment il joue ses combats : onTurn(t), onPlacement(p)…', 'swords'],
    ['data', 'Fichiers de données', 'lus par tes scripts avec s.readText(nom)', 'file'],
  ];

  function usedBy(kind, file) {
    const S = Api.state, name = file.replace(/\.js$/, '');
    if (kind === 'session') return S.accounts.filter(a => a.script === name).map(a => a.nick);
    if (kind === 'fight') return S.sessions.filter(s => s.fight === name).map(s => Api.helpers.acc(s.accountId).character?.name);
    return [];
  }

  function render(root) {
    const S = Api.state;
    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('code')} Scripts</h1><p>Tes scripts, sur ton bot seulement. Ce bot offre l’<b>API 8</b> des scripts de session et l’<b>API 1</b> des scripts de combat.</p></div>
      </div>
      ${UI.explain('scripts', `<ul style="margin:0">
        <li>Un <b>script de session</b> fait jouer un personnage (démarré depuis le tableau de bord ou à la connexion d’un compte).</li>
        <li>Un <b>script de combat</b> joue ses combats.</li>
        <li>Un script qui tourne garde sa version jusqu’à son prochain démarrage.</li>
        <li>Pas développeur ? Télécharge la <b>documentation pour IA</b>, donne-la à Claude ou ChatGPT avec ce que tu veux, puis importe le fichier .js qu’il te rend.</li></ul>`)}

      <div class="grid-2" style="margin-bottom:16px">
        <div class="dropzone" id="drop">
          ${icon('upload')}
          <div style="margin:8px 0"><b>Glisse tes fichiers ici</b> ou <label class="btn-primary sm" style="cursor:pointer">Importer des fichiers…<input type="file" id="pick" multiple accept=".js,.txt,.json,.csv" hidden></label></div>
          <div class="muted" style="font-size:12px">Un <b>.js</b> est vérifié avant d’être enregistré : s’il ne se charge pas, rien n’est remplacé. Un <b>.txt / .json / .csv</b> est une donnée que tes scripts lisent.</div>
          ${results.length ? `<div style="margin-top:10px;text-align:left">${results.map(r => `<div class="${r.ok ? 'ok' : 'err'}">${icon(r.ok ? 'check' : 'x')} ${esc(r.file)} — ${esc(r.msg)}</div>`).join('')}</div>` : ''}
        </div>
        <div class="card"><div class="card-b" style="display:flex;gap:14px;align-items:flex-start">
          <span class="avatar lg" style="background:var(--accent-soft);color:#8e98ff">${icon('sparkles')}</span>
          <div><h3 style="font-size:14px;margin-bottom:4px">Faire écrire un script par une IA</h3>
            <div class="muted" style="margin-bottom:10px">Donne ce fichier à ton IA avec ce que tu veux que le script fasse : elle y trouve tout pour l’écrire. Importe ensuite le .js qu’elle te rend.</div>
            <button class="btn" id="docs">${icon('download')} Télécharger la documentation pour IA</button></div>
        </div></div>
      </div>

      ${KINDS.map(([k, title, sub, ic]) => `<section class="card"><div class="card-h"><h3>${icon(ic)} ${title}</h3><span class="sub">${sub}</span><span class="right tag">${S.scripts[k].length}</span></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Fichier</th><th>État</th><th>Utilisé par</th><th>Origine</th><th>Modifié</th><th></th></tr></thead><tbody>
        ${S.scripts[k].map(s => { const u = usedBy(k, s.file); return `<tr>
          <td class="mono cell-main">${esc(s.file)}</td>
          <td>${s.ok ? `<span class="tag green">prêt</span> <span class="cell-sub">${esc(s.hooks)}${s.api ? ' · API ' + s.api : ''}</span>` : `<span class="tag red">erreur</span> <span class="cell-sub err">${esc(s.error || '')}</span>`}</td>
          <td>${s.template ? '<span class="muted">modèle (pas proposé au démarrage)</span>' : u.length ? esc(u.join(', ')) : '<span class="muted">—</span>'}</td>
          <td>${s.origin === 'toi' ? '<span class="tag accent">à toi</span>' : '<span class="tag">livré avec le bot</span>'}</td>
          <td class="muted">${esc(s.modified)}</td>
          <td class="actions">
            <button class="icon-btn" data-dl="${k}|${esc(s.file)}" title="Télécharger">${icon('download')}</button>
            <button class="icon-btn" data-ver="${k}|${esc(s.file)}" title="Versions précédentes">${icon('history')}${s.versions ? `<sup>${s.versions}</sup>` : ''}</button>
            <button class="icon-btn" data-ren="${k}|${esc(s.file)}" title="Renommer">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${k}|${esc(s.file)}" title="Supprimer">${icon('trash')}</button></td></tr>`; }).join('')}
        </tbody></table></div></section>`).join('')}
    </div>`;

    const upload = files => UI.run(null, () => Api.scripts.upload(files)).then(r => { results = r; App.render(); }).catch(() => {});
    const drop = $('#drop', root);
    drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); upload(e.dataTransfer.files); };
    $('#pick', root).onchange = e => upload(e.target.files);
    $('#docs', root).onclick = e => UI.run(e.target, () => Api.scripts.downloadDocs(), f => 'Téléchargement de ' + f);
    const parse = b => b.split('|');
    $$('[data-dl]', root).forEach(b => b.onclick = () => { const [k, f] = parse(b.dataset.dl); UI.run(b, () => Api.scripts.download(k, f), 'Téléchargement de ' + f); });
    $$('[data-ver]', root).forEach(b => b.onclick = () => versions(...parse(b.dataset.ver)));
    $$('[data-ren]', root).forEach(b => b.onclick = () => rename(...parse(b.dataset.ren)));
    $$('[data-del]', root).forEach(b => b.onclick = async () => {
      const [k, f] = parse(b.dataset.del); const u = usedBy(k, f);
      if (await UI.confirm({ title: 'Supprimer ' + f + ' ?', text: (u.length ? `<b>Utilisé par ${esc(u.join(', '))}</b> : ces comptes n’auront plus de script au démarrage.<br>` : '') + 'La version actuelle reste récupérable dans « Versions ».', ok: 'Supprimer', danger: true }))
        UI.run(null, () => Api.scripts.remove(k, f), f + ' supprimé.');
    });
  }

  async function versions(kind, file) {
    const list = await Api.scripts.versions(kind, file);
    const shipped = Api.state.scripts[kind].find(s => s.file === file)?.origin === 'livré';
    UI.modal({
      title: 'Versions · ' + file, icon: 'history',
      body: `<div class="muted">Chaque fois que ce fichier est remplacé, supprimé ou remis à une autre version, celle d’avant est gardée ici (les 20 dernières).</div>
        ${list.length ? `<div class="pick-list">${list.map(v => `<div class="pick-row"><div class="grow">${icon('file')} ${esc(v.date)} <span class="muted">${esc(v.size)}</span></div><button class="btn sm" data-v="${v.id}">Remettre</button></div>`).join('')}</div>` : '<div class="muted">Aucune version précédente.</div>'}`,
      foot: `${shipped ? '<button class="btn" id="v-shipped">Remettre la version livrée avec le bot</button>' : ''}<button class="btn-primary" data-close>Fermer</button>`,
      onMount: (m, close) => {
        $$('[data-v]', m).forEach(b => b.onclick = () => UI.run(b, () => Api.scripts.restore(kind, file, +b.dataset.v), 'Version remise.').then(close));
        const sh = $('#v-shipped', m); if (sh) sh.onclick = () => UI.run(sh, () => Api.scripts.restore(kind, file, 'shipped'), 'Version livrée remise.').then(close);
      },
    });
  }

  function rename(kind, file) {
    const [base, ext] = [file.replace(/\.[^.]+$/, ''), file.split('.').pop()];
    UI.modal({
      title: 'Renommer ' + file, icon: 'edit',
      body: `<label class="field"><span>Nouveau nom</span><div style="display:flex;gap:6px;align-items:center"><input type="text" id="rn" value="${esc(base)}"><span class="mono muted">.${esc(ext)}</span></div>
        <span class="hint">Lettres sans accent, chiffres, _ et -. Les comptes qui démarrent ce script à leur connexion suivent le nouveau nom.</span></label>`,
      foot: '<button class="btn" data-close>Annuler</button><button class="btn-primary" id="rn-go">Renommer</button>',
      onMount: (m, close) => {
        const go = e => UI.run(e.target, () => Api.scripts.rename(kind, file, $('#rn', m).value.trim()), 'Renommé.').then(close).catch(() => {});
        $('#rn-go', m).onclick = go; $('#rn', m).onkeydown = e => { if (e.key === 'Enter') go({ target: $('#rn-go', m) }); };
      },
    });
  }

  return { render };
})();
