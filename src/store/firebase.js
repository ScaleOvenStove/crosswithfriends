import firebase from 'firebase/app';

import 'firebase/database';

import 'firebase/auth';

const CONFIGS = {
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
const config = CONFIGS[import.meta.env.VITE_ENV || import.meta.env.MODE];

firebase.initializeApp(config);
const db = firebase.database();

export {db};

export default firebase;
