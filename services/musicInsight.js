import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';

const functions = getFunctions(app);

export async function generateMusicInsight() {
  const callable = httpsCallable(functions, 'generateMusicInsight');
  const result = await callable({});
  return result.data?.insight || null;
}
