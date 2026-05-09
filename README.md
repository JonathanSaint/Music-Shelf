# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Environment

   - Copy `.env.example` to `.env` and fill **Firebase** (`EXPO_PUBLIC_FIREBASE_*`) and **Spotify** `EXPO_PUBLIC_SPOTIFY_CLIENT_ID`.
   - In [Firebase Console](https://console.firebase.google.com), enable **Authentication** (Email/Password) and create a **Firestore** database. Deploy `firestore.rules` (or paste its contents in the Rules editor) so users can write only their own `users/{uid}` and `users/{uid}/private/*`.

3. Spotify redirect URI

   - Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
   - On the **Profile** tab inside the app, copy the **Redirect URI** shown under “Add this exact Redirect URI…” and add it under **Redirect URIs** in the Spotify app settings. It differs between Expo Go, dev builds, and web.

4. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
