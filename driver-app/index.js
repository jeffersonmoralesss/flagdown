// Order matters in this file.
//
// 1. Storage first: on iPhone and Android it installs a `localStorage` that saves to the phone, which
//    the sign-in session, the language choice and the location sharing all rely on. (In a web browser
//    localStorage already exists, so the web version of that file does nothing.)
// 2. The background location task second. When the phone wakes the app in the background just to
//    deliver a location, it runs this file but never shows a screen. If the task were defined inside a
//    component it wouldn't exist yet, and the location would be lost. (On the web there is no
//    background task, so the web version of that file does nothing.)
import './src/lib/storage';
import './src/location/task';

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
