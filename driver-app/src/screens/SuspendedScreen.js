import { Body, Button, Screen, Title } from '../components/ui';
import { useT } from '../i18n';

export default function SuspendedScreen({ onCheckStatus, onSignOut }) {
  const { t } = useT();
  return (
    <Screen>
      <Title>{t('suspended.title')}</Title>
      <Body>{t('suspended.body')}</Body>
      <Button tone="secondary" label={t('checkStatus')} onPress={onCheckStatus} />
      <Button tone="link" label={t('signOut')} onPress={onSignOut} />
    </Screen>
  );
}
