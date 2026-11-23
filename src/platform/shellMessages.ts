import { t } from '../core/i18n';

/**
 * Phrases des erreurs de la coquille du programme Windows (dossier `bureau/`) : elle ne connaît pas la langue de
 * l'interface et écrit ses messages en français, qui reviennent à la page dans `{ ok: false, code, message }`. Rendues
 * ici dans la langue de l'interface, par une table indexée par le texte français, au caractère près ; la coquille ne
 * change pas. Le test `shellMessages.test.ts` relit les sources de la coquille et refuse un message qui n'a pas sa
 * phrase ici : une phrase changée côté coquille se change ici aussi.
 *
 * Une clé porte des `{variables}` (chemin, nombre d'octets) pour la partie qui change d'un cas à l'autre ; elles se
 * retrouvent telles quelles dans la phrase traduite. Une phrase suivie d'un détail technique (« phrase : détail »,
 * `nativeMessages.ts`) n'y figure que par sa phrase, le détail restant tel que la coquille l'a reçu du système.
 */
const SHELL_MESSAGES: Readonly<Record<string, string>> = {
  // Dossier mémoire.
  'Chemin refusé : ce n’est pas un texte.': t('Chemin refusé : ce n’est pas un texte.'),
  'Chemin refusé : « {chemin} ».': t('Chemin refusé : « {chemin} ».'),
  'Écriture impossible : un dossier porte le nom « {nom} ».': t('Écriture impossible : un dossier porte le nom « {nom} ».'),
  'Suppression du dossier impossible': t('Suppression du dossier impossible'),
  'Le dossier mémoire est introuvable': t('Le dossier mémoire est introuvable'),
  'Ce dossier n’est pas encore retenu comme dossier mémoire : rien ne s’y écrit.': t('Ce dossier n’est pas encore retenu comme dossier mémoire : rien ne s’y écrit.'),
  'Suppression refusée : « {chemin} » est un dossier.': t('Suppression refusée : « {chemin} » est un dossier.'),
  'Suppression refusée : « {chemin} » n’est pas un dossier.': t('Suppression refusée : « {chemin} » n’est pas un dossier.'),
  'Suppression refusée : le dossier « {chemin} » n’est pas vide.': t('Suppression refusée : le dossier « {chemin} » n’est pas vide.'),
  'Le fichier {nom} du profil ne se lit pas': t('Le fichier {nom} du profil ne se lit pas'),
  'Dossier choisi illisible.': t('Dossier choisi illisible.'),
  'Lecture du dossier choisi impossible': t('Lecture du dossier choisi impossible'),
  'Aucun dossier proposé ni choisi.': t('Aucun dossier proposé ni choisi.'),
  'Aucun dossier mémoire retenu.': t('Aucun dossier mémoire retenu.'),
  'Création du dossier mémoire impossible': t('Création du dossier mémoire impossible'),
  'Un fichier porte déjà le nom de ce dossier': t('Un fichier porte déjà le nom de ce dossier'),
  'Dossier mémoire impossible à retenir': t('Dossier mémoire impossible à retenir'),
  // Messages mal formés (la page et la coquille vont ensemble : cas d'une panne seulement).
  'Message mal formé : un objet est attendu.': t('Message mal formé : un objet est attendu.'),
  'Message mal formé : « {nom} » doit être un texte.': t('Message mal formé : « {nom} » doit être un texte.'),
  'Message mal formé : « texte » doit être un texte non vide.': t('Message mal formé : « texte » doit être un texte non vide.'),
  'Message mal formé : « {nom} » doit être vrai ou faux.': t('Message mal formé : « {nom} » doit être vrai ou faux.'),
  'Message mal formé : « racine » vaut « memoire » ou « candidat ».': t('Message mal formé : « racine » vaut « memoire » ou « candidat ».'),
  'Message mal formé : « octets » doit être un Uint8Array.': t('Message mal formé : « octets » doit être un Uint8Array.'),
  'Message refusé : il ne vient pas de la page de Gtracker.': t('Message refusé : il ne vient pas de la page de Gtracker.'),
  'Textes de la question de fermeture incomplets.': t('Textes de la question de fermeture incomplets.'),
  // Téléphone, par le câble.
  'Nom refusé pour le téléphone : caractère nul.': t('Nom refusé pour le téléphone : caractère nul.'),
  "L'outil adb ne répond pas": t("L'outil adb ne répond pas"),
  'Le serveur adb désigné ({hote}:{port}) ne répond pas.': t('Le serveur adb désigné ({hote}:{port}) ne répond pas.'),
  'Le serveur adb ne démarre pas': t('Le serveur adb ne démarre pas'),
  'Le serveur adb ne démarre pas (délai dépassé)': t('Le serveur adb ne démarre pas (délai dépassé)'),
  'Le serveur adb ne répond pas (délai dépassé).': t('Le serveur adb ne répond pas (délai dépassé).'),
  'Liste des appareils impossible': t('Liste des appareils impossible'),
  'Le téléphone ne répond pas (délai dépassé).': t('Le téléphone ne répond pas (délai dépassé).'),
  'Le téléphone ne répond plus': t('Le téléphone ne répond plus'),
  'Le dossier Documents/Gtracker est absent du téléphone.': t('Le dossier Documents/Gtracker est absent du téléphone.'),
  'Listage du téléphone impossible': t('Listage du téléphone impossible'),
  "Le téléphone n'a pas été listé.": t("Le téléphone n'a pas été listé."),
  "Lecture de l'état d'un fichier du téléphone impossible": t("Lecture de l'état d'un fichier du téléphone impossible"),
  'Lecture de « {chemin} » trop longue (délai dépassé).': t('Lecture de « {chemin} » trop longue (délai dépassé).'),
  'Lecture de « {chemin} » impossible': t('Lecture de « {chemin} » impossible'),
  "« {chemin} » n'est pas un fichier sur le téléphone.": t("« {chemin} » n'est pas un fichier sur le téléphone."),
  'Écriture de « {chemin} » trop longue (délai dépassé).': t('Écriture de « {chemin} » trop longue (délai dépassé).'),
  'Écriture de « {chemin} » impossible': t('Écriture de « {chemin} » impossible'),
  'Écriture incomplète de « {chemin} » : {octets} octets sur {taille}.': t('Écriture incomplète de « {chemin} » : {octets} octets sur {taille}.'),
  'Renommage de « {chemin} » impossible': t('Renommage de « {chemin} » impossible'),
  'Effacement de « {chemin} » impossible': t('Effacement de « {chemin} » impossible'),
  "L'installation ne s'est pas terminée à temps (délai dépassé).": t("L'installation ne s'est pas terminée à temps (délai dépassé)."),
  'Chemin refusé sur le téléphone : « {chemin} ».': t('Chemin refusé sur le téléphone : « {chemin} ».'),
  '« {chemin} » est encore sur le téléphone après son effacement : il a changé depuis le listage, listez-le de nouveau.': t('« {chemin} » est encore sur le téléphone après son effacement : il a changé depuis le listage, listez-le de nouveau.'),
  "Le téléphone n'est pas prêt ({etat}).": t("Le téléphone n'est pas prêt ({etat})."),
  'Le téléphone a été débranché pendant l’opération.': t('Le téléphone a été débranché pendant l’opération.'),
  'Chemin refusé.': t('Chemin refusé.'),
  'Le dossier temporaire des échanges avec le téléphone est dans la mémoire : refusé.': t('Le dossier temporaire des échanges avec le téléphone est dans la mémoire : refusé.'),
  'Fichier absent du dernier listage du téléphone : « {chemin} ».': t('Fichier absent du dernier listage du téléphone : « {chemin} ».'),
  'Lecture incomplète de « {chemin} » : {octets} octets reçus sur {taille}.': t('Lecture incomplète de « {chemin} » : {octets} octets reçus sur {taille}.'),
  'Fichier trop gros pour le téléphone : « {chemin} ».': t('Fichier trop gros pour le téléphone : « {chemin} ».'),
  'Ce canal ne sait pas écrire sur le téléphone.': t('Ce canal ne sait pas écrire sur le téléphone.'),
  'Ce canal ne sait pas effacer sur le téléphone.': t('Ce canal ne sait pas effacer sur le téléphone.'),
  // Copies de sécurité.
  'Aucun dossier mémoire retenu : pas de copie de sécurité.': t('Aucun dossier mémoire retenu : pas de copie de sécurité.'),
  'Ce programme ne sait pas où ranger les copies de sécurité.': t('Ce programme ne sait pas où ranger les copies de sécurité.'),
  'Trop de copies de sécurité du même nom dans « {dossier} ».': t('Trop de copies de sécurité du même nom dans « {dossier} ».'),
  'Les copies de sécurité seraient rangées dans la mémoire : refusé.': t('Les copies de sécurité seraient rangées dans la mémoire : refusé.'),
  'Copie incomplète de « {chemin} » : {octets} octets reçus sur {taille}.': t('Copie incomplète de « {chemin} » : {octets} octets reçus sur {taille}.'),
  'Copie de sécurité impossible': t('Copie de sécurité impossible'),
  "Seuls le dossier des copies de sécurité et ses copies s'ouvrent ici.": t("Seuls le dossier des copies de sécurité et ses copies s'ouvrent ici."),
  // Application du téléphone.
  "L'APK serait copiée sur elle-même : refusé.": t("L'APK serait copiée sur elle-même : refusé."),
  "Copie incomplète de l'APK : {octets} octets sur {taille}.": t("Copie incomplète de l'APK : {octets} octets sur {taille}."),
  "Ce programme n'a pas l'application du téléphone.": t("Ce programme n'a pas l'application du téléphone."),
  'Destination de l’APK refusée : chemin relatif.': t('Destination de l’APK refusée : chemin relatif.'),
  'Ce canal ne sait pas installer l’application sur le téléphone.': t('Ce canal ne sait pas installer l’application sur le téléphone.'),
  // Autorisation du pare-feu : raisons d'un échec, en fin de phrase.
  "Windows n'a pas répondu à temps": t("Windows n'a pas répondu à temps"),
  "Windows n'a pas accepté la règle du pare-feu": t("Windows n'a pas accepté la règle du pare-feu"),
  'un blocage de Gtracker posé dans le pare-feu de Windows reste en place': t('un blocage de Gtracker posé dans le pare-feu de Windows reste en place'),
  'Windows PowerShell a rendu le code {code}': t('Windows PowerShell a rendu le code {code}'),
  "le pare-feu de Windows n'existe que sous Windows": t("le pare-feu de Windows n'existe que sous Windows"),
  'ce programme ne sait pas demander cette autorisation': t('ce programme ne sait pas demander cette autorisation'),
  "échec de l'autorisation d'essai": t("échec de l'autorisation d'essai"),
  // Sans-fil : le PC et son téléphone relié par le Wi-Fi.
  'Liaison avec le téléphone coupée : {raison}': t('Liaison avec le téléphone coupée : {raison}'),
  "l'autre bout a fermé la liaison.": t("l'autre bout a fermé la liaison."),
  'délai dépassé.': t('délai dépassé.'),
  'le téléphone ne répond plus.': t('le téléphone ne répond plus.'),
  'téléphone retiré.': t('téléphone retiré.'),
  'sans-fil éteint.': t('sans-fil éteint.'),
  'remplacée par une liaison plus récente du même téléphone.': t('remplacée par une liaison plus récente du même téléphone.'),
  'fermée par le PC.': t('fermée par le PC.'),
  'liaison fermée.': t('liaison fermée.'),
  'refus ({code}).': t('refus ({code}).'),
  'message inattendu du téléphone (« {type} »).': t('message inattendu du téléphone (« {type} »).'),
  "message inattendu à l'accueil (« {type} »).": t("message inattendu à l'accueil (« {type} »)."),
  "message inattendu pendant l'appairage (« {type} »).": t("message inattendu pendant l'appairage (« {type} »)."),
  'Erreur du téléphone.': t('Erreur du téléphone.'),
  'Réponse inattendue du téléphone : « {type} » au lieu de « {attendu} ».': t('Réponse inattendue du téléphone : « {type} » au lieu de « {attendu} ».'),
  'Fichier « {chemin} » trop gros pour être lu : {taille} octets annoncés, {max} au plus.': t('Fichier « {chemin} » trop gros pour être lu : {taille} octets annoncés, {max} au plus.'),
  'Bloc inattendu de « {chemin} » : début {debut} au lieu de {attendu}.': t('Bloc inattendu de « {chemin} » : début {debut} au lieu de {attendu}.'),
  'Lecture incomplète de « {chemin} » : le fichier a changé de taille sur le téléphone.': t('Lecture incomplète de « {chemin} » : le fichier a changé de taille sur le téléphone.'),
  'Fichier « {chemin} » trop gros pour le téléphone : {taille} octets, {max} au plus.': t('Fichier « {chemin} » trop gros pour le téléphone : {taille} octets, {max} au plus.'),
  'Écriture de « {chemin} » refusée : {reelle} octets à envoyer au lieu des {taille} annoncés.': t('Écriture de « {chemin} » refusée : {reelle} octets à envoyer au lieu des {taille} annoncés.'),
  'Écriture de « {chemin} » interrompue : le fichier à envoyer a changé de taille.': t('Écriture de « {chemin} » interrompue : le fichier à envoyer a changé de taille.'),
  'Écriture de « {chemin} » mal confirmée par le téléphone : « {ecrit} », {octets} octets sur {taille}.': t('Écriture de « {chemin} » mal confirmée par le téléphone : « {ecrit} », {octets} octets sur {taille}.'),
  "Le sans-fil est éteint : l'activer avant d'autoriser Gtracker.": t("Le sans-fil est éteint : l'activer avant d'autoriser Gtracker."),
  "Le sans-fil est éteint : l'activer avant d'appairer un téléphone.": t("Le sans-fil est éteint : l'activer avant d'appairer un téléphone."),
  "Le PC n'écoute sur aucun réseau local.": t("Le PC n'écoute sur aucun réseau local."),
  "Le téléphone n'est plus relié depuis le listage.": t("Le téléphone n'est plus relié depuis le listage."),
  "Ce téléphone ne sait pas écrire par le Wi-Fi : son application est plus ancienne que ce programme.": t("Ce téléphone ne sait pas écrire par le Wi-Fi : son application est plus ancienne que ce programme."),
  'Le téléphone enregistre une session : rien ne lui est écrit pour le moment.': t('Le téléphone enregistre une session : rien ne lui est écrit pour le moment.'),
  'Message mal formé : « id » doit être un identifiant de téléphone.': t('Message mal formé : « id » doit être un identifiant de téléphone.'),
  'Certificat du sans-fil impossible à préparer': t('Certificat du sans-fil impossible à préparer'),
  'Aucun réseau local privé : brancher le PC sur le Wi-Fi ou le réseau de la maison.': t('Aucun réseau local privé : brancher le PC sur le Wi-Fi ou le réseau de la maison.'),
  "Le PC n'arrive à écouter sur aucune de ses adresses.": t("Le PC n'arrive à écouter sur aucune de ses adresses."),
  'Aucun port libre de {debut} à {fin}.': t('Aucun port libre de {debut} à {fin}.'),
  // Appairage.
  'Nom de téléphone refusé.': t('Nom de téléphone refusé.'),
  '{quoi} : {taille} octets attendus, {recus} reçus.': t('{quoi} : {taille} octets attendus, {recus} reçus.'),
};

