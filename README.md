# Heures supplémentaires

Application web (PWA) de suivi des heures de travail et heures supplémentaires. Données sauvegardées localement dans le navigateur, installable sur Android comme une vraie application.

## Fonctionnalités

- Saisie heure de début / fin avec sauvegarde automatique
- Repas éditable (aucun, 30 min, 60 min) — 60 par défaut
- Valeurs par défaut : 7 h – 16 h 30 avec 60 min de repas
- Section note pour la raison du temps supplémentaire
- Calendrier d'historique avec indicateurs visuels
- Barre de progression hebdomadaire (37,5 h)
- Boutons de congé (personnel, anniversaire, vacances)
- Mode clair / sombre
- Installable sur Android (PWA)
- Données stockées localement (localStorage)
- Fonctionne hors-ligne une fois installée

## Déploiement sur GitHub Pages

1. **Créer un dépôt GitHub**
   - Crée un nouveau dépôt public (ex. `heures-sup`)

2. **Téléverser les fichiers**
   Place tous les fichiers à la racine du dépôt :
   ```
   index.html
   manifest.json
   service-worker.js
   icon-192.png
   icon-512.png
   icon-maskable-512.png
   README.md
   ```

3. **Activer GitHub Pages**
   - Dans le dépôt → Settings → Pages
   - Source : `Deploy from a branch`
   - Branch : `main` (ou `master`) / `/ (root)`
   - Save

4. **Accéder à l'app**
   - URL : `https://<ton-utilisateur>.github.io/<nom-du-depot>/`
   - Attends 1-2 minutes après la première activation

## Installation sur Android

1. Ouvre l'URL dans **Chrome** sur ton téléphone
2. Un bouton « Installer » apparaîtra dans l'application
3. Sinon : menu Chrome (⋮) → « Ajouter à l'écran d'accueil » / « Installer l'application »
4. L'app s'ouvrira comme une application native, sans barre d'adresse

## Note technique

- Les données sont stockées dans `localStorage` du navigateur. Elles persistent tant que tu ne vides pas les données du site.
- Une semaine commence le lundi et se termine le dimanche.
- Une journée standard = 7,5 h ; une semaine standard = 37,5 h.
- Les heures au-delà de 7,5 h sur une journée ou 37,5 h sur une semaine sont indiquées comme temps supplémentaire.
- Un jour de congé compte pour 7,5 h dans le total hebdomadaire.
