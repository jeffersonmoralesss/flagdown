// iPhone and Android: give the app a `localStorage` that saves into a small SQLite database on the phone.
// Files ending in .native.js are used on phones; the plain storage.js next to it is used on the web.
import 'expo-sqlite/localStorage/install';