/** Clé de la table, ses variables et l'expression qui lit un texte de la coquille. */
interface ShellEntry {
  key: string;
  names: readonly string[];
  pattern: RegExp;
  /** Longueur du texte fixe : la clé la plus précise passe la première. */
  fixed: number;
}

const VARIABLE = /\{(\w+)\}/g;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const entryOf = (key: string): ShellEntry => {
  const names: string[] = [];
  let source = '';
  let fixed = 0;
  let from = 0;
  for (const match of key.matchAll(VARIABLE)) {
    const literal = key.slice(from, match.index);
    source += escapeRegExp(literal) + '([\\s\\S]*?)';
    fixed += literal.length;
    names.push(match[1]);
    from = match.index + match[0].length;
  }
  const tail = key.slice(from);
  source += escapeRegExp(tail);
  fixed += tail.length;
  return { key, names, pattern: new RegExp(`^${source}$`), fixed };
};

/** Clés les plus précises d'abord : un texte fixe plus long l'emporte sur un modèle plus large. */
const ENTRIES: readonly ShellEntry[] = Object.keys(SHELL_MESSAGES).map(entryOf).sort((a, b) => b.fixed - a.fixed);

/** Clés de la table, pour le test qui la compare aux messages de la coquille. */
export const shellMessageKeys = (): readonly string[] => Object.keys(SHELL_MESSAGES);

/**
 * Phrase de la coquille dans la langue de l'interface ; `null` quand `text` n'est pas l'une de ses phrases (la phrase
 * entière, sans détail). Ce que les variables portaient (chemin, nombre d'octets) est remis tel quel, sauf une `{raison}`
 * (pourquoi une liaison s'est coupée) qui est elle-même une phrase de la table quand la coquille l'a écrite.
 */
export const shellPhrase = (text: string): string | null => {
  for (const entry of ENTRIES) {
    const found = entry.pattern.exec(text);
    if (!found) continue;
    return SHELL_MESSAGES[entry.key].replace(VARIABLE, (whole, name: string) => {
      const at = entry.names.indexOf(name);
      if (at < 0) return whole;
      const value = found[at + 1];
      return name === 'raison' ? (shellPhrase(value) ?? value) : value;
    });
  }
  return null;
};
