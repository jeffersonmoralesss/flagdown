// The driver's details: who they are, and their cab.
// New drivers fill in everything. Once approved, what riders recognize the cab by is locked (the
// database enforces this too), so only the phone number and payment types stay editable here.
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Body, Button, Choices, Field, Heading, Screen, Title } from '../components/ui';
import { useT } from '../i18n';
import { saveDriver } from '../lib/api';
import { checkDriverForm, cleanDriverForm, COLORS, PAYMENT_CHOICES, SEAT_CHOICES } from '../lib/validate';
import { colors } from '../theme';

const EMPTY = {
  display_name: '',
  legal_name: '',
  phone: '',
  dfhv_license_number: '',
  company_name: '',
  cab_number: '',
  plate: '',
  vehicle_color: '',
  vehicle_make: '',
  vehicle_model: '',
  seats: 4,
  wheelchair_accessible: false,
  payments: ['cash', 'card'],
};

// Small color dots next to each color name, to make the list faster to scan.
const SWATCH = {
  black: '#1A1A1A', blue: '#2D5BB9', gray: '#8A9099', green: '#2E7D4F', red: '#C8102E',
  silver: '#C9CDD2', white: '#FFFFFF', yellow: '#F2C230', other: 'transparent',
};

export default function ProfileForm({ userId, driver, onSaved, onCancel }) {
  const { t } = useT();
  const locked = driver?.status === 'approved';
  const [form, setForm] = useState(() => (driver ? pick(driver) : EMPTY));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  const submit = async () => {
    const { errors: next, ok } = checkDriverForm(form);
    setErrors(next);
    setSaveError(null);
    if (!ok) return;
    setBusy(true);
    try {
      const clean = cleanDriverForm(form);
      const fields = locked ? { phone: clean.phone, payments: clean.payments } : { ...clean, user_id: userId };
      onSaved(await saveDriver(fields, driver?.id));
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Seat counts outside the usual choices (for example 3) still show as an option.
  const seatOptions = [...new Set([...SEAT_CHOICES, form.seats])].sort((a, b) => a - b).map((n) => ({ value: n, label: String(n) }));
  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Screen>
      <Title>{driver ? t('profile.editTitle') : t('profile.newTitle')}</Title>
      <Body muted>{t('profile.intro')}</Body>

      <Heading>{t('profile.you')}</Heading>
      <Field label={t('profile.displayName')} value={form.display_name} onChangeText={set('display_name')} error={errors.display_name} editable={!locked} autoComplete="given-name" />
      <Field label={t('profile.legalName')} hint={t('profile.legalNameHint')} value={form.legal_name} onChangeText={set('legal_name')} error={errors.legal_name} editable={!locked} autoComplete="name" />
      <Field label={t('profile.phone')} value={form.phone} onChangeText={set('phone')} error={errors.phone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      <Field label={t('profile.license')} value={form.dfhv_license_number} onChangeText={set('dfhv_license_number')} error={errors.dfhv_license_number} editable={!locked} autoCapitalize="characters" autoCorrect={false} />

      <Heading>{t('profile.cab')}</Heading>
      {locked ? <Banner tone="notice">{t('profile.locked')}</Banner> : null}
      <Field label={t('profile.company')} value={form.company_name} onChangeText={set('company_name')} error={errors.company_name} editable={!locked} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label={t('profile.cabNumber')} value={form.cab_number} onChangeText={set('cab_number')} error={errors.cab_number} editable={!locked} autoCapitalize="characters" autoCorrect={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('profile.plate')} value={form.plate} onChangeText={set('plate')} error={errors.plate} editable={!locked} autoCapitalize="characters" autoCorrect={false} />
        </View>
      </View>
      <Choices
        label={t('profile.color')}
        options={COLORS.map((c) => ({ value: c, label: t(`color.${c}`) }))}
        value={form.vehicle_color}
        onChange={set('vehicle_color')}
        error={errors.vehicle_color}
        disabled={locked}
        renderSwatch={(c) =>
          c === 'other' ? null : (
            <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: SWATCH[c], borderWidth: 1, borderColor: colors.stripe }} />
          )
        }
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Field label={t('profile.make')} placeholder={t('profile.makeHint')} value={form.vehicle_make} onChangeText={set('vehicle_make')} error={errors.vehicle_make} editable={!locked} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label={t('profile.model')} placeholder={t('profile.modelHint')} value={form.vehicle_model} onChangeText={set('vehicle_model')} error={errors.vehicle_model} editable={!locked} />
        </View>
      </View>
      <Choices label={t('profile.seats')} options={seatOptions} value={form.seats} onChange={set('seats')} error={errors.seats} disabled={locked} />
      <Choices
        label={t('profile.wheelchair')}
        options={[{ value: true, label: t('yes') }, { value: false, label: t('no') }]}
        value={form.wheelchair_accessible}
        onChange={set('wheelchair_accessible')}
        disabled={locked}
      />
      <Choices
        label={t('profile.payments')}
        options={PAYMENT_CHOICES.map((p) => ({ value: p, label: t(`pay.${p}`) }))}
        value={form.payments}
        onChange={set('payments')}
        error={errors.payments}
        multiple
      />

      {hasErrors ? <Banner tone="bad">{t('profile.fixErrors')}</Banner> : null}
      {saveError ? <Banner tone="bad">{saveError}</Banner> : null}
      <Button label={driver ? t('save') : t('profile.saveNew')} onPress={submit} busy={busy} big />
      {onCancel ? <Button tone="secondary" label={t('cancel')} onPress={onCancel} /> : null}
    </Screen>
  );
}

// Copies just the form's fields out of a saved driver row.
function pick(driver) {
  return Object.fromEntries(Object.keys(EMPTY).map((k) => [k, driver[k] ?? EMPTY[k]]));
}
