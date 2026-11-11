/* =========================================================
   API — LE SEUL FICHIER À BRANCHER SUR LE VRAI BOT
   ---------------------------------------------------------
   Toute l'interface lit `Api.state` et appelle les fonctions
   ci-dessous. Aujourd'hui elles modifient des données fictives
   (js/mock.js). Pour brancher le vrai bot :
     1. remplacer le corps de chaque fonction par l'envoi du
        message WebSocket / l'appel HTTP correspondant ;
     2. quand le serveur pousse une mise à jour, modifier
        `Api.state` puis appeler `Api.emit('<sujet>')`.
   Sujets écoutés par l'interface :
     'sessions' 'accounts' 'proxies' 'groups' 'scripts'
     'settings' 'events' 'console' 'connection'
   Toutes les fonctions renvoient une Promise ; en cas d'erreur,
   rejeter avec un Error dont le message est lisible par l'utilisateur
   (il est affiché tel quel dans une notification).
   ========================================================= */
window.Api = (function () {
  const S = window.MOCK; // une fois branché : remplir cet objet avec l'état envoyé par le bot
  S.connection = { ok: true, label: 'Connecté · ' + S.user.wsId };

  const subs = {};
  const on = (topic, cb) => { (subs[topic] ||= []).push(cb); return () => subs[topic] = subs[topic].filter(f => f !== cb); };
  const emit = (...topics) => topics.forEach(t => (subs[t] || []).forEach(cb => cb()));
  const wait = (ms = 350) => new Promise(r => setTimeout(r, ms));
  const { rnd, hex } = S.hint;
  const SESSION_TEMPLATE = structuredClone(S.sessions[0]); // démo : modèle pour les nouvelles sessions

  const acc = id => S.accounts.find(a => a.id === id);
  const ses = id => S.sessions.find(s => s.id === id);
  const accName = a => a.nick + a.tag;
  const log = (src, text) => { S.console.push([new Date(), src, text]); emit('console'); };
  const event = (kind, icon, text, sub = '') => { S.events.push({ t: new Date(), kind, icon, text, sub }); emit('events'); };
  const fail = msg => Promise.reject(new Error(msg));

  /* ---------------- Sessions (personnages en jeu) ---------------- */
  const sessions = {
    async startScript(ids, script) {
      if (!ids.length) return fail('Coche au moins une session à gauche.');
      await wait(); ids.forEach(id => { const s = ses(id); s.script = script; s.scriptRunning = true; log('script', `[${acc(s.accountId).character?.name}] script ${script} démarré`); });
      emit('sessions');
    },
    async stopScript(ids) { await wait(); ids.forEach(id => { ses(id).scriptRunning = false; }); log('script', `Script arrêté sur ${ids.length} session(s)`); emit('sessions'); },
    async reloadScript(ids) { await wait(); log('script', `Script rechargé sur ${ids.length} session(s)`); },
    async scriptStatus(ids) { await wait(150); ids.forEach(id => { const s = ses(id); log('script', `[${acc(s.accountId).character?.name}] ${s.scriptRunning ? 'tourne : ' + s.script : 'aucun script'}`); }); },
    async stopAll() { await wait(); S.sessions.forEach(s => s.scriptRunning = false); log('script', 'Tous les scripts sont arrêtés.'); emit('sessions'); },
    async loadFight(ids, script) { await wait(); ids.forEach(id => ses(id).fight = script); log('combat', `Script de combat ${script} chargé (${ids.length})`); emit('sessions'); },
    async unloadFight(ids) { await wait(); ids.forEach(id => ses(id).fight = ''); log('combat', `Script de combat retiré (${ids.length})`); emit('sessions'); },
    async reloadFight(ids) { await wait(); log('combat', `Script de combat rechargé (${ids.length})`); },
    async fightStatus(ids) { await wait(150); ids.forEach(id => { const s = ses(id); log('combat', `[${acc(s.accountId).character?.name}] combat : ${s.fight || 'aucun'}`); }); },
    async command(ids, text) {
      if (!text.trim()) return;
      if (!ids.length) return fail('Aucune session cochée : la commande n’a été envoyée à personne.');
      await wait(150); log('info', `› ${text}  →  ${ids.length} session(s)`); log('script', 'OK');
    },
    async disconnect(id) { await wait(); const s = ses(id); const a = acc(s.accountId); a.state = 'offline'; S.sessions = S.sessions.filter(x => x !== s); event('warn', 'logout', accName(a) + ' déconnecté'); emit('sessions', 'accounts'); },
    async say(id, channel, to, text) { await wait(150); ses(id).chat.push([new Date(), channel, 'Moi' + (to ? ' → ' + to : ''), text]); emit('sessions'); },
    async move(id, dir) {
      await wait(250); const s = ses(id); const d = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] }[dir];
      s.map.x += d[0]; s.map.y += d[1]; s.map.id = rnd(1000, 9999); s.journal.push([new Date(), 'info', `Changement de map → [${s.map.x},${s.map.y}]`]); emit('sessions');
    },
    async goToCell(id, cell) { await wait(150); const s = ses(id); s.map.cell = cell; s.journal.push([new Date(), 'info', `Déplacement vers la cellule ${cell}`]); emit('sessions'); },
    async useItem(id, name) { await wait(); ses(id).journal.push([new Date(), 'info', 'Objet utilisé : ' + name]); emit('sessions'); },
    async journalFile(id) { await wait(); return 'journal-' + id + '.log'; },
  };

  /* ---------------- Comptes ---------------- */
  const accounts = {
    batch: 1,
    async setBatch(n) { accounts.batch = n; },
    async login(email, pass) {
      if (!email || !pass) return fail('Email et mot de passe requis.');
      await wait(800);
      const nick = email.split('@')[0].replace(/\W/g, '').slice(0, 10) || 'Compte';
      S.accounts.push({ id: 'ac' + Date.now(), nick: nick[0].toUpperCase() + nick.slice(1), tag: '#' + rnd(1000, 9999), email, phone: false, certified: false, sub: { state: 'unknown' }, proxyId: null, script: '', charMode: 'last', character: null, state: 'offline', groupId: null });
      event('ok', 'user', 'Compte ajouté : ' + email); emit('accounts');
    },
    async connect(ids, { noClient = true } = {}) {
      for (const id of ids) {
        const a = acc(id); if (a.state !== 'offline') continue;
        a.state = 'connecting'; emit('accounts');
        await wait(900);
        a.state = 'ingame';
        if (!a.character) a.character = { name: a.nick + '-' + hex(3), server: S.servers[0], breed: 'Iop', level: 1 };
        const base = structuredClone(SESSION_TEMPLATE);
        S.sessions.push({ ...base, id: 'se_' + a.id, accountId: a.id, color: '#a970ff', status: 'Connecté', script: a.script, scriptRunning: !!a.script, journal: [[new Date(), 'auth', 'Connexion ' + (noClient ? 'sans client' : 'avec client')]], chat: [] });
        event('ok', 'check', accName(a) + ' connecté ' + (noClient ? 'sans client' : ''), a.character.name + ' · ' + a.character.server);
        emit('accounts', 'sessions');
      }
    },
    async setScript(id, script) { await wait(150); acc(id).script = script; emit('accounts'); },
    async setCharacter(id, opts) { await wait(); Object.assign(acc(id), opts); emit('accounts'); },
    async setProxy(id, proxyId) { await wait(); acc(id).proxyId = proxyId; emit('accounts'); },
    async setMailbox(id, mailbox) { await wait(); acc(id).mailbox = mailbox; emit('accounts'); },
    async addPhone(id) { await wait(1200); acc(id).phone = true; event('ok', 'phone', 'Numéro ajouté et vérifié par SMS', accName(acc(id))); emit('accounts'); },
    async disableShield(id) { await wait(1200); acc(id).certified = true; event('ok', 'shield', 'Ankama Shield désactivé', accName(acc(id))); emit('accounts'); },
    async subscribe(id, { pack, qty, dryRun }) {
      await wait(1500);
      if (dryRun) { event('ok', 'card', 'Essai terminé : arrivé à la page paysafecard, rien payé', accName(acc(id))); return; }
      if (S.settings.pins.count < 1) return fail('Aucun code PIN paysafecard : ajoute-en dans Réglages.');
      const a = acc(id); a.sub = { state: 'active', days: pack === '7j' ? 7 * qty : 30 * qty, hours: 0, until: '—' }; S.settings.pins.count--; event('ok', 'card', 'Abonnement acheté', accName(a)); emit('accounts', 'settings');
    },
    async remove(id) { await wait(); const a = acc(id); S.accounts = S.accounts.filter(x => x !== a); event('warn', 'trash', accName(a) + ' retiré de Comptes'); emit('accounts'); },
    register: { running: false, done: 0, target: 0 },
    async startRegister(n, { disableShield }) {
      if (n > S.registerSource.free) return fail(`Seulement ${S.registerSource.free} emails libres dans la réserve.`);
      const r = accounts.register; r.running = true; r.done = 0; r.target = n; emit('accounts');
      for (let i = 0; i < n && r.running; i++) {
        await wait(1500); r.done++; S.registerSource.free--;
        await accounts.login('nouveau' + rnd(100, 999) + '@outlook.com', 'x');
        if (disableShield) S.accounts[S.accounts.length - 1].certified = true;
        emit('accounts');
      }
      r.running = false; emit('accounts');
    },
    async stopRegister() { accounts.register.running = false; emit('accounts'); },
  };

  /* ---------------- Proxies ---------------- */
  const px = id => S.proxies.find(p => p.id === id);
  const proxies = {
    async setMode(mode, max) { await wait(150); S.proxyMode = { mode, max }; emit('proxies'); },
    async add(text, { use, tag, test, replace }) {
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
      if (!lines.length) return fail('Aucune ligne de proxy reconnue.');
      await wait(400);
      if (replace) S.proxies = [];
      const added = lines.map(l => { const m = l.replace(/^\w+:\/\//, '').split('@').pop().split(':'); return { id: 'px' + Date.now() + Math.random(), host: m[0], port: +m[1] || 1080, session: hex(10), tag: tag || '', use, latency: null, clients: 0, max: 1, enabled: true, state: 'untested', last: '—' }; });
      S.proxies.push(...added); emit('proxies');
      if (test) proxies.test(added.map(p => p.id));
      return { added: added.length, ignored: 0 };
    },
    async test(ids) {
      for (const id of ids) { const p = px(id); if (!p) continue; p.state = 'testing'; emit('proxies'); await wait(250); const ok = Math.random() > .12; p.state = ok ? 'ok' : 'fail'; p.latency = ok ? rnd(700, 1200) : null; p.last = ok ? 'à l’instant' : 'refusé (timeout 10 s)'; emit('proxies'); }
    },
    async setEnabled(ids, on) { await wait(150); ids.forEach(id => px(id).enabled = on); emit('proxies'); },
    async setTag(ids, tag) { await wait(150); ids.forEach(id => px(id).tag = tag); emit('proxies'); },
    async setUse(ids, use) { await wait(150); ids.forEach(id => px(id).use = use); emit('proxies'); },
    async pin(id) { px(id).pinned = !px(id).pinned; emit('proxies'); },
    async remove(ids) { await wait(150); S.proxies = S.proxies.filter(p => !ids.includes(p.id)); emit('proxies'); },
    async generateMachine() { await wait(400); const m = { id: 'mc' + Date.now(), name: 'DESKTOP-' + hex(7).toUpperCase(), hwid: hex(32) }; S.machines.push(m); S.selectedMachine = m.id; emit('proxies'); },
    async selectMachine(id) { S.selectedMachine = id; emit('proxies'); },
  };

  /* ---------------- Groupes ---------------- */
  const groups = {
    async save(g) {
      if (!g.name) return fail('Donne un nom au groupe.');
      if (g.members.length < 2) return fail('Un groupe a au moins 2 comptes.');
      if (g.members.length > 8) return fail('8 comptes maximum.');
      await wait();
      S.accounts.forEach(a => { if (a.groupId === g.id) a.groupId = null; });
      if (!g.id) { g.id = 'g' + Date.now(); S.groups.push(g); } else Object.assign(S.groups.find(x => x.id === g.id), g);
      g.members.forEach(id => acc(id).groupId = g.id);
      emit('groups', 'accounts', 'sessions');
    },
    async remove(id) { await wait(); S.groups = S.groups.filter(g => g.id !== id); S.accounts.forEach(a => { if (a.groupId === id) a.groupId = null; }); emit('groups', 'accounts', 'sessions'); },
    async start(id) { await wait(); log('script', 'Groupe démarré : ' + S.groups.find(g => g.id === id).name); },
  };

  /* ---------------- Scripts ---------------- */
  const scripts = {
    async upload(files) {
      await wait(500);
      return [...files].map(f => {
        const ext = f.name.split('.').pop();
        const kind = ext === 'js' ? (f.name.includes('combat') ? 'fight' : 'session') : 'data';
        const list = S.scripts[kind]; const ex = list.find(x => x.file === f.name);
        const entry = { file: f.name, ok: true, hooks: kind === 'data' ? '' : 'main', api: kind === 'data' ? 0 : 8, origin: 'toi', modified: new Date().toLocaleString('fr-FR').slice(0, 16), versions: ex ? ex.versions + 1 : 0 };
        if (ex) Object.assign(ex, entry); else list.push(entry);
        emit('scripts');
        return { file: f.name, ok: true, msg: ex ? 'remplacé (ancienne version gardée)' : 'ajouté' };
      });
    },
    async download(kind, file) { await wait(150); return file; },
    async downloadDocs() { await wait(150); return 'bothors-api-scripts.md'; },
    async versions(kind, file) { await wait(200); const n = S.scripts[kind].find(x => x.file === file).versions; return Array.from({ length: n }, (_, i) => ({ id: i, date: '10/11/2026 2' + i + ':0' + i, size: rnd(2, 9) + ',' + rnd(0, 9) + ' Ko' })); },
    async restore(kind, file, versionId) { await wait(); log('info', `${file} remis à la version ${versionId === 'shipped' ? 'livrée' : '#' + versionId}`); emit('scripts'); },
    async rename(kind, file, name) {
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) return fail('Lettres sans accent, chiffres, _ et - uniquement.');
      await wait(); const s = S.scripts[kind].find(x => x.file === file); s.file = name + '.' + file.split('.').pop(); emit('scripts');
    },
    async remove(kind, file) { await wait(); S.scripts[kind] = S.scripts[kind].filter(x => x.file !== file); emit('scripts'); },
  };

  /* ---------------- Réglages ---------------- */
  const settings = {
    async save(key, value) { if (!value) return fail('Rien à enregistrer.'); await wait(); const k = S.settings[key]; if ('saved' in k) k.saved = '…' + value.slice(-4); else k.value = value; emit('settings'); },
    async remove(key) { await wait(); const k = S.settings[key]; if ('saved' in k) k.saved = ''; else k.value = ''; emit('settings'); },
    async test(key) { await wait(900); if (!S.settings[key]?.saved && key !== 'sms') return fail('Pas de clé enregistrée.'); return key === 'capsolver' ? 'Clé valide · solde 4,12 $' : 'Fournisseur joignable · solde 2,80 $'; },
    async addPins(text) { const codes = text.split(/[\s,]+/).filter(c => /^\d{16}$/.test(c)); if (!codes.length) return fail('Aucun code de 16 chiffres trouvé.'); await wait(); S.settings.pins.count += codes.length; emit('settings'); return codes.length; },
    async clearPins() { await wait(); S.settings.pins.count = 0; emit('settings'); },
    async discordTest() { await wait(600); if (!S.settings.discord.saved) return fail('Aucun webhook enregistré.'); return 'Message d’essai envoyé.'; },
  };

  /* ---------------- Statistiques ----------------
     get({ period: '24h'|'7d'|'30d', sessionIds: [] (vide = tous) })
     → { labels:[], bots:[{ id, name, level, kamas:[], xp:[], won:[], lost:[], resources:{nom:qté}, playMin }] }
     Chaque tableau a une valeur par tranche de `labels` (heure pour 24h, jour sinon). */
  const seeded = (k, i) => { const x = Math.sin(k * 12.9898 + i * 78.233) * 43758.5453; return x - Math.floor(x); };
  const RES = ['Blé', 'Frêne', 'Châtaignier', 'Orge', 'Noyer', 'Laine de Bouftou', 'Plume de Piou', 'Fer', 'Cuivre', 'Avoine'];
  const stats = {
    async get({ period = '7d', sessionIds = [] } = {}) {
      await wait(120);
      const n = period === '24h' ? 24 : period === '7d' ? 7 : 30, hourly = period === '24h';
      const now = new Date();
      const labels = Array.from({ length: n }, (_, i) => {
        const d = new Date(now - (n - 1 - i) * (hourly ? 3600e3 : 86400e3));
        return hourly ? d.getHours() + ' h' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
      });
      const list = S.sessions.filter(s => !sessionIds.length || sessionIds.includes(s.id));
      const bots = list.map((s, b) => {
        const a = acc(s.accountId), k = [...a.id + a.nick].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7) + b, mul = hourly ? 1 : 18;
        const won = labels.map((_, i) => Math.round(seeded(k, i) * 5 * mul / (hourly ? 1 : 2)));
        const resources = {}; RES.forEach((r, j) => { const v = Math.round(seeded(k + j, 99) * (j < 4 ? 900 : 260) * (n / 7)); if (v > 20) resources[r] = v; });
        return {
          id: s.id, name: a.character?.name || a.nick, level: a.character?.level,
          kamas: labels.map((_, i) => Math.round((800 + seeded(k, i + 50) * 2400) * mul / 10)),
          xp: labels.map((_, i) => Math.round((1500 + seeded(k, i + 7) * 6000) * mul / 4)),
          won, lost: won.map((w, i) => seeded(k, i + 3) < .25 ? Math.max(0, Math.round(w * .15)) : 0),
          resources, playMin: Math.round((hourly ? 18 : 60 * 9) * n * (.6 + seeded(k, 1) * .4)),
        };
      });
      return { labels, bots };
    },
  };

  /* ---------------- Agent IA ----------------
     Deux usages :
     1. Un agent EXTERNE (Claude Desktop, Claude Code, ChatGPT…) se connecte au bot par un serveur MCP
        avec un jeton ; `perms` limite ce qu'il a le droit de faire.
     2. L'assistant INTÉGRÉ : ask(texte) renvoie une réponse + un plan d'actions que l'utilisateur valide.
        À brancher : envoyer le texte + l'état au modèle côté serveur, qui renvoie { text, plan }.
        Ici, un petit analyseur de phrases simule le modèle. */
  S.agent = {
    token: null, mcpUrl: location.origin.replace(/^http:/, 'https:') + '/mcp',
    clients: [{ name: 'Claude Desktop', client: 'claude-desktop', last: new Date(Date.now() - 6 * 60e3), calls: 42 }],
    perms: { read: 'allow', scripts: 'allow', connect: 'confirm', chat: 'confirm', accounts: 'deny', buy: 'deny' },
    model: { provider: 'anthropic', model: 'claude-opus-5-5', key: '' },
    messages: [{ role: 'ai', text: 'Salut ! Dis-moi ce que tes bots doivent faire, par exemple « lance la récolte sur la Team récolte » ou « combien de kamas aujourd’hui ? ». Je te montre toujours le plan avant d’agir.' }],
    log: [],
  };
  const agentPlanRun = {
    start: ({ ids, script }) => sessions.startScript(ids, script),
    stop: ({ ids }) => sessions.stopScript(ids),
    fight: ({ ids, script }) => sessions.loadFight(ids, script),
    connect: ({ ids }) => accounts.connect(ids),
    disconnect: ({ id }) => sessions.disconnect(id),
    say: ({ id, channel, text }) => sessions.say(id, channel, '', text),
  };
  function parseIntent(text) {
    const norm = x => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const t = norm(text);
    const scriptNames = S.scripts.session.filter(x => !x.template && x.ok).map(x => x.file.replace(/\.js$/, ''));
    const fightNames = S.scripts.fight.filter(x => !x.template && x.ok).map(x => x.file.replace(/\.js$/, ''));
    const name = s => acc(s.accountId).character?.name || acc(s.accountId).nick;
    // cibles : noms de perso, nom de groupe, « tous »
    let targets = S.sessions.filter(s => t.includes(norm(name(s))));
    S.groups.forEach(g => { if (t.includes(norm(g.name))) targets.push(...S.sessions.filter(s => g.members.includes(s.accountId))); });
    if (!targets.length && /\b(tous|toutes|tout le monde|les bots|chaque)\b/.test(t)) targets = [...S.sessions];
    targets = [...new Set(targets)];
    const script = scriptNames.find(n => t.includes(n)) || (/recolt|farm|bucheron|paysan/.test(t) ? 'recolte' : /chasse/.test(t) ? 'chasse' : null);
    const fight = fightNames.find(n => t.includes(n));
    const who = targets.map(name).join(', ');

    if (/kamas|stat|combien|bilan|resume|xp/.test(t)) {
      const k = S.sessions.reduce((a, s) => a + s.kamas, 0);
      return { text: `En ce moment : **${S.sessions.length} bots en jeu**, ${S.sessions.filter(s => s.scriptRunning).length} scripts actifs, **${k.toLocaleString('fr-FR')} kamas** au total dans les inventaires. Le détail par bot et par jour est dans la page Statistiques.`, plan: [] };
    }
    if (/\bou\b|position|carte/.test(t)) return { text: S.sessions.map(s => `• ${name(s)} : ${s.map.sub} [${s.map.x},${s.map.y}] — ${s.status}`).join('\n') || 'Aucun bot en jeu.', plan: [] };
    if (/connect/.test(t) && !/deconnect/.test(t)) {
      const off = S.accounts.filter(a => a.state === 'offline' && (/tous|toutes|comptes/.test(t) || t.includes(norm(a.nick))));
      if (!off.length) return { text: 'Je n’ai trouvé aucun compte hors ligne correspondant. Dis par exemple « connecte tous les comptes » ou « connecte Rafofe ».', plan: [] };
      return { text: `Je vais connecter ${off.length} compte(s) sans client.`, plan: off.map(a => ({ kind: 'connect', perm: 'connect', label: `Connecter ${a.nick + a.tag}`, args: { ids: [a.id] } })) };
    }
    if (/deconnect/.test(t)) {
      if (!targets.length) return { text: 'Quels bots dois-je déconnecter ? Donne leurs noms ou dis « tous ».', plan: [] };
      return { text: `Je vais déconnecter : ${who}.`, plan: targets.map(s => ({ kind: 'disconnect', perm: 'connect', risky: true, label: `Déconnecter ${name(s)}`, args: { id: s.id } })) };
    }
    if (/arret|stop|pause/.test(t)) {
      if (!targets.length) targets = S.sessions.filter(s => s.scriptRunning);
      return { text: targets.length ? `J’arrête le script de : ${targets.map(name).join(', ')}. Ils restent connectés.` : 'Aucun script ne tourne.', plan: targets.length ? [{ kind: 'stop', perm: 'scripts', label: `Arrêter le script (${targets.length} bot${targets.length > 1 ? 's' : ''})`, args: { ids: targets.map(s => s.id) } }] : [] };
    }
    if (fight && /combat/.test(t)) {
      if (!targets.length) targets = [...S.sessions];
      return { text: `Je charge le script de combat « ${fight} » sur ${targets.map(name).join(', ')}.`, plan: [{ kind: 'fight', perm: 'scripts', label: `Charger le combat ${fight}`, args: { ids: targets.map(s => s.id), script: fight } }] };
    }
    if (/lance|demarre|start|fais|va |mets/.test(t)) {
      if (!script) return { text: `Quel script ? Disponibles : ${scriptNames.join(', ')}.`, plan: [] };
      if (!targets.length) return { text: `Sur quels bots lancer « ${script} » ? Donne des noms, un groupe (${S.groups.map(g => g.name).join(', ') || 'aucun'}) ou « tous ».`, plan: [] };
      return { text: `Je lance « ${script} » sur ${who}.`, plan: [{ kind: 'start', perm: 'scripts', label: `Démarrer ${script} sur ${targets.length} bot${targets.length > 1 ? 's' : ''}`, args: { ids: targets.map(s => s.id), script } }] };
    }
    if (/dis|ecris|message|chat/.test(t) && targets.length) {
      const msg = text.split(/[:«"]/).slice(1).join(':').replace(/[»"]/g, '').trim() || 'salut';
      return { text: `${who} va écrire « ${msg} » dans le chat général.`, plan: targets.map(s => ({ kind: 'say', perm: 'chat', label: `${name(s)} écrit « ${msg} »`, args: { id: s.id, channel: 'general', text: msg } })) };
    }
    return { text: 'Je peux lancer ou arrêter des scripts, charger un script de combat, connecter / déconnecter des comptes, faire parler un personnage, donner les positions ou un bilan. Essaie une des suggestions ci-dessous.', plan: [] };
  }
  const agent = {
    async createToken() { await wait(); S.agent.token = 'bh_' + hex(32); emit('agent'); return S.agent.token; },
    async revokeToken() { await wait(); S.agent.token = null; S.agent.clients = []; emit('agent'); },
    async setPerm(key, value) { S.agent.perms[key] = value; emit('agent'); },
    async saveModel(m) { await wait(); if (m.key) m.key = '…' + m.key.slice(-4); else m.key = S.agent.model.key; S.agent.model = m; emit('agent'); },
    async ask(text) {
      S.agent.messages.push({ role: 'me', text }); S.agent.thinking = true; emit('agent');
      await wait(700);
      const r = parseIntent(text);
      r.plan.forEach(p => { p.mode = S.agent.perms[p.perm]; });
      const msg = { role: 'ai', text: r.text, plan: r.plan.length ? { steps: r.plan, state: r.plan.some(p => p.mode === 'deny') ? 'blocked' : 'pending' } : null };
      S.agent.messages.push(msg);
      S.agent.thinking = false; emit('agent');
      // Toutes les étapes « Autorisé » : l'assistant agit sans demander.
      if (msg.plan && msg.plan.state === 'pending' && msg.plan.steps.every(p => p.mode === 'allow')) { msg.plan.auto = true; await agent.execute(msg); }
    },
    async execute(msg) {
      msg.plan.state = 'running'; emit('agent');
      for (const step of msg.plan.steps) {
        try { await agentPlanRun[step.kind](step.args); step.done = true; S.agent.log.push([new Date(), 'Assistant', step.label, true]); }
        catch (e) { step.error = e.message; S.agent.log.push([new Date(), 'Assistant', step.label + ' — ' + e.message, false]); }
        emit('agent');
      }
      msg.plan.state = 'done'; emit('agent');
    },
    cancel(msg) { msg.plan.state = 'cancelled'; emit('agent'); },
    clear() { S.agent.messages = S.agent.messages.slice(0, 1); emit('agent'); },
  };

  /* ---------------- HDV (hôtel des ventes) ----------------
     Serveurs suivis : Allisteria et Boune.
     state.hdv = { sales[], listings[], rules[], taxes[], market{serveur:[…]} }
     Le serveur pousse chaque vente en direct : S.hdv.sales.push(vente) puis emit('hdv'). */
  const HDV_SERVERS = ['Allisteria', 'Boune'];
  const ITEMS = [
    ['Blé', '🌾', 9], ['Frêne', '🪵', 14], ['Orge', '🌿', 22], ['Châtaignier', '🌰', 18], ['Noyer', '🪵', 31],
    ['Laine de Bouftou', '🧶', 12], ['Plume de Piou', '🪶', 7], ['Cuir de Bouftou', '🟫', 26], ['Fer', '⛓️', 40],
    ['Pain d’Incarnam', '🍞', 15], ['Potion de vie mineure', '🧪', 55], ['Houblon', '🍃', 48],
  ];
  const LOTS = [1, 10, 100];
  const botsOn = server => S.sessions.filter(s => acc(s.accountId).character?.server === server);
  const botName = s => acc(s.accountId).character?.name;
  const mkSale = (t, server, botLabel) => {
    const [item, emoji, unit] = ITEMS[rnd(0, ITEMS.length - 1)], lot = LOTS[rnd(0, 2)];
    const price = Math.round(unit * lot * (0.85 + Math.random() * .3) * (lot === 100 ? .9 : 1));
    return { id: 'v' + t + Math.random(), t: new Date(t), server, bot: botLabel, item, emoji, lot, price };
  };
  S.hdv = { sales: [], listings: [], rules: [], taxes: [], market: {} };
  (() => { // 30 jours d'historique fictif
    const now = Date.now();
    HDV_SERVERS.forEach((srv, k) => {
      const names = srv === 'Allisteria' ? ['Phat-Vaiyo', 'Unde-Cedre'] : ['Sh-ired'];
      for (let t = now - 30 * 86400e3; t < now; t += rnd(6, 30) * 60e3 * (k ? 1.6 : 1)) S.hdv.sales.push(mkSale(t, srv, names[rnd(0, names.length - 1)]));
      S.hdv.market[srv] = ITEMS.map(([item, emoji, unit]) => ({ item, emoji, unit: Math.round(unit * (0.9 + Math.random() * .25)), min: Math.round(unit * .85), volume: rnd(40, 900), trend: rnd(-12, 15) }));
    });
    S.hdv.sales.sort((a, b) => a.t - b.t);
    S.hdv.sales.forEach(s => S.hdv.taxes.push({ t: s.t, server: s.server, kind: 'list', amount: Math.ceil(s.price * .02) }));
    for (let i = 0; i < 40; i++) { const s = S.hdv.sales[rnd(0, S.hdv.sales.length - 1)]; S.hdv.taxes.push({ t: s.t, server: s.server, kind: 'edit', amount: Math.ceil(s.price * .01) }); }
    HDV_SERVERS.forEach(srv => {
      const names = srv === 'Allisteria' ? [['se_ac2', 'Phat-Vaiyo'], ['se_ac3', 'Unde-Cedre']] : [['se_ac5', 'Sh-ired']];
      for (let i = 0; i < 9; i++) { const x = mkSale(now - rnd(5, 600) * 60e3, srv, ''); const b = names[rnd(0, names.length - 1)]; S.hdv.listings.push({ ...x, id: 'l' + i + srv, sessionId: b[0], bot: b[1], since: x.t }); }
    });
    S.hdv.rules = [
      { id: 'r1', on: true, server: 'Allisteria', item: 'Blé', lot: 100, strategy: 'undercut', price: 0, floor: 700, keep: 200, maxListings: 5 },
      { id: 'r2', on: true, server: 'Allisteria', item: 'Frêne', lot: 10, strategy: 'average', price: 0, floor: 110, keep: 0, maxListings: 8 },
      { id: 'r3', on: false, server: 'Boune', item: 'Laine de Bouftou', lot: 100, strategy: 'fixed', price: 1150, floor: 1000, keep: 0, maxListings: 3 },
    ];
  })();
  const hdv = {
    servers: HDV_SERVERS, items: ITEMS, lots: LOTS,
    /** Stats sur une fenêtre : period '1h'|'12h'|'24h'|'7d'|'30d', server '' = tous. */
    stats({ period = '24h', server = '' }) {
      const ms = { '1h': 3600e3, '12h': 12 * 3600e3, '24h': 86400e3, '7d': 7 * 86400e3, '30d': 30 * 86400e3 }[period];
      const n = { '1h': 12, '12h': 12, '24h': 24, '7d': 7, '30d': 30 }[period], from = Date.now() - ms, step = ms / n;
      const inWin = x => +x.t >= from && (!server || x.server === server);
      const sales = S.hdv.sales.filter(inWin), taxes = S.hdv.taxes.filter(inWin);
      const revenue = sales.reduce((a, s) => a + s.price, 0), units = sales.reduce((a, s) => a + s.lot, 0);
      const labels = Array.from({ length: n }, (_, i) => { const d = new Date(from + step * (i + 1)); return period === '1h' ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ms <= 86400e3 ? d.getHours() + ' h' : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }); });
      const byServer = (server ? [server] : HDV_SERVERS).map(srv => ({ server: srv, values: labels.map((_, i) => sales.filter(s => s.server === srv && +s.t >= from + step * i && +s.t < from + step * (i + 1)).reduce((a, s) => a + s.price, 0)) }));
      const items = {};
      sales.forEach(s => { const it = items[s.item] ||= { item: s.item, emoji: s.emoji, revenue: 0, units: 0, sales: 0, last: s.t }; it.revenue += s.price; it.units += s.lot; it.sales++; if (s.t > it.last) it.last = s.t; });
      return {
        revenue, units, count: sales.length, avg: units ? revenue / units : 0, velocity: units / (ms / 3600e3),
        taxList: taxes.filter(t => t.kind === 'list').reduce((a, t) => a + t.amount, 0), taxEdit: taxes.filter(t => t.kind === 'edit').reduce((a, t) => a + t.amount, 0),
        labels, byServer, items: Object.values(items).sort((a, b) => b.revenue - a.revenue),
      };
    },
    async sell({ sessionId, server, item, lot, count, price }) {
      if (!sessionId) return fail('Choisis le bot vendeur.');
      if (!(price > 0)) return fail('Indique un prix.');
      await wait(500);
      const it = ITEMS.find(i => i[0] === item);
      for (let i = 0; i < count; i++) {
        S.hdv.listings.push({ id: 'l' + Date.now() + i, t: new Date(), since: new Date(), server, sessionId, bot: botName(ses(sessionId)), item, emoji: it[1], lot, price });
        S.hdv.taxes.push({ t: new Date(), server, kind: 'list', amount: Math.ceil(price * .02) });
      }
      emit('hdv');
    },
    async reprice(id, price) { await wait(250); const l = S.hdv.listings.find(x => x.id === id); S.hdv.taxes.push({ t: new Date(), server: l.server, kind: 'edit', amount: Math.ceil(price * .01) }); l.price = price; emit('hdv'); },
    async unlist(ids) { await wait(250); S.hdv.listings = S.hdv.listings.filter(l => !ids.includes(l.id)); emit('hdv'); },
    async saveRule(r) { if (!r.item) return fail('Choisis une ressource.'); await wait(200); if (r.id) Object.assign(S.hdv.rules.find(x => x.id === r.id), r); else S.hdv.rules.push({ ...r, id: 'r' + Date.now() }); emit('hdv'); },
    async toggleRule(id) { const r = S.hdv.rules.find(x => x.id === id); r.on = !r.on; emit('hdv'); },
    async removeRule(id) { await wait(150); S.hdv.rules = S.hdv.rules.filter(x => x.id !== id); emit('hdv'); },
    async refreshMarket(server) { await wait(900); S.hdv.market[server].forEach(m => { m.unit = Math.max(1, Math.round(m.unit * (0.95 + Math.random() * .1))); m.trend = rnd(-12, 15); }); emit('hdv'); },
    botsOn,
  };
  // Démo : une vente en direct toutes les quelques secondes (prise dans les objets en vente)
  setInterval(() => {
    if (Math.random() < .45 || !S.hdv.listings.length) return;
    const l = S.hdv.listings.splice(rnd(0, S.hdv.listings.length - 1), 1)[0];
    S.hdv.sales.push({ ...l, id: 'v' + Date.now(), t: new Date(), fresh: true });
    S.hdv.listings.push({ ...mkSale(Date.now(), l.server, l.bot), id: 'l' + Date.now(), sessionId: l.sessionId, bot: l.bot, since: new Date() });
    emit('hdv');
  }, 3500);

  /* ---------------- Prix du kamas (ventekamas.com) ----------------
     Source : https://ventekamas.com/vk-prices.json → { success, generated, prices:[{ server:'allisteria', paypal, skrill, bitcoin, usdt, sepa, pix, maroc, … }] }
     Les valeurs = ce que ventekamas paie pour 1 million de kamas (€ ; pix en BRL, maroc en MAD).
     Le site n'envoie pas d'en-tête CORS : le navigateur ne peut pas l'appeler directement.
     → À BRANCHER : un relais côté serveur (ex. GET /api/kamas-rates qui renvoie le JSON de ventekamas).
     En attendant, on garde un relevé du 11/11/2026. */
  const KAMAS_RATES_URL = '/api/kamas-rates';
  const RATES_SNAPSHOT = { generated: '2026-11-11T01:45:00', prices: [
    { server: 'allisteria', paypal: 0.819, skrill: 0.819, bitcoin: 0.807, usdt: 0.901, sepa: 0.791 },
    { server: 'boune', paypal: 2.623, skrill: 2.623, bitcoin: 2.583, usdt: 2.885, sepa: 2.532 },
  ] };
  // Chaque relevé réel est aussi gardé dans le navigateur (en plus de l'historique du relais).
  const LOCAL_HIST = 'kamas-rates-history';
  const keepLocal = j => { try { const h = JSON.parse(localStorage.getItem(LOCAL_HIST) || '[]'); if (!h.length || h[h.length - 1].t !== j.generated) { h.push({ t: j.generated, prices: j.prices.filter(p => ['allisteria', 'boune'].includes(p.server)) }); localStorage.setItem(LOCAL_HIST, JSON.stringify(h.slice(-2000))); } } catch (e) {} };
  const kamasRates = {
    async get() {
      try {
        const r = await fetch(KAMAS_RATES_URL, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        if (!j.prices) throw new Error('format');
        keepLocal(j);
        return { live: true, generated: j.generated || new Date().toISOString(), prices: j.prices };
      } catch (e) {
        return { live: false, ...RATES_SNAPSHOT };
      }
    },
    /** Historique { source:'relais'|'navigateur'|'demo', points:[{ t, prices:[{server, paypal, …}] }] }.
        À BRANCHER : GET /api/kamas-rates/history?days=7 — le relais enregistre vk-prices.json toutes les 10 min. */
    async history(days = 7) {
      try {
        const r = await fetch(KAMAS_RATES_URL + '/history?days=' + days, { cache: 'no-store' });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        return { source: 'relais', points: j.points };
      } catch (e) {}
      try { const h = JSON.parse(localStorage.getItem(LOCAL_HIST) || '[]').filter(p => Date.now() - new Date(p.t) < days * 86400e3); if (h.length >= 6) return { source: 'navigateur', points: h }; } catch (e) {}
      // Démo : marche aléatoire qui finit sur le relevé réel du 11/11. À NE PAS prendre pour de vraies données.
      const n = days * 24, end = new Date(RATES_SNAPSHOT.generated).getTime();
      const walk = base => { const out = [base]; for (let i = 1; i < n; i++) out.unshift(out[0] * (1 + (seeded(base * 100, i) - .5) * .03)); return out; };
      const wa = walk(0.819), wb = walk(2.623);
      return { source: 'demo', points: Array.from({ length: n }, (_, i) => ({ t: new Date(end - (n - 1 - i) * 3600e3).toISOString(), prices: [
        { server: 'allisteria', paypal: +wa[i].toFixed(3), skrill: +wa[i].toFixed(3), bitcoin: +(wa[i] * .985).toFixed(3), usdt: +(wa[i] * 1.1).toFixed(3), sepa: +(wa[i] * .966).toFixed(3) },
        { server: 'boune', paypal: +wb[i].toFixed(3), skrill: +wb[i].toFixed(3), bitcoin: +(wb[i] * .985).toFixed(3), usdt: +(wb[i] * 1.1).toFixed(3), sepa: +(wb[i] * .965).toFixed(3) },
      ] })) };
    },
  };

  const misc = {
    async logout() { await wait(); location.reload(); },
    clearEvents() { S.events = []; emit('events'); },
    clearConsole() { S.console = []; emit('console'); },
  };

  // Petite simulation de vie pour la démo (à supprimer une fois branché)
  setInterval(() => {
    S.sessions.forEach(s => {
      if (!s.scriptRunning) return;
      if (Math.random() < .5) { s.xpPct = Math.min(100, s.xpPct + 1); s.kamas += rnd(0, 40); }
      if (Math.random() < .3) s.journal.push([new Date(), 'recolte', 'Blé ×' + rnd(1, 5) + ' récolté']);
    });
    emit('sessions');
  }, 4000);

  return { state: S, on, emit, sessions, accounts, proxies, groups, scripts, settings, stats, agent, hdv, kamasRates, ...misc, helpers: { acc, ses, accName } };
})();
