# 488 · Le pare-feu de Windows vu et autorisé par le programme : plan

Modèle | Réflexion : Opus | high pour le code ; Sonnet | high pour le banc, à part, après le code. Relecture obligatoire.

Demande : `node outils/backlog.mjs --ligne 488`. Plan de l'agent `Plan` du 22/11, condensé par l'orchestrateur. Première partie du paquet dont la suite est le lot 489 (`docs/backlog/489-synchroniser-remise-a-plat.md`) : l'écran « En attente de votre téléphone » du 489 reprendra la phrase et l'appel de ce lot sans rien refaire.

## Constat (relevé sur le poste, en lecture, sans droits d'administrateur)

- L'essai actuel (`essayerAutoConnexion`, `bureau/sansFil.ts`) ne voit pas le cas du 22/11 : Windows ne filtre pas le trafic du PC vers lui-même.
- L'interface du partage de connexion (192.168.137.1) n'a aucun profil de réseau : le pare-feu lui applique le profil Public.
- Les règles que Windows pose à sa propre question visent le chemin de l'exécutable, en minuscules.
- Le serveur écoute sur toutes les adresses privées, à partir du port 48217 (TCP, dix essais) ; la sonde est en 48218 (UDP).

## Lecture, sans élévation (environ 1 s)

Un seul `powershell.exe` (chemin complet sous `%SystemRoot%\System32\WindowsPowerShell\v1.0`, `-NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand`), sortie JSON en UTF-8 ; aucun texte traduit n'est lu, seulement des nombres. Le chemin de l'exécutable passe par une variable d'environnement du processus lancé, jamais par la ligne de commande.
- `Get-NetIPAddress -AddressFamily IPv4` relie chaque adresse d'écoute à son interface ; `Get-NetConnectionProfile` donne la catégorie (0 public, 1 privé, 2 domaine ; pas de profil : public).
- L'objet COM `HNetCfg.FwPolicy2` : `FirewallEnabled`, `BlockAllInboundTraffic`, `DefaultInboundAction`, `LocalPolicyModifyState` (différent de 0 : une stratégie de groupe ignore les règles locales).
- Les règles entrantes dont le programme, variables développées et sans casse, est l'exécutable en cours, ou vide : action, activée, profils (1 domaine, 2 privé, 4 public), protocole (6 TCP, 17 UDP, 256 tous), ports locaux.

Le jugement se fait en TypeScript pur. Ne se lisent pas : un pare-feu tiers, une stratégie de groupe au-delà de `LocalPolicyModifyState`.

## Autorisation, une seule demande de Windows

