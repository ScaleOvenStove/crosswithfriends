import {initializeApp, getApps, type FirebaseApp} from 'firebase/app';
import {
  getDatabase,
  ref,
  onValue,
  off,
  get,
  serverTimestamp,
  type Database,
  type DatabaseReference,
} from 'firebase/database';

const offline = false;
const CONFIGS: Record<
  string,
  {
    apiKey: string;
    authDomain: string;
    databaseURL: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId?: string;
  }
> = {
  production: {
    apiKey: 'AIzaSyCe4BWm9kbjXFwlZcmq4x8DvLD3TDoinhA',
    authDomain: 'crosswordsio.firebaseapp.com',
    databaseURL: 'https://crosswordsio.firebaseio.com',
    projectId: 'crosswordsio',
    storageBucket: 'crosswordsio.appspot.com',
    messagingSenderId: '1021412055058',
  },
  development: {
    apiKey: 'AIzaSyC4Er27aLKgSK4u2Z8aRfD6mr8AvLPA8tA',
    authDomain: 'dfac-fa059.firebaseapp.com',
    databaseURL: 'https://dfac-fa059.firebaseio.com',
    projectId: 'dfac-fa059',
    storageBucket: 'dfac-fa059.appspot.com',
    messagingSenderId: '132564774895',
    appId: '1:132564774895:web:a3bf48cd38c4df81e8901a',
  },
};
const env = (import.meta.env.VITE_ENV || import.meta.env.MODE) as string;
const config = CONFIGS[env] || CONFIGS.development;

// Initialize Firebase app if not already initialized
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(config);
} else {
  app = getApps()[0];
}

const db = getDatabase(app);

const SERVER_TIME = serverTimestamp();

const offsetRef = ref(db, '.info/serverTimeOffset');
let offset = 0;
get(offsetRef).then((snapshot) => {
  offset = snapshot.val() || 0;
});

function getTime(): number {
  return new Date().getTime() + offset;
}

export {db, SERVER_TIME};
export {offline, getTime};
export type {Database, DatabaseReference};
export default app;
