// A pending driver's checklist: details, documents, then review. These really are steps in order,
// so they're numbered.
import { StyleSheet, Text, View } from 'react-native';
import DocumentsSection from '../components/DocumentsSection';
import { Banner, Body, Button, Loading, Screen, Title } from '../components/ui';
import { useT } from '../i18n';
import { uploadedCount } from '../lib/documents';
import { useDocuments } from '../lib/useDocuments';
import { colors, fonts } from '../theme';

export default function SetupScreen({ driver, userId, onEditProfile, onCheckStatus, onSignOut }) {
  const { t } = useT();
  const { documents, loading, reload } = useDocuments(driver.id);
  if (loading) return <Loading />;

  const uploaded = uploadedCount(documents);
  const allIn = uploaded === 3;

  return (
    <Screen>
      <Title>{t('setup.title')}</Title>

      <View>
        <Step n={1} done title={t('setup.step1')}>
          <Body muted>{t('setup.step1Done')}</Body>
          <Button tone="link" label={t('setup.edit')} onPress={onEditProfile} style={{ alignSelf: 'flex-start', paddingHorizontal: 0 }} />
        </Step>
        <Step n={2} done={allIn} title={t('setup.step2')}>
          <Body muted>{t('setup.step2Count', { n: uploaded })}</Body>
        </Step>
        <Step n={3} title={t('setup.step3')} last>
          <Body muted>{t('setup.step3Body')}</Body>
        </Step>
      </View>

      {allIn ? (
        <Banner tone="good">{t('setup.waiting')}</Banner>
      ) : null}
      {allIn ? <Button tone="secondary" label={t('checkStatus')} onPress={onCheckStatus} /> : null}

      <DocumentsSection driverId={driver.id} userId={userId} documents={documents} onChanged={reload} />

      <Button tone="link" label={t('signOut')} onPress={onSignOut} />
    </Screen>
  );
}

function Step({ n, done, title, children, last }) {
  return (
    <View style={[st.step, !last && st.stepLine]}>
      <View style={[st.badge, done && st.badgeDone]}>
        <Text style={[st.badgeText, done && st.badgeTextDone]}>{done ? '✓' : n}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={st.stepTitle}>{title}</Text>
        {children}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  step: { flexDirection: 'row', gap: 14, paddingVertical: 12 },
  stepLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  badge: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: colors.live, borderColor: colors.live },
  badgeText: { fontFamily: fonts.bold, fontSize: 17, color: colors.red },
  badgeTextDone: { color: colors.white },
  stepTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink, marginTop: 4 },
});
