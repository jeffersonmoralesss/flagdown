// Upload and track the three documents. Picking a file and typing its expiry date are two steps, so a
// driver can't upload a document without saying when it runs out. That date is what hides a cab
// automatically when the document expires.
import * as DocumentPicker from 'expo-document-picker';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { useT } from '../i18n';
import { uploadDocument } from '../lib/api';
import { addDays, formatDate } from '../lib/dates';
import { daysUntil, EXPIRING_SOON_DAYS, REQUIRED_KINDS, summarize } from '../lib/documents';
import { checkExpiryDate } from '../lib/validate';
import { colors, fonts } from '../theme';
import { Banner, Body, Button, Card, Field, Heading } from './ui';

const STATE_COLOR = {
  missing: colors.bad,
  review: colors.muted,
  verified: colors.live,
  expiring: colors.bad,
  expired: colors.bad,
};

export default function DocumentsSection({ driverId, userId, documents, onChanged }) {
  const { t } = useT();
  return (
    <View style={{ gap: 12 }}>
      <Heading>{t('docs.title')}</Heading>
      <Body muted>{t('docs.intro')}</Body>
      {REQUIRED_KINDS.map((kind) => (
        <DocumentCard key={kind} kind={kind} driverId={driverId} userId={userId} documents={documents} onChanged={onChanged} />
      ))}
    </View>
  );
}

function DocumentCard({ kind, driverId, userId, documents, onChanged }) {
  const { t, lang } = useT();
  const { state, current, pending } = summarize(documents, kind);
  const [file, setFile] = useState(null); // the picked file, before upload
  const [expiresOn, setExpiresOn] = useState('');
  const [error, setError] = useState(null); // { key, vars }
  const [busy, setBusy] = useState(false);

  const pick = async () => {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true, // copies the file somewhere the app can read it
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    // 5 MB keeps us well inside Supabase's free 1 GB of file storage.
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      setError({ key: 'docs.tooBig' });
      return;
    }
    setFile(asset);
  };

  const upload = async () => {
    const dateError = checkExpiryDate(expiresOn);
    if (dateError) {
      setError(dateError);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await uploadDocument({ driverId, userId, kind, file, expiresOn: expiresOn.trim() });
      setFile(null);
      setExpiresOn('');
      onChanged();
    } catch (e) {
      setError({ key: 'docs.failed', vars: { message: e.message } });
    } finally {
      setBusy(false);
    }
  };

  const shown = current ?? pending;
  const days = current ? daysUntil(current.expires_on) : null;
  const expiry = shown?.expires_on
    ? days != null && days <= EXPIRING_SOON_DAYS
      ? t('docs.expiresIn', { date: formatDate(shown.expires_on, lang), n: days })
      : t('docs.expires', { date: formatDate(shown.expires_on, lang) })
    : null;

  return (
    <Card>
      <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: colors.ink }}>{t(`docs.${kind}`)}</Text>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: STATE_COLOR[state] }}>{t(`docs.${state}`)}</Text>
      {expiry ? <Body muted>{expiry}</Body> : null}
      {current && pending ? <Body muted>{t('docs.newerPending')}</Body> : null}

      {file ? (
        <>
          <Body>{t('docs.selected', { name: file.name })}</Body>
          <Field
            label={t('docs.expiry')}
            hint={t('docs.expiryHint', { example: addDays(365) })}
            value={expiresOn}
            onChangeText={setExpiresOn}
            placeholder={addDays(365)}
            keyboardType="numbers-and-punctuation"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {error ? <Banner tone="bad">{t(error.key, error.vars)}</Banner> : null}
          <Button label={t('docs.upload')} onPress={upload} busy={busy} />
          <Button tone="link" label={t('docs.chooseOther')} onPress={pick} />
        </>
      ) : (
        <>
          {error ? <Banner tone="bad">{t(error.key, error.vars)}</Banner> : null}
          <Button
            tone={state === 'missing' || state === 'expired' ? 'primary' : 'secondary'}
            label={state === 'missing' ? t('docs.choose') : t('docs.chooseNewer')}
            onPress={pick}
          />
        </>
      )}
    </Card>
  );
}
