// Sign in, or create an account, with email and password.
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Body, Button, Field, Screen, Title } from '../components/ui';
import { useT } from '../i18n';
import { supabase } from '../lib/supabase';
import { checkEmail, checkPassword } from '../lib/validate';

// Supabase's English error messages, turned into our own words (in either language).
function friendlyError(message) {
  if (/invalid login credentials/i.test(message)) return { key: 'auth.badLogin' };
  if (/email not confirmed/i.test(message)) return { key: 'auth.notConfirmed' };
  return { raw: message };
}

export default function AuthScreen() {
  const { t } = useT();
  const [mode, setMode] = useState('signIn'); // 'signIn' | 'signUp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState(null); // { tone, key } or { tone, raw }
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const next = { email: checkEmail(email), password: checkPassword(password) };
    setErrors(next);
    setMessage(null);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      const creds = { email: email.trim(), password };
      const { data, error } = mode === 'signIn' ? await supabase.auth.signInWithPassword(creds) : await supabase.auth.signUp(creds);
      if (error) {
        setMessage({ tone: 'bad', ...friendlyError(error.message) });
      } else if (mode === 'signUp' && !data.session) {
        // The project asks new users to confirm their email first.
        setMessage({ tone: 'good', key: 'auth.checkEmail' });
        setMode('signIn');
      }
      // On success, App.js hears about the new session and moves on by itself.
    } finally {
      setBusy(false);
    }
  };

  const signingUp = mode === 'signUp';
  return (
    <Screen>
      <Title>{t('auth.title')}</Title>
      <Body muted>{t('auth.sub')}</Body>

      <View style={{ gap: 14, marginTop: 8 }}>
        <Field
          label={t('auth.email')}
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          textContentType="emailAddress"
        />
        <Field
          label={t('auth.password')}
          hint={signingUp ? t('auth.passwordHint') : null}
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          secureTextEntry
          autoComplete={signingUp ? 'new-password' : 'current-password'}
          textContentType={signingUp ? 'newPassword' : 'password'}
          onSubmitEditing={submit}
        />
        {message ? <Banner tone={message.tone}>{message.key ? t(message.key) : message.raw}</Banner> : null}
        <Button label={signingUp ? t('auth.signUp') : t('auth.signIn')} onPress={submit} busy={busy} big />
        <Button
          tone="link"
          label={signingUp ? t('auth.haveAccount') : t('auth.noAccount')}
          onPress={() => {
            setMode(signingUp ? 'signIn' : 'signUp');
            setErrors({});
            setMessage(null);
          }}
        />
      </View>
    </Screen>
  );
}
