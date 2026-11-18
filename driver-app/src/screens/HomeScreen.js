// An approved driver's main screen. The one thing that matters most is the Available switch, so it
// comes first and biggest. Below it: anything blocking them, what riders see, their subscription,
// their details and their documents.
import { useCallback, useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import DocumentsSection from '../components/DocumentsSection';
import RiderPreview from '../components/RiderPreview';
import { Banner, Body, Button, Card, Heading, Loading, Screen } from '../components/ui';
import { useT } from '../i18n';
import { setAvailable } from '../lib/api';
import { formatTimestampDate, timeAgo } from '../lib/dates';
import { allRequiredValid, REQUIRED_KINDS, summarize } from '../lib/documents';
import { subscriptionMessage, subscriptionOk } from '../lib/subscription';
import { useDocuments } from '../lib/useDocuments';
import { sharingStatus } from '../location/report';
import { currentMode, isExpoGo, SharingError, startSharing, stopSharing } from '../location/tracking';
import { colors, fonts } from '../theme';

export default function HomeScreen({ driver, userId, onDriverChanged, onEditProfile, onSignOut }) {
  const { t, lang } = useT();
  const { documents, loading, reload } = useDocuments(driver.id);
  const [mode, setMode] = useState(null); // 'background' | 'foreground' | 'web' | null
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // a translation key
  const [status, setStatus] = useState(sharingStatus());
  const [, setTick] = useState(0); // re-renders every few seconds so "sent 1 min ago" stays true

  const available = driver.is_available;

  const goAvailable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const started = await startSharing(driver.id);
      // Only once location works do we tell the database we're Available, so a cab is never listed
      // without a position.
      const stored = await setAvailable(driver.id, true);
      if (!stored) {
        // The database said no (for example an admin paused the account a moment ago).
        await stopSharing();
        throw new SharingError('home.refused');
      }
      setMode(started);
      onDriverChanged({ ...driver, is_available: true });
    } catch (e) {
      // Our own errors carry a translation key; anything else (a network error) shows as it came.
      setError(e instanceof SharingError ? e.key : { raw: e.message });
    } finally {
      setBusy(false);
      setStatus(sharingStatus());
    }
  }, [driver, onDriverChanged]);

  const goOffline = async () => {
    setBusy(true);
    setError(null);
    try {
      // Stop sending first, then switch off, so no position goes out after going offline.
      await stopSharing();
      await setAvailable(driver.id, false);
      setMode(null);
      onDriverChanged({ ...driver, is_available: false });
    } catch (e) {
      setError({ raw: e.message });
    } finally {
      setBusy(false);
    }
  };

  // When the screen opens: if the database says Available but nothing is sending (the phone
  // restarted, or the web page was reloaded), start sending again so the switch tells the truth.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const running = await currentMode();
      if (cancelled) return;
      setMode(running);
      if (available && !running) goAvailable();
    })();
    return () => {
      cancelled = true;
    };
    // Only when the screen opens, not every time `available` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh "location sent ..." every 5 seconds, and when the app comes back on screen.
  useEffect(() => {
    const timer = setInterval(() => {
      setStatus(sharingStatus());
      setTick((n) => n + 1);
    }, 5000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setStatus(sharingStatus());
        currentMode().then(setMode);
      }
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, []);

  if (loading) return <Loading />;

  const docsOk = allRequiredValid(documents);
  const subOk = subscriptionOk(driver);
  const blocked = !docsOk || !subOk;
  const expiringSoon = REQUIRED_KINDS.some((k) => summarize(documents, k).state === 'expiring');
  const sub = subscriptionMessage(driver);
  const ago = status.lastSentAt ? timeAgo(status.lastSentAt) : null;
  const errorText = error ? (typeof error === 'string' ? t(error) : error.raw) : null;

  return (
    <Screen>
      {/* The switch. Green border and dot when live, so the state reads at a glance from arm's length. */}
      <View style={[st.panel, available && st.panelLive]}>
        <View style={st.stateRow}>
          <View style={[st.dot, available && st.dotLive]} />
          <Text style={st.stateTitle} accessibilityRole="header" accessibilityLiveRegion="polite">
            {available ? t('home.available') : t('home.offline')}
          </Text>
        </View>
        <Body muted>{available ? t('home.availableBody') : t('home.offlineBody')}</Body>

        {available ? (
          <Button tone="secondary" label={t('home.goOffline')} onPress={goOffline} busy={busy} big />
        ) : (
          <Button label={t('home.goAvailable')} onPress={goAvailable} busy={busy} disabled={blocked} big />
        )}

        {available && ago ? <Body muted>{t('home.lastSent', { time: t(ago.key, { n: ago.n }) })}</Body> : null}
        {available && status.lastError ? <Banner tone="notice">{t('home.sendFailed')}</Banner> : null}
        {available && mode === 'web' ? <Banner tone="notice">{t('home.webNote')}</Banner> : null}
        {available && mode === 'foreground' ? <Banner tone="notice">{t(isExpoGo ? 'home.expoGoNote' : 'home.foregroundNote')}</Banner> : null}
      </View>

      {errorText ? <Banner tone="bad">{errorText}</Banner> : null}
      {blocked ? (
        <Banner tone="bad">
          <Text style={st.bannerStrong}>{t('home.cantGo')}</Text>
          {!docsOk ? <Text style={st.bannerText}>• {t('home.needDocs')}</Text> : null}
          {!subOk ? <Text style={st.bannerText}>• {t('home.needSub')}</Text> : null}
        </Banner>
      ) : null}
      {expiringSoon ? <Banner tone="notice">{t('home.expiringSoon')}</Banner> : null}

      <Heading>{t('home.preview')}</Heading>
      <RiderPreview driver={driver} />

      <Heading>{t('home.subTitle')}</Heading>
      <Card>
        <Body>{t(sub.key, sub.date ? { date: formatTimestampDate(sub.date, lang) } : {})}</Body>
      </Card>

      <Heading>{t('home.yourDetails')}</Heading>
      <Card>
        <Body strong>{driver.phone}</Body>
        <Body muted>{driver.payments.map((p) => t(`pay.${p}`)).join(', ')}</Body>
        <Button tone="secondary" label={t('home.editDetails')} onPress={onEditProfile} />
      </Card>

      <DocumentsSection driverId={driver.id} userId={userId} documents={documents} onChanged={reload} />

      <Button tone="link" label={t('signOut')} onPress={onSignOut} />
    </Screen>
  );
}

const st = StyleSheet.create({
  panel: { borderWidth: 2, borderColor: colors.line, borderRadius: 16, padding: 18, gap: 12, backgroundColor: colors.white },
  panelLive: { borderColor: colors.live, backgroundColor: colors.liveBg },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.stripe },
  dotLive: { backgroundColor: colors.live },
  stateTitle: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, color: colors.ink },
  bannerStrong: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  bannerText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.ink },
});
