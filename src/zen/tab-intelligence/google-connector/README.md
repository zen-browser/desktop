# Connecteur Google Zen (Google Apps Script)

Ce connecteur permet à **Zen** d'afficher instantanément au survol des onglets **Gmail** et **Google Calendar** :
- Les **3 derniers e-mails non lus** (expéditeur, sujet, aperçu).
- Les **événements et réunions du jour** (horaires et bouton « Rejoindre » pour Google Meet, Zoom, Teams).

Il s'exécute directement sur votre compte Google sans envoyer vos données à des serveurs tiers et **sans nécessiter que les onglets Gmail ou Calendar soient actifs ou chargés en mémoire**.

---

## Guide d'installation en 2 minutes

1. Ouvrez [Google Apps Script](https://script.google.com/home).
2. Cliquez sur **Nouveau projet**.
3. Renommez le projet **Zen** (en haut à gauche en cliquant sur « Projet sans titre »).
4. Copiez-collez le contenu du fichier [`ZenGoogleConnector.gs`](./ZenGoogleConnector.gs) dans l'éditeur (en remplaçant le code existant dans `Code.gs`).
5. *(Optionnel)* Si vous souhaitez restreindre l'accès avec un mot de passe/token, renseignez la variable `API_KEY = "votre_cle_secrete"` en haut du fichier.
6. Cliquez sur le bouton bleu **Déployer** (en haut à droite) puis **Nouveau déploiement**.
7. Cliquez sur l'icône d'engrenage à côté de *Sélectionner le type* et choisissez **Application Web**.
8. Définissez les paramètres suivants :
   - **Description** : `Zen Connector`
   - **Exécuter en tant que** : `Moi (<votre email>)`
   - **Qui a accès** : `Tout le monde` *(l'accès est protégé par votre clé API ou par l'URL secrète de votre déploiement)*
9. Cliquez sur **Déployer**. Google vous demandera d'autoriser l'accès aux services Gmail et Agenda pour votre propre compte :
   - Cliquez sur **Autoriser l'accès**.
   - Sélectionnez votre compte.
   - Si un avertissement de sécurité apparaît (« Google n'a pas validé cette application »), cliquez sur **Paramètres avancés** puis sur **Accéder à Zen (non sécurisé)**.
   - Cliquez sur **Autoriser**.
10. Copiez l'**URL de l'application Web** (qui se termine par `/exec`).
11. Dans **Zen** :
    - Ouvrez les **Réglages** (`about:preferences#tabs`).
    - Dans la section **Tab Intelligence**, collez l'URL dans le champ **URL de l'App Script Zen** (et la clé API si vous en avez défini une).

C'est prêt ! Vos onglets Gmail et Google Calendar afficheront vos données directement au survol.