Un PowerShell non élevé lance `Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden` avec un script encodé, qui :
- retire les règles `Gtracker-SansFil-TCP` et `Gtracker-SansFil-UDP` (noms stables : rien ne s'empile) ;
- pose `New-NetFirewallRule` entrante, autorisation, programme = l'exécutable, TCP ports 48217-48226, `-RemoteAddress LocalSubnet`, profils privé et public ; la même en UDP sur 48218 ;
- retire les règles de blocage entrantes qui visent ce même exécutable (un blocage l'emporte toujours sur une autorisation).

`LocalSubnet` vaut pour les deux sens du partage de connexion. Le refus de l'utilisateur se lit sans texte traduit (`Win32Exception.NativeErrorCode` 1223, code de sortie 3 : issue `refusee`). La fenêtre de Windows affiche « Windows PowerShell », pas « Gtracker » ; `elevate.exe` serait pire (éditeur inconnu). La règle reste après une désinstallation (la retirer demande des droits que le désinstalleur n'a pas), sans effet puisqu'elle vise un chemin disparu. L'installeur ne pose pas la règle.

Sécurité : sur un Wi-Fi public à adresses privées, les voisins du sous-réseau peuvent joindre deux ports de Gtracker, seulement sans-fil allumé ; derrière, TLS, appairage par code (2 minutes, trois essais), jeton de 256 bits.

## Fichiers

- Neuf `bureau/pareFeu.ts` et son test : `scriptReleve()`, `scriptAutorisation(exe)` (apostrophes doublées, UTF-16LE en base64), `lireReleve(json)` (un objet seul là où `ConvertTo-Json` a écrasé un tableau), `jugerPareFeu(releve, { adresses, port, portSonde, exe })` qui rend `{ pareFeu, reparable }`, `lirePareFeuWindows` et `autoriserPareFeuWindows` sur `execFile` (`windowsHide`, délai de 10 s).
- `bureau/sansFil.ts` : options `lirePareFeu` et `autoriserPareFeu` injectées ; `essayerPareFeu` passe par le relevé, `essayerAutoConnexion` ne reste qu'en repli quand le relevé échoue (son « ouvert » devient « inconnu ») ; `EtatSansFil.pareFeuReparable` ; `autoriserPareFeu()` qui relit aussitôt ; `autoriser` dans `CANAUX_SANS_FIL`, gestionnaire `sansfil:autoriser` qui rend `{ issue: 'accordee'|'refusee'|'echec', etat }` ; mode d'essai `GTRACKER_BANC_SANSFIL_PAREFEU=ouvert|bloque|irreparable` (défaut `ouvert`) et `GTRACKER_BANC_SANSFIL_AUTORISATION=accordee|refusee|echec` (défaut `accordee`) : en essai les deux fonctions sont toujours factices, jamais `powershell` ; en-tête du fichier à jour.
- `bureau/main.ts` (fonctions de Windows branchées hors essai, `process.execPath`, variables dans l'en-tête), `bureau/preload.ts` (`autoriser`), `bureau/pont.test.ts`.
- `src/platform/desktopBridge.ts` (`pareFeuReparable?`, `autoriser?()`, facultatifs pour une coquille ancienne), `src/platform/wirelessPhone.ts` (`authorizeWireless()`, `wirelessAuthorizable()`) et son test.
- `src/library/wirelessPhone.ts` : fonction pure `firewallNotice(state)` qui rend `{ text, canAuthorize }` ou `null` (reprise telle quelle par la fenêtre du 489), `authorizationOutcomeText(issue)` ; `warning` et `hint` retirés de `describeWireless`, avec leurs deux phrases.
- `src/hooks/useWirelessPhones.ts` : action `authorize()`. `src/components/WirelessPhoneCard.tsx` : message et bouton (classes `wireless-card__firewall` et `wireless-card__authorize`, aucun `style={{`), phrase d'allumage neuve.
- `src/locales/en.json`, `es.json` (clés ajoutées, orphelines retirées) ; `docs/INVENTAIRE.md` (`bureau/pareFeu.ts`).
- Côté téléphone, rien dans ce lot : la phrase d'un ordinateur introuvable (`src/library/computerLink.ts`, état `notFound` d'un téléphone appairé) change avec la partie « téléphone » du 489.

## Textes

- Bloqué : « Windows ne laisse pas passer votre téléphone sur ce réseau. », bouton « Autoriser Gtracker », mention « Windows demande de confirmer ».
- À l'allumage : « Windows va vous demander d'autoriser Gtracker sur le réseau : acceptez. »
- Refus : « Windows n'a pas donné l'autorisation : le téléphone ne pourra pas se présenter sur ce réseau. » ; échec : « L'autorisation n'a pas pu être ajoutée : {detail}. » ; non réparable : la phrase du blocage, suivie de « Un réglage de l'administrateur de cet ordinateur empêche de l'autoriser ici. », sans bouton.
- Partent : « Windows bloque Gtracker sur ce réseau. Autorisez-le dans le pare-feu de Windows… » et l'aide « Aucun téléphone ne se présente ? … le câble reste possible. ». Plus aucun conseil de câble ni de débogage USB.

## Étapes et tests

1. `pareFeu.ts` et ses tests : partage de connexion sans profil (public, bloqué) ; privé et public autorisés (ouvert) ; le blocage l'emporte ; règle désactivée ignorée ; autre programme ignoré, chemin sans casse et variables développées ; ports qui ne couvrent pas le port pris (bloqué) ; UDP manquant (bloqué) ; pare-feu éteint sur ce profil (ouvert) ; tout entrant bloqué (bloqué, non réparable) ; stratégie de groupe (non réparable) ; relevé illisible (inconnu) ; deux adresses dont une bloquée (bloqué) ; script d'autorisation (noms stables, apostrophe et accents dans le chemin) ; objet seul lu comme un tableau.
2. Branchement dans `sansFil.ts`, canal et mode d'essai ; tests de `bureau/sansFil.test.ts` : relevé lu après la mise à l'écoute, relu toutes les 30 s tant que bloqué, autorisation accordée puis ouvert, refus (reste bloqué), canal mal formé ou sans-fil éteint.
3. `main.ts`, `preload.ts`.
4. Plate-forme, fonctions pures, hook, carte, dictionnaires ; tests de `src/library/wirelessPhone.test.ts` : bloqué avec ou sans bouton, ouvert ou inconnu sans rien, plus de conseil de câble.
5. `npm run verif`.

Banc (`outils/banc/exe-sansfil.mjs`, partie à part, Sonnet) : l'aide retirée des contrôles 1b et 1e ; avec `PAREFEU=bloque`, phrase et bouton ; clic `accordee` : le message disparaît, le journal dit « autorisation d'essai » ; `refusee` : phrase de refus, bouton gardé ; `irreparable` : message sans bouton ; par défaut rien ; aucun `powershell` lancé (journal) ; phrase d'allumage neuve ; une capture du bloc ; `SCRIPTS.md`.

## Questions

Mineures, tranchées par l'orchestrateur le 22/11 d'après les recommandations du plan :
- l'autorisation retire les règles de blocage du même exécutable ;
- « ouvert » exige TCP et UDP, et l'autorisation pose les deux ;
- plusieurs interfaces à l'écoute : bloqué dès qu'une l'est, une seule autorisation couvre tout ;
- `essayerAutoConnexion` gardé en repli seulement ;
- règle bornée aux ports et au sous-réseau local plutôt qu'au programme seul ; la détection vérifie le port réellement pris.

Majeures, posées à l'utilisateur le 22/11, **répondues oui toutes deux le 22/11 (Q144 et Q145)** :
1. Sécurité : la règle vaut aussi sur les réseaux que Windows dit publics. C'est indispensable au partage de connexion ; elle est limitée à Gtracker, à ses deux ports et au sous-réseau local. Recommandé : oui.
2. À l'allumage du sans-fil sur un PC sans règle : lancer la demande de Gtracker avant l'écoute (une seule demande, la fenêtre de Windows aux cases « privés » et « publics » n'apparaît plus), en sachant que la demande affiche « Windows PowerShell » et non « Gtracker ». Recommandé : oui.

Essai au vrai PC, un seul : sur le partage de connexion, règle retirée à la main, « Autoriser Gtracker » fait relier le téléphone sans ouvrir les paramètres de Windows.
