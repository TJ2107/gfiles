# GlobalFiles Entreprise

![Version](https://img.shields.io/badge/version-3.2.1-indigo.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Vite](https://img.shields.io/badge/Vite-6-purple.svg)

**GlobalFiles Entreprise** (anciennement STHIC PM Tracker) est une application professionnelle sécurisée pour le suivi et la gestion approfondie de la maintenance préventive (PM), de l'activité des sites et des équipements critiques.

![Capture d'écran du Tableau de bord](/screenshot-dashboard.png)

Conçue pour traiter de larges volumes de données, elle permet la synchronisation via des fichiers Excel, l'intégration optionnelle avec l'API Retable, et le stockage persistant via Firebase / Cloudflare.

---

## 🚀 Présentation de l'Application

GlobalFiles Entreprise offre un écosystème complet pour les équipes de maintenance, alliant interface de bureau riche (Desktop) et portail mobile simplifié pour le terrain. Elle propose un traitement analytique robuste avec visualisation de données et des capacités d'exportation avancées.

### Flux d'authentification
L'accès est restreint par un système d'authentification sécurisé (`LoginView`), séparant les rôles **Utilisateurs**, **Managers** et **Admins**. 

![Capture d'écran de l'authentification](/screenshot-login.png)

---

## 🧩 Fonctionnement des Modules

L'application est structurée en plusieurs modules spécialisés accessibles depuis la barre de navigation. Chacun répond à un besoin spécifique de gestion de maintenance.

### 1. 📊 Tableau de Bord Principal (`Dashboard`)
Le centre de contrôle. Il offre une vue d'ensemble des statistiques de maintenance (PM planifiés, exécutés, en retard) grâce à des widgets interactifs et des graphiques (via `Recharts`). Il permet un filtrage global qui se répercute sur l'ensemble de l'application.

### 2. 📅 Suivi de Maintenance Préventive (`PMTracker`)
Module dédié à la gestion des PM. 
- Permet l'ajout, la modification, la reprogrammation des maintenances.
- Gère l'assignation des techniciens.
- Calcule automatiquement les taux d'achèvement et les retards.

![Capture PM Tracker](/screenshot-pmtracker.png)

### 3. 🔋 Suivi des Équipements Critiques (`BatteryTracker` & `BeltTracker`)
Ces modules surveillent le cycle de vie de composants spécifiques :
- **BatteryTracker** : Suivi du remplacement et de la santé des batteries, alertant lorsqu'un seuil critique de durée de vie est atteint.
- **BeltTracker** : Surveillance de l'usure et des dates de remplacement des courroies/ceintures de maintenance.

### 4. 📈 Analyses Avancées (`TASAnalysis` & `TTFAnalysis`)
- **TAS Analysis (Turn Around Score)** : Analyse le temps de réponse et de résolution des interventions.
- **TTF Analysis (Time To Fail)** : Visualisation du temps moyen de défaillance des composants pour optimiser la maintenance prédictive.

### 5. 🗺️ Cartographie & Statut (`SiteMap` & `DailyStatus`)
- **SiteMap** : Visualisation géographique ou structurelle de l'état des différents sites de maintenance.
- **DailyStatus** : Vue opérationnelle au jour le jour pour les équipes, mettant en évidence les urgences et le statut quotidien des interventions.

### 6. 📱 Portail Mobile (`MobilePortal`)
Une interface utilisateur (UI) distincte et optimisée pour les terminaux mobiles. Conçue pour les techniciens sur le terrain, permettant une consultation et une saisie rapide sans la complexité de l'interface bureau.

### 7. 📄 Gestion des Données et Exports (`DataTable`, `FileUpload`, `ExportManager`)
- **FileUpload** : Importation de données brutes depuis des fichiers `.xlsx`.
- **DataTable** : Grille de données interactive permettant de filtrer, trier et éditer les enregistrements bruts.
- **ExportManager** : Module dédié à la génération de rapports professionnels aux formats PDF et Excel.

### 8. ⚙️ Configuration (`SettingsPanel`)
Module d'administration pour gérer les préférences de l'utilisateur, les clés API (comme l'intégration avec Retable), et la synchronisation avec les bases de données Cloud (Firebase, Cloudflare D1).

---

## 🔗 Liens et Environnements

*   **Environnement de Développement :** [Lien de Développement](https://ais-dev-jamlpyli6yynbc5lamha72-65802711374.europe-west2.run.app)
*   **Environnement Partagé :** [Lien Partagé](https://ais-pre-jamlpyli6yynbc5lamha72-65802711374.europe-west2.run.app)

*Note: Lors de la première connexion, un compte administrateur par défaut est configuré pour cyber.kan587@gmail.com.*

---

## 🛠️ Stack Technique

*   **Frontend :** React 18/19, Vite, Tailwind CSS, Recharts, Lucide-React.
*   **Backend & Cloud :** Firebase (Authentification & Firestore) / Cloudflare D1.
*   **Composants graphiques :** UI adaptative avec composants Tailwind personnalisés et graphiques de données complexes.

## ⚙️ Installation & Lancement en local

1.  **Installer les dépendances :**
    ```bash
    npm install
    ```
2.  **Lancer le serveur de développement :**
    ```bash
    npm run dev
    ```
    L'application sera accessible sur `http://localhost:3000`.
3.  **Build de production :**
    ```bash
    npm run build
    ```

---
## 📜 Copyright & Licence
© 2026 Empreintes Technologies. Tous droits réservés.
Ce logiciel, ainsi que tous les codes sources, conceptions, et interfaces associés, sont la propriété exclusive d'Empreintes Technologies. Toute reproduction, distribution ou modification sans autorisation expresse est strictement interdite.
