import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

import { env } from '@review-engine/shared';

// Use environment variables for the service account
// In production, these should be properly injected
// In development, they can be in .env

const firebaseConfig = {
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  // Replace actual newlines if they are escaped in the environment variable
  privateKey: env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

export const initFirebaseAdmin = () => {
  // Prevent multiple initializations in development hot-reloading
  let app: App | undefined;
  if (!getApps().length) {
    try {
      if (firebaseConfig.projectId && firebaseConfig.clientEmail && firebaseConfig.privateKey) {
        app = initializeApp({
          credential: cert(firebaseConfig),
        });
        // eslint-disable-next-line no-console
        console.info('Firebase Admin initialized successfully');
      } else {
        console.warn('Firebase Admin credentials missing. Firebase auth will not work.');
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
    }
  } else {
    app = getApps()[0];
  }
  return app;
};

export const firebaseApp = initFirebaseAdmin();
export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null;
