# Bothors — nouveau front

Refonte de l'interface de app.bothors.com, au style MoonBot (gris Discord + indigo, police Inter).
HTML/CSS/JS pur : **aucune installation, aucun build**. Pour l'instant il tourne sur des **données fictives**.

## Lancer

```
npx http-server -p 5178 -c-1
```
puis ouvrir http://localhost:5178 (ouvrir `index.html` directement marche aussi).

## Pages

| Page | Contenu |
|---|---|
| Tableau de bord | compteurs, événements, console filtrable, script de session / de combat et commande `.bot` vers les sessions cochées à gauche, « Tout arrêter » |
| Bot | une session : PV / énergie / pods / kamas / XP, script en cours, onglets Journal, Personnage (caracs, sorts), Inventaire, Chat (8 canaux + MP), Carte (iso cliquable, flèches, monstres/PNJ/joueurs/ressources/soleils) |
| Comptes | tableau (abonnement, proxy, script au démarrage, personnage, état), actions groupées, ajout email/mdp, création en masse, menu ⋯ (boîte mail, proxy, téléphone, Shield, abonnement, retirer), modales Personnage / Abonnement / Connexion |
| Proxies | modes Sans proxy / Même proxy / Un par client + max par proxy, compteurs cliquables (filtres), recherche, étiquettes, actions groupées, tests, ajout en lot ou fichier, machines HWID, journal |
| Statistiques | période 24 h / 7 j / 30 j, filtre par bot, compteurs (kamas, kamas/h, XP, combats V/D, ressources, temps de jeu), courbes et barres avec survol, tableau par bot, export CSV. Aussi en onglet « Stats » dans la vue Bot |
| HDV | serveurs Allisteria / Boune / tous, périodes 1 h → 30 j, compteurs (recette, unités, prix moyen, vélocité, taxes 2 % / 1 %, lots en vente), recette sur la durée par serveur, **ventes live**, lots en vente (comparés au marché, modifier prix, retirer), ventes par ressource, marché analysé, règles de **vente auto** (prix sous le moins cher / moyen / fixe, plancher, quantité gardée), fenêtre « Mettre en vente » |
| Rentabilité | calculateur Pévétons → parchemins → kamas → € (modèle : calculateur Koli de Nezubot). Combats/jour, winrate (curseur), comptes, Pévétons/victoire, victoires max/compte ; prix des 5 parchemins ; prix du kamas Allisteria/Boune **en direct depuis ventekamas** (ou forcé) ; coûts (abo, frais paysafecard, cert, mail, commission). Résultats par compte, par jour, flotte (jour/30 j/an), graphique 30 j, tableau winrate 30→70 %, meilleur échange pour un stock de Pévétons, résumé copiable. Réglages gardés dans le navigateur |
| Agent IA | **assistant** : ordres en français → plan d'actions (exécuté seul si tout est « Autorisé », sinon bouton Exécuter) ; **agent externe** : jeton + adresse MCP + config Claude Desktop / Claude Code / HTTP ; permissions (Autorisé / Confirmation / Interdit) ; choix du modèle ; activité |
| Groupes | jusqu'à 8 comptes, meneur, script, contrôles (même serveur, un seul groupe par compte) |
| Scripts | import glisser-déposer, doc pour IA, tableaux session / combat / données, versions, renommer, supprimer |
| Réglages | CapSolver, numéros SMS (hero-sms / non-voip), codes PIN paysafecard, webhook Discord |

La colonne de gauche (sessions regroupées par groupe) apparaît sur le Tableau de bord et Bot.

## Brancher sur le vrai bot — un seul fichier : `js/api.js`

- `Api.state` contient tout l'état affiché (sa forme est donnée par `js/mock.js`).
- Chaque action (`Api.accounts.connect(ids)`, `Api.proxies.test(ids)`, `Api.sessions.command(ids, text)`, …) renvoie une Promise.
  Remplacer leur corps par l'envoi WebSocket/HTTP. En cas d'erreur, `throw new Error('message lisible')` : il s'affiche en notification.
- Quand le serveur pousse une mise à jour : modifier `Api.state` puis `Api.emit('accounts')` (sujets : `sessions accounts proxies groups scripts settings events console connection`). L'interface se redessine seule.
- `Api.state.connection.ok = false` + `Api.emit('connection')` affiche le bandeau « bot injoignable ».
- **Stats** : `Api.stats.get({ period, sessionIds })` doit renvoyer `{ labels, bots: [{ id, name, level, kamas[], xp[], won[], lost[], resources{}, playMin }] }` (une valeur par tranche de `labels`).
- **Agent IA** : `Api.agent.ask(texte)` doit envoyer le texte + l'état au modèle **côté serveur** (jamais la clé API dans le navigateur) et ajouter à `Api.state.agent.messages` une réponse `{ role:'ai', text, plan:{ steps:[{ kind, perm, label, args, risky }] } }`. Les `kind` exécutables sont dans `agentPlanRun`. Le serveur MCP (`/mcp`) doit exposer les mêmes actions comme outils et appliquer `Api.state.agent.perms`. Aujourd'hui un petit analyseur de phrases (`parseIntent`) simule le modèle.
- **HDV** : remplir `Api.state.hdv` (`sales`, `listings`, `rules`, `taxes`, `market`) ; à chaque vente reçue du jeu : `Api.state.hdv.sales.push({ t, server, bot, item, emoji, lot, price, fresh: true })` puis `Api.emit('hdv')`. Les actions à brancher : `sell`, `reprice`, `unlist`, `saveRule`, `toggleRule`, `removeRule`, `refreshMarket`. Les serveurs suivis sont dans `HDV_SERVERS`.
- **Prix du kamas** : créer côté serveur `GET /api/kamas-rates` qui renvoie tel quel `https://ventekamas.com/vk-prices.json` (le site n'autorise pas l'appel direct depuis le navigateur). Format : `{ generated, prices:[{ server:'allisteria'|'boune'|…, paypal, skrill, bitcoin, usdt, sepa }] }` = € payés par million de kamas. Mettre un cache de 5 min. Sans relais, la page utilise le relevé du 11/11/2026 (Allisteria 0,819 €/M, Boune 2,623 €/M en PayPal) et l'indique en orange.
- Supprimer les `setInterval` de démo (sessions et ventes HDV) en bas de `api.js` et le fichier `js/mock.js` une fois branché.

## Fichiers

```
index.html          squelette (barre du haut, nav, colonne, zone de page)
css/app.css         thème (variables en haut : couleurs, rayons) + clair/sombre
js/icons.js         icônes SVG
js/mock.js          données fictives
js/api.js           ← à brancher
js/ui.js            notifications, modales, menus, confirmations
js/app.js           routeur (#/comptes…), nav, colonne des sessions
js/views/*.js       une page par fichier
design-ref/         les 29 captures MoonBot du Discord (#screenshot) qui ont servi de modèle
```
