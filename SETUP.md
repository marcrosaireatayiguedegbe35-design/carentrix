# Location Bénin — Locataire, Propriétaire & Back-office Garage (MVP)

Plateforme de location de véhicules entre particuliers au Bénin, avec anonymat croisé
propriétaire/locataire via un garage central. Ce MVP couvre :
- l'**espace Locataire** : inscription, recherche de véhicules, réservation, paiement Mobile
  Money (simulé), suivi des réservations ;
- l'**espace Propriétaire** : inscription, dépôt de véhicule, activation/désactivation,
  suivi des réservations et des revenus nets de commission ;
- le **back-office Garage** : vérification KYC, validation du contrôle technique, remise et
  retour du véhicule (états des lieux horodatés), gestion des litiges, et le seul écran du
  système où les deux identités d'une réservation sont réunies — chaque consultation est
  journalisée.

Stack : React + Vite + TypeScript (frontend) · Supabase (Postgres + Auth + Row Level Security).

## 1. Initialiser la base Supabase

Dans le dashboard Supabase du projet (`https://swpvaiefvizohhykidpc.supabase.co`) → **SQL
Editor**, exécutez ces fichiers **dans l'ordre** :

1. [`supabase/schema.sql`](supabase/schema.sql) — tables, vues publiques (qui masquent
   l'identité des propriétaires), policies RLS et fonctions métier (réservation, paiement,
   annulation).
2. [`supabase/schema_proprietaire.sql`](supabase/schema_proprietaire.sql) — permet à un
   propriétaire de gérer ses propres véhicules, verrouille les champs réservés au garage
   (contrôle technique, code public), et crée la vue de suivi des réservations/revenus.
3. [`supabase/schema_garage.sql`](supabase/schema_garage.sql) — **corrige une faille de
   sécurité** du trigger d'inscription (un utilisateur pouvait s'auto-attribuer le rôle
   `GARAGE` via les métadonnées de `signUp`, et donc voir toutes les identités — désormais
   seuls `PROPRIETAIRE`/`LOCATAIRE` restent possibles par ce chemin), puis ajoute les policies
   de lecture du garage, le journal d'accès aux identités, et les fonctions de transition
   (KYC, remise/retour véhicule, litiges).
4. (Optionnel, pour tester avec des données) [`supabase/seed.sql`](supabase/seed.sql) — 3
   propriétaires de démo et 5 véhicules déjà validés (`controle_technique_ok = true`).
5. [`supabase/seed_garage.sql`](supabase/seed_garage.sql) — crée **le seul moyen légitime**
   d'obtenir un compte `GARAGE` : un administrateur l'exécute directement en SQL, jamais via
   l'inscription publique. Identifiants de démo : `garage@demo.location-benin.bj` /
   `demo-password-123`.
6. Dans **Authentication > Providers > Email**, vérifiez si "Confirm email" est activé. S'il
   l'est, un utilisateur inscrit devra cliquer le lien reçu par email avant de pouvoir se
   connecter ; pour tester plus vite en local, vous pouvez le désactiver temporairement.

## 1bis. Configurer l'envoi du code d'inscription (API Gmail)

La fonction `inscription` envoie un code à 6 chiffres (qui sert de mot de passe temporaire)
par email via l'**API Gmail en HTTPS** — pas par SMTP : Supabase Edge Functions tourne sur
Deno Deploy, qui bloque les connexions SMTP sortantes (ports 25/465/587) pour éviter les abus.

