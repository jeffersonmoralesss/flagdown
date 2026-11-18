// The top of the driver app. It picks the screen from two pieces of data:
//   session - who is signed in (from Supabase Auth)
//   driver  - their row in the drivers table (null if they haven't filled in their details yet)
//
//   not signed in               -> AuthScreen
//   no driver row, or editing   -> ProfileForm
//   status 'pending'            -> SetupScreen (checklist, then "waiting for review")
//   status 'suspended'          -> SuspendedScreen
//   status 'approved'           -> HomeScreen (the Available switch)
//
// No navigation library: a few screens chosen by data are easier to follow, and the back button can
// never land on a screen that no longer makes sense (like the sign-up form after approval).
// Each weight imported on its own: importing the whole package would ship all 18 styles (about 3 MB).
import { Overpass_400Regular } from '@expo-google-fonts/overpass/400Regular';
import { Overpass_600SemiBold } from '@expo-google-fonts/overpass/600SemiBold';
import { Overpass_800ExtraBold } from '@expo-google-fonts/overpass/800ExtraBold';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Body, Loading, Screen, Title } from './src/components/ui';
import { LangProvider, useT } from './src/i18n';
import { getMyDriver, setAvailable } from './src/lib/api';
import { isConfigured, supabase } from './src/lib/supabase';
import { stopSharing } from './src/location/tracking';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import ProfileForm from './src/screens/ProfileForm';
import SetupScreen from './src/screens/SetupScreen';
import SuspendedScreen from './src/screens/SuspendedScreen';

export default function App() {
  // The three weights of Overpass. Until they load, show the spinner (without them every word would
  // jump once the font arrives). If they fail, the app carries on in the phone's own font.
  const [fontsLoaded, fontError] = useFonts({ Overpass_400Regular, Overpass_600SemiBold, Overpass_800ExtraBold });

  return (
    <SafeAreaProvider>
      <LangProvider>
        <StatusBar style="dark" />
        {!fontsLoaded && !fontError ? <Loading /> : isConfigured ? <Main /> : <MissingKeys />}
      </LangProvider>
    </SafeAreaProvider>
  );
}

function Main() {
  const [session, setSession] = useState(undefined); // undefined = still checking, null = signed out
  const [driver, setDriver] = useState(undefined); // undefined = still loading, null = no row yet
  const [editing, setEditing] = useState(false);
  const userId = session?.user?.id;

  // Hear about sign-in and sign-out. This also fires once at start with the saved session.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const loadDriver = useCallback(async () => {
    if (!userId) return;
    try {
      setDriver(await getMyDriver(userId));
    } catch {
      // Keep what we had: a weak signal shouldn't throw the driver back to an empty form.
      setDriver((current) => (current === undefined ? null : current));
    }
  }, [userId]);

  useEffect(() => {
    setDriver(undefined);
    loadDriver();
  }, [loadDriver]);

  // Check again when the app comes back on screen, so an approval shows up without signing out.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadDriver();
    });
    return () => sub.remove();
  }, [loadDriver]);

  const signOut = async () => {
    await stopSharing();
    if (driver?.is_available) await setAvailable(driver.id, false).catch(() => {});
    await supabase.auth.signOut();
    setDriver(undefined);
    setEditing(false);
  };

  if (session === undefined) return <Loading />;
  if (!session) return <AuthScreen />;
  if (driver === undefined) return <Loading />;

  if (!driver || editing) {
    return (
      <ProfileForm
        userId={userId}
        driver={driver}
        onSaved={(saved) => {
          setDriver(saved);
          setEditing(false);
        }}
        onCancel={driver ? () => setEditing(false) : null}
      />
    );
  }

  const shared = { driver, userId, onEditProfile: () => setEditing(true), onSignOut: signOut };
  if (driver.status === 'suspended') return <SuspendedScreen onCheckStatus={loadDriver} onSignOut={signOut} />;
  if (driver.status === 'pending') return <SetupScreen {...shared} onCheckStatus={loadDriver} />;
  return <HomeScreen {...shared} onDriverChanged={setDriver} />;
}

function MissingKeys() {
  const { t } = useT();
  return (
    <Screen>
      <Title>{t('keys.title')}</Title>
      <Body>{t('keys.body')}</Body>
      <Body muted>{t('keys.how')}</Body>
    </Screen>
  );
}
