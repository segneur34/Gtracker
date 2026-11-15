# 405 · Évolutions du produit proposées par la revue du 15/11

Faisabilité vérifiée sur le web le 15/11/2026 par l'auditeur ; rien n'est décidé. Deux décisions de `docs/DECISIONS.md` §8 (06/11) s'appliquent : aucun compte en ligne, et le pilotage de l'enregistrement au poignet est abandonné.

## Montres

1. **Montre comme capteur cardio : marche déjà, sans code.** L'application lit tout appareil qui annonce le service cardio standard en Bluetooth (`HeartRatePlugin.java`, `isHeartRateDevice`). Beaucoup de Garmin, Polar et Coros diffusent leur fréquence cardiaque ; sur les Garmin récentes, une option la garde pendant l'activité de la montre. Apple Watch et Galaxy Watch ne diffusent pas. Reste : l'essayer sur deux ou trois modèles et l'écrire dans Réglages › Capteurs. Limites : capteur de poignet peu fiable en eau froide, Bluetooth coupé poignet immergé.
2. **Relire une session de montre : déjà fait par fichier** (FIT et GPX, « Ouvrir avec »). Manquent : de vrais fichiers Suunto, Coros et Polar (un seul FIT Garmin essayé), le nom du profil de la montre lu dans le FIT pour ranger la session, une aide « exporter depuis Garmin Connect, Suunto, Coros, Polar ».
3. **Récupération automatique** (Garmin Connect, Suunto, Coros, Polar, Strava) : toutes exigent un serveur (secret OAuth ou adresse de réception), et pour Garmin, Suunto et Coros un accord de partenaire. Health Connect ne rend pas les tracés des montres. À ne faire que si l'acheteur finance un serveur.
4. **Application sur la montre** : Wear OS (Kotlin, des greffons Capacitor existent, 3 à 6 semaines pour un afficheur et une télécommande, distribution par Google Play) ; Garmin Connect IQ (Monkey C, liaison au téléphone signalée peu fiable) ; Apple Watch après un portage iOS seulement. Ne se rouvre que si l'utilisateur revient sur l'abandon du pilotage au poignet.

## Autres pistes, de la meilleure à la moins bonne valeur pour l'effort

1. Publication sur Google Play et vérification du développeur (calendrier de Google à recouper : imposée partout en 2027 selon l'auditeur, même pour une APK diffusée par lien) : démarches de l'acheteur, code déjà à l'élément 308.
2. Catalogue de matériel GONG prérempli (foils, ailes, planches, lien vers le produit) dans l'onglet matériel : petit à moyen, un fichier statique suffit.
3. « Nouveau record » annoncé en fin de session : petit.
4. Sauvegarde du dossier mémoire par une application de synchronisation du téléphone : une page d'aide.
5. Vent d'un modèle météo à côté du vent estimé (Open-Meteo : offre gratuite non commerciale, abonnement à prévoir).
6. Alerte de dérive ou de retour au départ : moyen, essais au téléphone.
7. Comparer deux sessions ou deux matériels : moyen (prolonge l'élément 336).
8. Partage direct vers Strava : serveur exigé.
9. Portage iOS : 5 à 8 semaines selon l'auditeur Android (une douzaine de greffons à réécrire en Swift, et `isNativeApp()` à dédoubler Android / iOS).
10. Anémomètre Bluetooth ; suivi en direct par un proche et classements (serveur) ; marées (licence SHOM) ; vidéo synchronisée.

## Pour un produit de marque

Au vendeur avant la vente : politique de confidentialité et mentions légales (la fréquence cardiaque est une donnée de santé ; « tout reste sur le téléphone » est un argument à écrire), adresse de support, dossier de reprise. À l'acheteur après : compte Play de l'organisation, fonds de carte sous contrat, et tout ce qui suppose un serveur (compte client, lien boutique, statistiques d'usage, classements).
