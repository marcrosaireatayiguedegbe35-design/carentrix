# Carentrix — application mobile (Android)

L’app mobile encapsule le frontend React avec **Capacitor**.
Même UI / logique / Supabase que le site web, dans une WebView native.

- **Package ID** : `bj.carentrix.app`
- **Plateforme prête** : Android (`frontend/android/`)
- **iOS** : possible avec Xcode sur macOS (`npx cap add ios`)

## Prérequis

- Node.js 22+
- Android Studio + SDK (`ANDROID_HOME` configuré)
- Émulateur Android ou téléphone en USB debug

## Lancer sur un téléphone / émulateur

```bash
cd frontend
cp .env.example .env   # si besoin, renseigner VITE_*
npm install
npm run mobile:build   # build web + sync Capacitor
npm run mobile:open    # ouvre Android Studio
```

Dans Android Studio : Run ▶ sur un device.

En une commande (device connecté) :

```bash
cd frontend
npm run mobile:run
```

## Workflow de développement

1. Modifier le code React dans `frontend/src/`
2. `npm run mobile:build` (ou `npm run build && npx cap sync`)
3. Relancer l’app depuis Android Studio / `npx cap run android`

Pour du live-reload (optionnel), dans `capacitor.config.ts` :

```ts
server: {
  androidScheme: "https",
  url: "http://VOTRE_IP_LAN:5173",
  cleartext: true,
}
```

Puis `npm run dev -- --host` et `npx cap run android`.

## Build APK de test

Capacitor 8 exige **JDK 21**. Si ton `java -version` est en 17 :

```bash
# une fois : JDK 21 portable (sans sudo)
# déjà possible sous ~/.local/jdk-21 si installé lors du setup
export JAVA_HOME="$HOME/.local/jdk-21"
export PATH="$JAVA_HOME/bin:$PATH"
```

Puis :

```bash
cd frontend
npm run mobile:build
cd android
./gradlew assembleDebug
```

APK : `android/app/build/outputs/apk/debug/app-debug.apk`

## Notes

- Les variables `VITE_*` sont figées **au build** (comme sur Render).
- Bouton retour Android : historique navigateur, sinon quitte l’app.
- Safe areas (encoche / barre de geste) gérées en CSS via `html.is-native`.
- **1ʳᵉ ouverture** : splash logos → carrousel fonctionnalités → connexion / inscription.
  Les fois suivantes : écran de connexion directement (`localStorage` `carentrix.onboarding.v1`).
- Pour revoir l’onboarding sur un appareil : effacer les données de l’app, ou en console WebView
  `localStorage.removeItem('carentrix.onboarding.v1')`.