1. Sur [console.cloud.google.com](https://console.cloud.google.com), avec le compte Gmail qui
   enverra les emails : créez/sélectionnez un projet, puis **APIs & Services → Library** →
   activez **Gmail API**.
2. **APIs & Services → OAuth consent screen** → type Externe → nom quelconque → scope
   `https://www.googleapis.com/auth/gmail.send` → ajoutez ce compte Gmail comme utilisateur
   test (reste en mode Test, pas de validation Google nécessaire).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → type **Desktop
   app** → notez le **Client ID** et le **Client Secret**.
4. Sur [OAuth Playground](https://developers.google.com/oauthplayground) : icône ⚙️ → cochez
   "Use your own OAuth credentials" → collez Client ID/Secret → sélectionnez le scope
   **Gmail API v1 → gmail.send** → **Authorize APIs** → connectez-vous avec le compte Gmail →
   **Exchange authorization code for tokens** → copiez le **Refresh token**.
5. Définissez les secrets et déployez :
   ```bash
   export GMAIL_USER='votre-adresse@gmail.com'
   export GOOGLE_CLIENT_ID='...'
   export GOOGLE_CLIENT_SECRET='...'
   export GOOGLE_REFRESH_TOKEN='...'
   ./scripts/deploy-inscription-gmail.sh
   ```

## 2. Lancer le frontend

```bash
cd frontend
npm install
npm run dev
```

Les identifiants Supabase sont déjà dans `frontend/.env` (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` — la clé publique/anon, sûre à exposer côté client car toutes
les règles de confidentialité sont appliquées par Row Level Security côté base de données).

## Parcours de test suggéré

1. Inscrivez-vous comme **propriétaire**, déposez un véhicule (`/proprietaire/vehicules/nouveau`).
2. Connectez-vous avec le compte **garage** de démo, validez son contrôle technique
   (`/garage/vehicules`) et vérifiez son KYC ainsi que celui du locataire (`/garage/utilisateurs`).
3. Inscrivez-vous comme **locataire**, réservez ce véhicule et payez (simulation Mobile Money).
4. Toujours en garage, ouvrez la réservation (`/garage/reservations`), remettez le véhicule,
   marquez son retour, puis clôturez (avec ou sans litige) — observez le solde propriétaire se
   mettre à jour dans `/proprietaire/reservations`.

## Comment l'anonymat croisé est garanti

- Le locataire ne peut lire les véhicules qu'à travers la vue `vehicules_publics` (et la fonction
  `rechercher_vehicules`), qui n'inclut jamais `proprietaire_id`.
- Toute écriture (créer une réservation, payer, annuler) passe par une fonction Postgres
  `SECURITY DEFINER` qui recalcule elle-même le prix et vérifie les transitions de statut — le
  client ne peut donc jamais falsifier un montant ou un statut.
- Chaque locataire ne voit que ses propres réservations et paiements ; chaque propriétaire ne
  voit que ses propres véhicules et les réservations qui les concernent — jamais l'identité de
  l'autre partie, seulement des codes, des dates et un montant.
- Un déclencheur (`verrouiller_champs_vehicule`) empêche un propriétaire de modifier son propre
  `code_public` ou de s'auto-certifier "contrôle technique OK" — seul un compte `GARAGE` le peut.
- Un compte `GARAGE` ne peut **jamais** être créé via l'inscription publique (corrigé dans
  `schema_garage.sql`) : uniquement par un administrateur, en SQL, avec `seed_garage.sql` comme
  modèle.
- Le garage est le seul acteur pouvant réunir les deux identités d'une réservation, via la
  fonction `garage_details_reservation` — chaque appel insère une ligne dans
  `journal_acces_identite` (qui, quand, pour quelle réservation), pour la traçabilité interne
  exigée par le cahier des charges.

## Limites assumées de ce MVP

- Photos de véhicule : un simple lien URL, pas d'upload réel (Supabase Storage serait l'étape
  suivante).
- Paiement Mobile Money : entièrement simulé, aucune intégration d'agrégateur réel
  (Kkiapay/FedaPay/CinetPay).
- KYC : validation manuelle par le garage sans upload de documents (pièce d'identité, permis,
  justificatif de propriété) — le garage vérifie en personne et bascule le statut dans l'app.
- Simplification du cycle de vie : les statuts `VEHICULE_REMIS` et `RETOURNE` existent dans le
  schéma mais ne sont pas utilisés comme étapes manuelles séparées (la remise passe directement
  à `EN_LOCATION`, le retour directement à `INSPECTION`) — l'état des lieux horodaté fait foi de
  l'événement.
- Score de confiance anonymisé, points de dépôt secondaires, traceur GPS, fonds de garantie
  mutualisé, tarification dynamique : prévus en Phase 2 par le cahier des charges, non construits
  ici.

## Application mobile

Voir [`MOBILE.md`](MOBILE.md) — app Android Capacitor (`bj.carentrix.app`).
