/* Réglages : clés de services (CapSolver, SMS, paysafecard, Discord). */
window.Views = window.Views || {};
Views.settings = (function () {
  const { $, $$, esc, options } = UI;
  const draft = {};

  // Une ligne de réglage : clé secrète (jamais réaffichée) ou simple valeur.
  const keyField = (key, label, hint = '', placeholder = 'colle la nouvelle clé ici') => {
    const k = Api.state.settings[key];
    return `<div class="setting"><span class="label">${label}</span>${hint ? `<div class="muted" style="font-size:12px;margin-bottom:4px">${hint}</div>` : ''}
      <div class="key-state ${k.saved ? 'ok' : 'warn'}">${k.saved ? icon('check') + ' clé enregistrée (' + esc(k.saved) + ')' : 'pas de clé'}</div>
      <div class="key-row"><input type="password" data-k="${key}" placeholder="${k.saved ? '••••••••  (remplacer)' : placeholder}" value="${esc(draft[key] || '')}" autocomplete="off">
        <button class="btn-primary" data-save="${key}">Enregistrer</button>${k.saved ? `<button class="btn" data-rm="${key}">Retirer</button>` : ''}</div></div>`;
  };
  const valField = (key, label, input) => {
    const k = Api.state.settings[key];
    return `<div class="setting"><span class="label">${label}</span>
      <div class="key-state ${k.value ? 'ok' : 'muted'}">${k.value ? icon('check') + ' ' + esc(k.value) : 'rien de choisi (valeur par défaut)'}</div>
      <div class="key-row">${input}<button class="btn-primary" data-save="${key}">Enregistrer</button>${k.value ? `<button class="btn" data-rm="${key}">Retirer</button>` : ''}</div></div>`;
  };

  function render(root) {
    const S = Api.state.settings;
    root.innerHTML = `<div class="page settings">
      <div class="page-head"><div><h1>${icon('settings')} Réglages</h1><p>Tes clés, pour ton bot seulement.</p></div></div>
      ${UI.explain('settings', 'Les clés sont gardées <b>chiffrées</b> dans la base du serveur et ne sont jamais réaffichées (seulement leurs 4 derniers caractères). Elles servent tout de suite, sans redémarrer. Une clé du fichier <code>.env</code> sert tant qu’il n’y en a pas ici.')}

      <section class="card"><div class="card-h"><h3>${icon('shield')} CapSolver</h3><span class="sub">la vérification anti-robot d’Ankama, aux connexions et aux créations de comptes</span></div>
        <div class="card-b">${keyField('capsolver', 'Clé CapSolver')}
          <div class="setting"><button class="btn" data-test="capsolver">${icon('activity')} Tester la clé</button></div></div></section>

      <section class="card"><div class="card-h"><h3>${icon('phone')} Numéros SMS</h3><span class="sub">pour « Ajouter un numéro de téléphone » dans Comptes</span></div>
        <div class="card-b">
          ${valField('smsProvider', 'Fournisseur de numéros', `<select data-k="smsProvider">${options(['', 'hero-sms.com', 'non-voip.com'], draft.smsProvider ?? S.smsProvider.value, v => v || 'celui dont la clé est là (hero-sms.com d’abord)')}</select>`)}
          ${keyField('heroSms', 'Clé hero-sms.com')}
          ${valField('heroCountry', 'Pays des numéros hero-sms.com', `<input type="text" data-k="heroCountry" placeholder="numéro ou nom anglais du pays (usa par défaut)" value="${esc(draft.heroCountry || '')}">`)}
          ${keyField('nonVoip', 'Clé non-voip.com')}
          ${valField('ankamaCountry', 'Pays à choisir dans le formulaire d’Ankama', `<input type="text" data-k="ankamaCountry" placeholder="sinon celui du numéro" value="${esc(draft.ankamaCountry || '')}">`)}
          <div class="setting"><button class="btn" data-test="sms">${icon('activity')} Tester le fournisseur</button></div>
        </div></section>

      <section class="card"><div class="card-h"><h3>${icon('card')} paysafecard</h3><span class="sub">pour « Acheter un abonnement » dans Comptes</span></div>
        <div class="card-b">
          <div class="setting"><span class="label">Codes PIN</span>
            <div class="key-state"><span class="pill ${S.pins.count ? 'pill-ok' : 'pill-err'}">${icon('key')} ${S.pins.count} code${S.pins.count > 1 ? 's' : ''} utilisable${S.pins.count > 1 ? 's' : ''}</span></div>
            <textarea id="pins" rows="3" placeholder="16 chiffres chacun, un par ligne ou séparés par des virgules">${esc(draft.pins || '')}</textarea>
            <div class="btn-row" style="margin-top:8px"><button class="btn-primary" id="pins-add">Ajouter ces codes</button>${S.pins.count ? '<button class="btn-danger" id="pins-clear">Retirer tous les codes</button>' : ''}</div></div>
          ${valField('pinCountry', 'Pays dans la liste de paysafecard', `<input type="text" data-k="pinCountry" placeholder="Canada par défaut" value="${esc(draft.pinCountry || '')}">`)}
        </div></section>

      <section class="card"><div class="card-h"><h3>${icon('bell')} Alertes Discord</h3><span class="sub">reçois les problèmes sur ton serveur Discord</span></div>
        <div class="card-b">
          <div class="grid-3" style="margin-bottom:14px;font-size:12px">
            <div><span class="tag red">tout de suite</span><div class="muted" style="margin-top:4px">message d’un modérateur, compte banni ou bloqué, reconnexion abandonnée, licence</div></div>
            <div><span class="tag yellow">toutes les 30 min</span><div class="muted" style="margin-top:4px">combats perdus, comptes à reconnecter, proxies refusés, pas de proxy libre</div></div>
            <div><span class="tag">une fois par jour</span><div class="muted" style="margin-top:4px">soldes bas, codes PIN épuisés</div></div></div>
          ${keyField('discord', 'Webhook Discord', 'Discord : Paramètres du salon › Intégrations › Webhooks › Copier l’URL', 'https://discord.com/api/webhooks/…')}
          <div class="setting"><button class="btn" id="discord-test">${icon('send')} Envoyer un essai</button></div>
        </div></section>
    </div>`;

    $$('[data-k]', root).forEach(i => (i.oninput = i.onchange = () => draft[i.dataset.k] = i.value));
    $$('[data-save]', root).forEach(b => b.onclick = () => { const k = b.dataset.save; const v = draft[k] ?? $(`[data-k="${k}"]`, root)?.value; UI.run(b, () => Api.settings.save(k, v), 'Enregistré.').then(() => { delete draft[k]; App.render(); }).catch(() => {}); });
    $$('[data-rm]', root).forEach(b => b.onclick = () => UI.run(b, () => Api.settings.remove(b.dataset.rm), 'Retiré.'));
    $$('[data-test]', root).forEach(b => b.onclick = () => UI.run(b, () => Api.settings.test(b.dataset.test), r => r).catch(() => {}));
    $('#pins-add', root).onclick = e => UI.run(e.target, () => Api.settings.addPins(draft.pins || ''), n => n + ' code(s) ajouté(s).').then(() => { draft.pins = ''; App.render(); }).catch(() => {});
    const pc = $('#pins-clear', root); if (pc) pc.onclick = async () => { if (await UI.confirm({ title: 'Retirer tous les codes PIN ?', text: 'Les abonnements ne pourront plus être payés tant que tu n’en ajoutes pas.', ok: 'Retirer', danger: true })) UI.run(pc, () => Api.settings.clearPins(), 'Codes retirés.'); };
    $('#discord-test', root).onclick = e => UI.run(e.target, () => Api.settings.discordTest(), r => r).catch(() => {});
  }

  return { render };
})();
