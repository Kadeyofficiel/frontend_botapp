/* Agent IA : assistant intégré (ordres en langage naturel) + connexion d'un agent externe (MCP). */
window.Views = window.Views || {};
Views.agent = (function () {
  const { $, $$, esc, time, ago, options } = UI;
  const st = { draft: '', snippet: 'desktop', freshToken: null };
  const PERMS = [
    ['read', 'Lire l’état', 'sessions, comptes, positions, statistiques', false],
    ['scripts', 'Démarrer / arrêter des scripts', 'scripts de session et de combat', false],
    ['connect', 'Connecter / déconnecter des comptes', '', false],
    ['chat', 'Écrire dans le chat du jeu', 'parler au nom d’un personnage', true],
    ['accounts', 'Gérer les comptes et proxies', 'créer, retirer, changer de proxy', true],
    ['buy', 'Acheter des abonnements', 'utilise tes codes paysafecard', true],
  ];
  const MODE = { allow: 'Autorisé', confirm: 'Demander confirmation', deny: 'Interdit' };
  const SUGGEST = ['Lance la récolte sur la Team récolte', 'Arrête tous les scripts', 'Où sont mes bots ?', 'Combien de kamas aujourd’hui ?', 'Connecte tous les comptes', 'Charge le combat sadida sur tous'];
  const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');

  function planHtml(m, i) {
    const p = m.plan;
    const tagFor = s => s.done ? '<span class="tag green">fait</span>' : s.error ? `<span class="tag red" title="${esc(s.error)}">erreur</span>`
      : s.mode === 'deny' ? '<span class="tag red">interdit</span>' : s.mode === 'confirm' ? '<span class="tag yellow">à confirmer</span>' : '<span class="tag">autorisé</span>';
    const foot = p.state === 'pending' ? `<div class="plan-f"><button class="btn-success sm" data-run="${i}">${icon('play')} Exécuter</button><button class="btn sm" data-cancel="${i}">Annuler</button></div>`
      : p.state === 'blocked' ? `<div class="plan-f"><span class="err">${icon('shield')} Une étape est interdite par les permissions (à droite).</span></div>`
      : p.state === 'cancelled' ? '<div class="plan-f muted">Annulé.</div>'
      : p.state === 'running' ? '<div class="plan-f muted">En cours…</div>'
      : `<div class="plan-f ok">${icon('check')} Terminé${p.auto ? ' (exécuté seul : actions autorisées)' : ''}.</div>`;
    return `<div class="plan"><div class="plan-h">${icon('layers')} Plan</div>
      ${p.steps.map((s, k) => `<div class="plan-step ${s.done ? 'done' : ''} ${s.risky ? 'risky' : ''}"><span class="n">${s.done ? '✓' : k + 1}</span><span style="flex:1">${esc(s.label)}</span>${tagFor(s)}</div>`).join('')}
      ${foot}</div>`;
  }

  function render(root) {
    const A = Api.state.agent;
    const token = st.freshToken || (A.token ? A.token.slice(0, 6) + '••••••••••••' + A.token.slice(-4) : '<TON_JETON>');
    const snippets = {
      desktop: `{\n  "mcpServers": {\n    "bothors": {\n      "command": "npx",\n      "args": ["-y", "mcp-remote", "${A.mcpUrl}",\n               "--header", "Authorization: Bearer ${token}"]\n    }\n  }\n}`,
      code: `claude mcp add --transport http bothors ${A.mcpUrl} \\\n  --header "Authorization: Bearer ${token}"`,
      http: `POST ${A.mcpUrl}\nAuthorization: Bearer ${token}\nContent-Type: application/json\n\n{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }`,
    };

    root.innerHTML = `<div class="page">
      <div class="page-head">
        <div><h1>${icon('sparkles')} Agent IA</h1><p>Donne des ordres à tes bots en français, ou branche ton propre agent (Claude, ChatGPT…) pour qu’il les pilote.</p></div>
      </div>
      ${UI.explain('agent', `<b>Deux façons d’utiliser l’IA :</b>
        <ul><li><b>Assistant</b> (à gauche) : écris ce que tu veux (« lance la récolte sur la Team récolte »). Il te montre un plan ; tu l’exécutes d’un clic.</li>
        <li><b>Agent externe</b> (à droite) : crée un jeton et colle la configuration dans Claude Desktop, Claude Code ou un autre client MCP. Ton agent peut alors lire l’état et agir sur tes bots.</li></ul>
        Les <b>permissions</b> valent pour les deux : « Autorisé » agit tout de suite, « Demander confirmation » attend ton clic, « Interdit » bloque.`)}
      <div class="agent-grid">
        <section class="card agent-chat">
          <div class="card-h"><h3>${icon('chat')} Assistant</h3><span class="sub">${esc(A.model.model)}</span>
            <div class="right"><button class="btn-ghost sm" id="ag-clear" title="Effacer la conversation">${icon('trash')} Effacer</button></div></div>
          <div class="agent-msgs" data-keep-scroll="agent">
            ${A.messages.map((m, i) => m.role === 'me' ? `<div class="msg me">${esc(m.text)}</div>`
              : `<div class="msg ai"><div class="who">${icon('sparkles')} Assistant</div>${md(m.text)}${m.plan ? planHtml(m, i) : ''}</div>`).join('')}
            ${A.thinking ? '<div class="msg ai typing"><span></span><span></span><span></span></div>' : ''}
          </div>
          <div class="suggest">${SUGGEST.map(s => `<button data-sug="${esc(s)}">${esc(s)}</button>`).join('')}</div>
          <div class="agent-input">
            <textarea id="ag-text" rows="1" placeholder="Dis à tes bots quoi faire… (Entrée pour envoyer, Maj+Entrée pour aller à la ligne)">${esc(st.draft)}</textarea>
            <button class="btn-primary" id="ag-send" ${A.thinking ? 'disabled' : ''}>${icon('send')}</button>
          </div>
        </section>

        <div class="side-stack">
          <section class="card"><div class="card-h"><h3>${icon('link')} Connecter un agent externe</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:12px">
            <div class="field"><span>Adresse du serveur MCP</span><div class="key-row"><input type="text" readonly value="${esc(A.mcpUrl)}"><button class="btn" data-copy="${esc(A.mcpUrl)}" title="Copier">${icon('copy')}</button></div></div>
            <div class="field"><span>Jeton d’accès</span>
              ${A.token ? `<div class="key-row"><input type="text" readonly value="${esc(token)}" class="mono"><button class="btn" data-copy="${esc(st.freshToken || '')}" ${st.freshToken ? '' : 'disabled title="Le jeton complet n’est montré qu’à sa création"'}>${icon('copy')}</button></div>
                ${st.freshToken ? '<span class="hint warn">Copie-le maintenant : il ne sera plus affiché en entier.</span>' : ''}
                <div class="btn-row"><button class="btn sm" id="tk-new">${icon('refresh')} Nouveau jeton</button><button class="btn-danger sm" id="tk-revoke">Révoquer</button></div>`
              : `<button class="btn-primary" id="tk-new">${icon('key')} Créer un jeton</button><span class="hint">Le jeton donne accès à tes bots selon les permissions ci-dessous. Ne le partage pas.</span>`}</div>
            <div class="field"><span>Configuration</span>
              <div class="seg" style="align-self:flex-start">${[['desktop', 'Claude Desktop'], ['code', 'Claude Code'], ['http', 'Autre (HTTP)']].map(([k, l]) => `<button data-sn="${k}" class="${st.snippet === k ? 'on' : ''}">${l}</button>`).join('')}</div>
              <div class="snippet">${esc(snippets[st.snippet])}<button class="icon-btn" data-copy="${esc(snippets[st.snippet])}" title="Copier">${icon('copy')}</button></div>
              <span class="hint">${st.snippet === 'desktop' ? 'Claude Desktop › Réglages › Développeur › Modifier la config, colle ce bloc puis redémarre Claude.' : st.snippet === 'code' ? 'Lance cette commande dans un terminal, puis demande à Claude de piloter tes bots.' : 'Tout client compatible MCP (streamable HTTP) fonctionne.'}</span></div>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('shield')} Permissions</h3></div><div class="card-b" style="padding-top:4px;padding-bottom:4px">
            ${PERMS.map(([k, l, sub, risky]) => `<div class="perm"><div class="grow"><b>${l}</b>${risky ? ' <span class="tag red">sensible</span>' : ''}${sub ? `<div class="cell-sub">${sub}</div>` : ''}</div>
              <select data-perm="${k}">${options(k === 'read' ? ['allow', 'deny'] : ['allow', 'confirm', 'deny'], A.perms[k], v => MODE[v])}</select></div>`).join('')}
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('cpu')} Modèle de l’assistant</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:10px">
            <div class="grid-2"><label class="field"><span>Fournisseur</span><select id="md-prov">${options(['anthropic', 'openai'], A.model.provider, v => v === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI')}</select></label>
              <label class="field"><span>Modèle</span><select id="md-model">${A.model.provider === 'anthropic' ? options(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'], A.model.model, v => ({ 'claude-opus-5-5': 'Claude Opus 5.5', 'claude-sonnet-5-5': 'Claude Sonnet 5.5', 'claude-haiku-5-5': 'Claude Haiku 5.5 (rapide)' })[v]) : options(['gpt'], 'gpt', () => 'Modèle OpenAI')}</select></label></div>
            <label class="field"><span>Clé API</span><div class="key-row"><input type="password" id="md-key" placeholder="${A.model.key ? 'clé enregistrée (' + esc(A.model.key) + ')' : 'colle ta clé'}" autocomplete="off"><button class="btn-primary" id="md-save">Enregistrer</button></div></label>
          </div></section>

          <section class="card"><div class="card-h"><h3>${icon('activity')} Agents connectés & activité</h3></div>
            <div class="events">${A.clients.map(c => `<div class="ev ok"><div class="ic-wrap">${icon('bot')}</div><div style="flex:1"><div class="t1">${esc(c.name)}</div><div class="t2">${c.calls} actions · dernière ${ago(c.last)}</div></div></div>`).join('')}
              ${A.log.slice(-8).reverse().map(l => `<div class="ev ${l[3] ? '' : 'err'}"><div class="ic-wrap">${icon(l[3] ? 'check' : 'x')}</div><div><div class="t1">${esc(l[2])}</div><div class="t2">${esc(l[1])} · ${time(l[0])}</div></div></div>`).join('')}
              ${!A.clients.length && !A.log.length ? '<div class="card-b muted">Aucune activité pour l’instant.</div>' : ''}</div>
          </section>
        </div>
      </div>
    </div>`;
    mount(root);
  }

  function mount(root) {
    const A = Api.state.agent;
    const ta = $('#ag-text', root);
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; };
    grow();
    const send = text => { text = (text || '').trim(); if (!text || A.thinking) return; st.draft = ''; Api.agent.ask(text).catch(e => UI.toast(e.message, 'err')); };
    ta.oninput = () => { st.draft = ta.value; grow(); };
    ta.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } };
    $('#ag-send', root).onclick = () => send(ta.value);
    $$('[data-sug]', root).forEach(b => b.onclick = () => send(b.dataset.sug));
    $('#ag-clear', root).onclick = () => Api.agent.clear();
    $$('[data-run]', root).forEach(b => b.onclick = async () => {
      const m = A.messages[+b.dataset.run];
      const risky = m.plan.steps.filter(s => s.risky);
      if (risky.length && !await UI.confirm({ title: 'Exécuter ce plan ?', text: `Il contient ${risky.length} action(s) sensible(s) : ${risky.map(s => esc(s.label)).join(', ')}.`, ok: 'Exécuter', danger: true })) return;
      Api.agent.execute(m);
    });
    $$('[data-cancel]', root).forEach(b => b.onclick = () => Api.agent.cancel(A.messages[+b.dataset.cancel]));
    $$('[data-copy]', root).forEach(b => b.onclick = () => { navigator.clipboard?.writeText(b.dataset.copy).then(() => UI.toast('Copié.', 'ok'), () => UI.toast('Copie impossible : sélectionne le texte à la main.', 'warn')); });
    $$('[data-sn]', root).forEach(b => b.onclick = () => { st.snippet = b.dataset.sn; App.render(); });
    $$('[data-perm]', root).forEach(s => s.onchange = () => { Api.agent.setPerm(s.dataset.perm, s.value); UI.toast('Permission mise à jour.', 'ok'); });
    const nt = $('#tk-new', root);
    if (nt) nt.onclick = async () => {
      if (A.token && !await UI.confirm({ title: 'Créer un nouveau jeton ?', text: 'L’ancien jeton ne marchera plus : les agents qui l’utilisent devront être reconfigurés.', ok: 'Créer', danger: true })) return;
      st.freshToken = await UI.run(nt, () => Api.agent.createToken(), 'Jeton créé.'); App.render();
    };
    const rv = $('#tk-revoke', root);
    if (rv) rv.onclick = async () => { if (await UI.confirm({ title: 'Révoquer le jeton ?', text: 'Tous les agents externes seront déconnectés immédiatement.', ok: 'Révoquer', danger: true })) { st.freshToken = null; UI.run(rv, () => Api.agent.revokeToken(), 'Jeton révoqué.'); } };
    $('#md-prov', root).onchange = e => { A.model.provider = e.target.value; A.model.model = e.target.value === 'anthropic' ? 'claude-opus-5-5' : 'gpt'; App.render(); };
    $('#md-save', root).onclick = e => UI.run(e.target, () => Api.agent.saveModel({ provider: $('#md-prov', root).value, model: $('#md-model', root).value, key: $('#md-key', root).value }), 'Modèle enregistré.');
  }

  return { render };
})();
