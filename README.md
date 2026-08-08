# GOTECHCAM Gestion

Application de gestion commerciale et de stock — Next.js 14 + Prisma + PostgreSQL.
Déploiement sur Vercel, base de données sur Neon.

## Fonctionnalités

- **Clients & CRM** — fiche complète, historique, activités (appel, WhatsApp, email, RDV, note), statut commercial
- **Besoins récurrents** — ce que chaque client commande habituellement, avec fréquence et rappel automatique
- **Produits & Stock** — SKU automatique, multi-prix, entrées/sorties/ajustements, alertes, stock négatif impossible
- **Workflow** proforma → bon de commande → facture → bordereau de livraison
- **Livraisons partielles** — le stock ne bouge qu'à la livraison réellement validée
- **Paiements** — partiels, retenue 2,2 % automatique
- **Relances** — proformas en attente, factures impayées, réassorts à proposer, liens WhatsApp pré-remplis
- **5 rôles** — admin, directeur, commercial, magasinier (sans prix d'achat), comptable

## Installation

### 1. Base de données (Neon — gratuit)
1. Créez un compte sur https://neon.tech
2. Nouveau projet → copiez la chaîne de connexion (`postgresql://...`)

### 2. Déploiement (Vercel)
1. Poussez ce dossier sur un dépôt GitHub
2. Sur https://vercel.com → **Add New → Project** → importez le dépôt
3. Dans **Environment Variables**, ajoutez :
   - `DATABASE_URL` = la chaîne Neon
   - `AUTH_SECRET` = une longue chaîne aléatoire
4. **Deploy**

Les tables sont créées automatiquement au build (`prisma db push`).

### 3. Données initiales et compte admin
```bash
npm install
npx prisma db push        # si besoin en local
DATABASE_URL="..." npm run seed   # catégories + 125 produits
```
Puis ouvrez `https://votre-app.vercel.app/installation` pour créer le compte administrateur.

### Développement local
```bash
cp .env.example .env      # renseignez DATABASE_URL et AUTH_SECRET
npm install
npx prisma db push
npm run seed
npm run dev
```

## Structure
```
app/(app)/     pages protégées (dashboard, clients, produits, proformas...)
app/connexion  authentification
lib/           db (Prisma), auth (sessions JWT), utils (stock, numérotation)
prisma/        schéma et données initiales
```
