export const APP_NAME = 'Music Shelf';
export const CONTACT_EMAIL = 'jarinda086@gmail.com';
export const LAST_UPDATED = 'May 15, 2026';

export const SPOTIFY_DATA_POINTS = [
  'Profile: display name, Spotify user ID, and profile image',
  'Listening history: recently played tracks (for rankings and stats)',
  'Top artists and tracks: short-term favorites (for genres and insights)',
  'Email: only if provided by Spotify for your account',
];

export const PRIVACY_SECTIONS = [
  {
    title: 'Who we are',
    body: `Music Shelf ("we", "us") is a music identity app that helps you view listening stats, rankings, and insights from your Spotify account. Contact: ${CONTACT_EMAIL}.`,
  },
  {
    title: 'What we collect',
    body: 'Account data: email and password (via Firebase Authentication) to create your Music Shelf account.\n\nSpotify data (only after you connect): ' +
      SPOTIFY_DATA_POINTS.map((x) => `• ${x}`).join('\n') +
      '\n\nWe do not sell your data. We do not use Spotify data for advertising.',
  },
  {
    title: 'How we use data',
    body: 'We use your data to:\n• Show your listening rankings, stats, and profile in the app\n• Sync and store your Spotify snapshot in Firebase (Firestore) so the app loads quickly\n• Generate optional AI listening insights when enabled\n\nWe only access Spotify after you tap Connect Spotify and approve permissions.',
  },
  {
    title: 'Where data is stored',
    body: 'Account and Spotify snapshots are stored in Google Firebase (Authentication and Firestore). Spotify access tokens are stored in a private Firestore path readable only by your account. Public profile fields (display name, rankings, genres) may be visible if you share your profile URL.',
  },
  {
    title: 'Your choices',
    body: '• Disconnect Spotify: Profile → Disconnect Spotify (removes tokens and Spotify data from Music Shelf)\n• Delete account: Profile → Delete Account (removes Firebase auth, Firestore data, and Spotify connection)\n• Sign out: ends your session on this device',
  },
  {
    title: 'Retention',
    body: 'We keep data while your account is active. When you disconnect Spotify or delete your account, we delete associated Spotify tokens and profile data from our systems, subject to normal Firebase backup cycles.',
  },
  {
    title: 'Third parties',
    body: '• Spotify: subject to Spotify Privacy Policy when you connect\n• Firebase / Google Cloud: hosting and authentication\n• Vercel: API routes for secure Spotify token exchange on web (no long-term storage of passwords)',
  },
  {
    title: 'Children',
    body: 'Music Shelf is not directed at children under 13. We do not knowingly collect data from children.',
  },
  {
    title: 'Changes',
    body: 'We may update this policy. The "Last updated" date at the top will change when we do. Continued use after changes means you accept the updated policy.',
  },
];

export const TERMS_SECTIONS = [
  {
    title: 'Agreement',
    body: 'By using Music Shelf you agree to these Terms. If you do not agree, do not use the service.',
  },
  {
    title: 'Service',
    body: 'Music Shelf provides personal music statistics and identity features powered by your Spotify listening data. The service is provided "as is" during beta and development.',
  },
  {
    title: 'Your account',
    body: 'You are responsible for your login credentials. You must provide accurate information. You may delete your account at any time from Profile.',
  },
  {
    title: 'Spotify',
    body: 'Music Shelf is not affiliated with Spotify AB. Spotify content is used under the Spotify Developer Platform. You must comply with Spotify Terms of Use. We may suspend access if Spotify revokes API access or your account violates policies.',
  },
  {
    title: 'Acceptable use',
    body: 'You may not misuse the app, attempt unauthorized access, scrape data at scale, resell Spotify data, or use the service to violate laws or third-party rights.',
  },
  {
    title: 'Intellectual property',
    body: 'Music Shelf branding and app design are ours. Music metadata, artwork, and previews belong to Spotify and rights holders.',
  },
  {
    title: 'Limitation of liability',
    body: 'To the fullest extent permitted by law, Music Shelf is not liable for indirect, incidental, or consequential damages. Our total liability is limited to the amount you paid us in the past 12 months (or zero if the service is free).',
  },
  {
    title: 'Contact',
    body: `Questions about these Terms: ${CONTACT_EMAIL}.`,
  },
];
