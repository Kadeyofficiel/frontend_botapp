/* =========================================================
   DONNÉES FICTIVES — uniquement pour voir l'interface.
   Quand le front est branché au vrai bot, ce fichier ne sert plus
   (voir js/api.js et README.md).
   ========================================================= */
window.MOCK = (function () {
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = a => a[rnd(0, a.length - 1)];
  const hex = n => Array.from({ length: n }, () => '0123456789abcdefghijklmnopqrstuvwxyz'[rnd(0, 35)]).join('');

  const SERVERS = ['Boune', 'Allisteria', 'Fallanster'];
  const BREEDS = ['Féca', 'Osamodas', 'Enutrof', 'Sram', 'Xélor', 'Ecaflip', 'Eniripsa', 'Iop', 'Crâ', 'Sadida', 'Sacrieur', 'Pandawa'];

  const scripts = {
    session: [
      { file: '_modele.js', ok: true, hooks: 'main, onChat', api: 1, origin: 'livré', modified: '09/11/2026 15:48', template: true, versions: 0 },
      { file: '1to60.js', ok: true, hooks: 'onPacket, main', api: 7, origin: 'toi', modified: '11/11/2026 00:05', versions: 1 },
      { file: 'annonce.js', ok: true, hooks: 'main', api: 1, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'chasse-pichon.js', ok: true, hooks: 'onPacket, main', api: 6, origin: 'toi', modified: '10/11/2026 20:42', versions: 0 },
      { file: 'chasse.js', ok: true, hooks: 'onPacket, main', api: 6, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'chemins.js', ok: true, hooks: 'main, onPacket, onMap', api: 1, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'dolwoand.js', ok: true, hooks: 'onPacket, main', api: 6, origin: 'toi', modified: '10/11/2026 20:45', versions: 0 },
      { file: 'inventaire.js', ok: true, hooks: 'main', api: 1, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'pnj.js', ok: true, hooks: 'main, onPacket', api: 1, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'recolte.js', ok: true, hooks: 'onPacket, main', api: 5, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'sortie-incarnam.js', ok: true, hooks: 'main', api: 4, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'test-geev2.js', ok: false, hooks: '', api: 0, origin: 'toi', modified: '10/11/2026 23:10', versions: 2, error: 'SyntaxError ligne 42 : « } » attendu' },
      { file: 'veille.js', ok: true, hooks: 'main', api: 1, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'voyage.js', ok: true, hooks: 'main', api: 3, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
    ],
    fight: [
      { file: '_modele.js', ok: true, hooks: 'onFightStart, onPlacement, onTurn, onEvent, onFightEnd', api: 1, origin: 'livré', modified: '09/11/2026 15:48', template: true, versions: 0 },
      { file: 'defaut.js', ok: true, hooks: 'onPlacement, onTurn', api: 1, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
      { file: 'sadida.js', ok: true, hooks: 'onPlacement, onTurn', api: 1, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
    ],
    data: [
      { file: 'zones-et-metiers.txt', ok: true, hooks: '', api: 0, origin: 'livré', modified: '09/11/2026 15:48', versions: 0 },
    ],
  };

  const proxies = Array.from({ length: 24 }, (_, i) => ({
    id: 'px' + i,
    host: 'mobile.lightningproxies.net', port: 1080, session: hex(10),
    tag: i < 12 ? 'lightning-fr' : 'lightning-ca',
    use: i % 2 ? 'create' : 'game',
    latency: rnd(780, 1150),
    clients: 0, max: 1,
    enabled: i !== 7,
    state: i === 5 ? 'fail' : i === 9 ? 'untested' : 'ok',
    last: i === 5 ? 'refusé (timeout 10 s)' : i === 9 ? '—' : 'il y a ' + rnd(1, 20) + ' h',
    pinned: false,
  }));

  const accountsRaw = [
    ['Midozajdi', 4307, 'unknown', null, 'Ankh-Ra', 'Allisteria', 'Iop'],
    ['Rafofe', 3163, 'unknown', null, null, null, null],
    ['Ligkuravud', 6155, 'active', { days: 4, hours: 12, until: '15/11 13:10' }, 'Phat-Vaiyo', 'Allisteria', 'Crâ'],
    ['Tahmizi', 9972, 'active', { days: 4, hours: 12, until: '15/11 14:22' }, 'Unde-Cedre', 'Allisteria', 'Sadida'],
    ['Fmpowa', 9795, 'active', { days: 4, hours: 6, until: '15/11 07:43' }, null, null, null],
    ['Nuksavom', 1331, 'active', { days: 5, hours: 21, until: '16/11 22:30' }, 'Sh-ired', 'Boune', 'Eniripsa'],
  ];
  const accounts = accountsRaw.map(([nick, tag, sub, subInfo, char, server, breed], i) => ({
    id: 'ac' + i,
    nick, tag: '#' + tag,
    email: nick.toLowerCase() + rnd(10, 99) + '@outlook.com',
    phone: false, certified: i !== 4,
    sub: { state: sub, ...(subInfo || {}) },
    proxyId: proxies[i * 2].id,
    script: i === 2 ? 'sortie-incarnam' : i === 3 ? 'recolte' : '',
    charMode: 'last',
    character: char ? { name: char, server, breed, level: rnd(12, 60) } : null,
    state: i === 2 || i === 3 || i === 5 ? 'ingame' : 'offline',
    groupId: i === 2 || i === 3 ? 'g1' : null,
  }));

  const COLORS = ['#e8792b', '#5865f2', '#23a55a', '#a970ff', '#2ec4d6', '#f0b232'];
  const sessions = accounts.filter(a => a.state === 'ingame').map((a, i) => ({
    id: 'se_' + a.id, accountId: a.id,
    color: COLORS[i % COLORS.length],
    status: ['Récolte', 'En combat', 'En déplacement'][i % 3],
    hp: [255, 140, 330][i], hpMax: [255, 255, 330][i],
    energy: [6690, 9800, 10000][i], energyMax: 10000,
    pods: [153, 840, 37][i], podsMax: [1630, 1630, 1000][i],
    kamas: [2881, 881361, 31002][i], xpPct: [57, 66, 12][i],
    map: { id: [7411, 150735109, 7396][i], x: [2, 1, 3][i], y: [-20, -21, -18][i], zone: 'Astrub', sub: ['Cité d’Astrub', 'Faubourgs d’Astrub', 'Champs d’Astrub'][i], cell: [298, 409, 351][i] },
    script: a.script || '', scriptRunning: !!a.script, fight: i === 1 ? 'sadida' : 'defaut',
    stats: { vitalite: [0, 55, 20][i], sagesse: 0, force: [55, 0, 10][i], intelligence: [45, 120, 0][i], chance: 0, agilite: 0, pa: 6, pm: 3, initiative: 230, prospection: 110, capital: [43, 0, 5][i] },
    spells: [
      { id: 161, name: 'Flèche Magique', level: 3 }, { id: 1627, name: 'Flèche Enflammée', level: 2 },
      { id: 1823, name: 'Maîtrise de l’Arc', level: 1 }, { id: 1813, name: 'Flèche de Recul', level: 1 },
    ],
    inventory: [
      { name: 'Bois de Frêne', emoji: '🪵', qty: 229, kind: 'ressource', lvl: 1, weight: 5 },
      { name: 'Blé', emoji: '🌾', qty: 248, kind: 'ressource', lvl: 1, weight: 1 },
      { name: 'Plume de Piou', emoji: '🪶', qty: 119, kind: 'ressource', lvl: 1, weight: 1 },
      { name: 'Pain d’Incarnam', emoji: '🍞', qty: 12, kind: 'consommable', lvl: 1, weight: 1 },
      { name: 'Potion de rappel', emoji: '🧪', qty: 3, kind: 'consommable', lvl: 1, weight: 1 },
      { name: 'Coiffe du Bouftou', emoji: '🪖', qty: 1, kind: 'equipement', lvl: 10, weight: 4, equipped: true },
      { name: 'Cape du Bouftou', emoji: '🧣', qty: 1, kind: 'equipement', lvl: 10, weight: 4, equipped: true },
      { name: 'Anneau de Sagesse', emoji: '💍', qty: 1, kind: 'equipement', lvl: 22, weight: 2 },
      { name: 'Laine de Bouftou', emoji: '🧶', qty: 64, kind: 'ressource', lvl: 1, weight: 1 },
      { name: 'Cuir de Bouftou', emoji: '🟫', qty: 27, kind: 'ressource', lvl: 1, weight: 2 },
      { name: 'Trousseau de clefs', emoji: '🗝️', qty: 1, kind: 'quete', lvl: 1, weight: 0 },
      { name: 'Parchemin de Sagesse', emoji: '📜', qty: 2, kind: 'consommable', lvl: 1, weight: 1 },
    ],
    journal: [], chat: [],
    mapEntities: {
      monsters: [{ name: 'Piou Rose', lvl: 26, cell: 350 }, { name: 'Piou Jaune', lvl: 22, cell: 109 }, { name: 'Piou Violet', lvl: 25, cell: 192 }],
      npcs: i === 0 ? [{ name: 'Vendeur Pêcheur d’Astrub', cell: 263 }] : [],
      players: [{ name: 'Barbarbre', cell: 156 }],
      resources: [{ name: 'Frêne', cell: 227 }, { name: 'Châtaignier', cell: 216 }],
      doors: [81, 198, 150, 202],
    },
  }));

  const now = Date.now();
  const t = m => new Date(now - m * 60000);
  sessions.forEach(s => {
    s.journal = [
      [t(30), 'auth', 'Connexion login par proxy WS…'], [t(30), 'auth', 'Identifié, serveur choisi'],
      [t(29), 'info', 'En jeu : ' + s.map.zone + ' — ' + s.map.sub + ' [' + s.map.x + ',' + s.map.y + ']'],
      [t(28), 'script', 'Script « ' + (s.script || 'aucun') + ' » démarré'],
      [t(20), 'recolte', 'Récolte de Blé (cell 373)'], [t(19), 'recolte', 'Blé ×4 récolté (10.1 s)'],
      [t(12), 'combat', 'Combat lancé (2 combattants)'], [t(11), 'combat', 'Combat terminé : victoire, +346 XP'],
      [t(4), 'quete', 'QuestStepInfo q=4799 obj=1'], [t(1), 'script', 'Déplacement vers (6,155) : 17 cases'],
    ];
    s.chat = [
      [t(14), 'commerce', 'Hunter-Oo', 'Achète ressources Bouftou, mp prix'],
      [t(9), 'recrutement', 'Grates-x', 'Recrute guilde full chall, mp'],
      [t(6), 'general', 'Exico', 'quelqu’un sait où est le zaap d’Astrub ?'],
      [t(2), 'prive', 'Barbarbre', 'salut, tu vends ta laine ?'],
    ];
  });

  return {
    user: { name: 'mehdi', wsId: 'ugbmng7c' },
    servers: SERVERS, breeds: BREEDS,
    scripts, proxies, accounts, sessions,
    proxyMode: { mode: 'per-client', max: 1 },
    machines: [],
    groups: [{ id: 'g1', name: 'Team récolte', server: 'Allisteria', leaderId: 'ac3', members: ['ac3', 'ac2'], script: 'recolte' }],
    events: [
      { t: t(42), kind: 'ok', icon: 'check', text: 'Tahmizi#9972 connecté sans client', sub: 'via proxy mobile.lightningproxies.net (p2a88loafj)' },
      { t: t(40), kind: 'ok', icon: 'check', text: 'Ligkuravud#6155 connecté sans client', sub: 'Phat-Vaiyo · Allisteria' },
      { t: t(25), kind: 'warn', icon: 'alert', text: 'Proxy refusé : timeout 10 s', sub: 'mobile.lightningproxies.net (' + proxies[5].session + ')' },
      { t: t(8), kind: 'err', icon: 'shield', text: 'Code Shield demandé pour Rafofe#3163', sub: 'Le bot lit la boîte mail du compte…' },
      { t: t(3), kind: 'ok', icon: 'swords', text: 'Combat gagné · Unde-Cedre', sub: '+346 XP, 1 objet' },
    ],
    console: [
      [t(45), 'info', 'Dashboard connecté.'],
      [t(42), 'script', '[Tahmizi] script recolte démarré (API 5)'],
      [t(30), 'combat', '[Unde-Cedre] combat 1616030747 lancé'],
      [t(29), 'combat', '[Unde-Cedre] victoire en 3 tours'],
      [t(10), 'script', '[Phat-Vaiyo] sortie-incarnam : étape 3/5'],
    ],
    settings: {
      capsolver: { saved: '…AA99' },
      smsProvider: { value: '' },
      heroSms: { saved: '…0d96' }, heroCountry: { value: '' },
      nonVoip: { saved: '' }, ankamaCountry: { value: '' },
      pins: { count: 1 }, pinCountry: { value: '' },
      discord: { saved: '' },
    },
    registerSource: { free: 46, total: 46 },
    hint: { rnd, pick, hex },
  };
})();
