// Small building blocks shared by every screen. Each screen file is about WHAT it shows; how big,
// which font and which color live here, so the whole app stays consistent with one change.
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useT } from '../i18n';
import { colors, fonts, TAP } from '../theme';

// Web only: a clear blue ring around whatever has keyboard focus. :focus-visible is the browser's own
// rule for "focused by keyboard", so the ring shows for Tab users but not after a mouse click or tap.
if (Platform.OS === 'web' && typeof document !== 'undefined' && !document.getElementById('flagdown-focus')) {
  const style = document.createElement('style');
  style.id = 'flagdown-focus';
  style.textContent = `:focus-visible { outline: 3px solid ${colors.focus} !important; outline-offset: 2px; }`;
  document.head.appendChild(style);
}

// The top bar: brand, and the language switch. Same livery as the rider app: a red band over a gray stripe.
export function TopBar() {
  const { t, lang, setLang } = useT();
  return (
    <View style={s.topbar}>
      <Text style={s.brand}>Flagdown</Text>
      <Text style={s.brandSub}>Driver</Text>
      <Pressable
        onPress={() => setLang(lang === 'en' ? 'es' : 'en')}
        accessibilityRole="button"
        accessibilityLabel={t('lang.switchLabel')}
        style={({ pressed }) => [s.langButton, pressed && s.pressedQuiet]}
      >
        <Text style={s.langText}>{t('lang.switch')}</Text>
      </Pressable>
    </View>
  );
}

// A scrolling page under the top bar that stays clear of the notch and the home indicator.
// On a wide browser window the content stays a phone-like column instead of stretching.
// keyboardShouldPersistTaps lets a tap on a button work while the keyboard is open.
export function Screen({ children }) {
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <TopBar />
      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        <View style={s.column}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Loading() {
  const { t } = useT();
  return (
    <SafeAreaView style={[s.safe, s.center]}>
      <ActivityIndicator size="large" color={colors.red} accessibilityLabel={t('loading')} />
    </SafeAreaView>
  );
}

export function Title({ children }) {
  return (
    <Text style={s.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Heading({ children }) {
  return (
    <Text style={s.heading} accessibilityRole="header">
      {children}
    </Text>
  );
}

export function Body({ children, muted, strong, style }) {
  return <Text style={[s.body, muted && s.muted, strong && s.strong, style]}>{children}</Text>;
}

// tone: 'primary' (red: the one main action), 'secondary' (outline), 'live' (green), 'link'
export function Button({ label, onPress, tone = 'primary', busy, disabled, accessibilityHint, big, style }) {
  const off = disabled || busy;
  const onDark = tone === 'primary' || tone === 'live';
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: off, busy: !!busy }}
      style={({ pressed }) => [
        s.button,
        s[`button_${tone}`],
        big && s.buttonBig,
        pressed && s[`pressed_${tone}`],
        off && s.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={onDark ? colors.white : colors.ink} />
      ) : (
        <Text style={[s.buttonText, big && s.buttonTextBig, s[`buttonText_${tone}`]]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Card({ children, style }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// tone: 'bad' (something is blocking you), 'notice' (worth knowing), 'good'
export function Banner({ children, tone = 'notice' }) {
  return (
    <View style={[s.banner, s[`banner_${tone}`]]} accessibilityRole={tone === 'bad' ? 'alert' : undefined}>
      {typeof children === 'string' ? <Text style={s.bannerText}>{children}</Text> : children}
    </View>
  );
}

// A labeled text box. `error` is { key, vars } from src/lib/validate.js, or null.
export function Field({ label, hint, error, value, onChangeText, editable = true, ...inputProps }) {
  const { t } = useT();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.muted}
        style={[s.input, error && s.inputError, !editable && s.inputLocked]}
        {...inputProps}
      />
      {error ? <Text style={s.error}>{t(error.key, error.vars)}</Text> : null}
    </View>
  );
}

// A row of buttons to pick from. `multiple` lets more than one be on (payments); otherwise one at a time.
// Each chip says whether it's selected to screen readers, and selected chips get a check mark,
// so the choice never depends on color alone.
export function Choices({ label, options, value, onChange, multiple, error, disabled, renderSwatch }) {
  const { t } = useT();
  const isOn = (v) => (multiple ? value.includes(v) : value === v);
  const toggle = (v) => {
    if (!multiple) return onChange(v);
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <View style={s.field} accessibilityRole={multiple ? undefined : 'radiogroup'} accessibilityLabel={label}>
      <Text style={s.label}>{label}</Text>
      <View style={s.chips}>
        {options.map((opt) => {
          const on = isOn(opt.value);
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => toggle(opt.value)}
              disabled={disabled}
              accessibilityRole={multiple ? 'checkbox' : 'radio'}
              accessibilityState={{ checked: on, disabled }}
              accessibilityLabel={opt.label}
              style={({ pressed }) => [
                s.chip,
                on && s.chipOn,
                pressed && s.pressedQuiet,
                disabled && s.disabled,
              ]}
            >
              {renderSwatch ? renderSwatch(opt.value) : null}
              <Text style={[s.chipText, on && s.chipTextOn]}>
                {on ? '✓ ' : ''}
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={s.error}>{t(error.key, error.vars)}</Text> : null}
    </View>
  );
}

// A license plate, drawn the way the rider app draws it, because riders match it against the real one.
export function Plate({ children }) {
  return (
    <View style={s.plate}>
      <Text style={s.plateText}>{children}</Text>
    </View>
  );
}

export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  center: { alignItems: 'center', justifyContent: 'center' },
  page: { padding: 20, paddingBottom: 48 },
  column: { width: '100%', maxWidth: 560, alignSelf: 'center', gap: 16 },

  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderBottomWidth: 4,
    borderBottomColor: colors.red,
    // the gray stripe under the red band
    ...Platform.select({
      web: { boxShadow: `0 3px 0 ${colors.stripe}` },
      default: { shadowColor: colors.stripe, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 1, shadowRadius: 0, elevation: 0 },
    }),
    marginBottom: 3,
  },
  brand: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink },
  brandSub: { fontFamily: fonts.semibold, fontSize: 16, color: colors.muted, marginTop: 2 },
  langButton: {
    marginLeft: 'auto',
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 99,
  },
  langText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },

  title: { fontFamily: fonts.bold, fontSize: 32, lineHeight: 36, color: colors.ink, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, color: colors.ink, marginTop: 8 },
  body: { fontFamily: fonts.regular, fontSize: 17, lineHeight: 25, color: colors.ink },
  muted: { color: colors.muted },
  strong: { fontFamily: fonts.semibold },

  button: {
    minHeight: TAP,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonBig: { minHeight: 64 },
  button_primary: { backgroundColor: colors.red },
  pressed_primary: { backgroundColor: colors.redPress },
  button_live: { backgroundColor: colors.live },
  pressed_live: { opacity: 0.85 },
  button_secondary: { backgroundColor: colors.white, borderColor: colors.line },
  pressed_secondary: { borderColor: colors.ink },
  button_link: { backgroundColor: 'transparent', minHeight: 44, paddingHorizontal: 4 },
  pressed_link: { opacity: 0.6 },
  buttonText: { fontFamily: fonts.bold, fontSize: 18, textAlign: 'center' },
  buttonTextBig: { fontSize: 21 },
  buttonText_primary: { color: colors.white },
  buttonText_live: { color: colors.white },
  buttonText_secondary: { fontFamily: fonts.semibold, color: colors.ink },
  buttonText_link: { fontFamily: fonts.semibold, color: colors.ink, textDecorationLine: 'underline' },
  disabled: { opacity: 0.45 },
  pressedQuiet: { backgroundColor: colors.surface },

  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 16, gap: 10 },

  banner: { borderRadius: 10, padding: 14, borderLeftWidth: 5, gap: 4 },
  banner_bad: { backgroundColor: colors.badBg, borderLeftColor: colors.bad },
  banner_notice: { backgroundColor: colors.notice, borderLeftColor: colors.noticeLine },
  banner_good: { backgroundColor: colors.liveBg, borderLeftColor: colors.live },
  bannerText: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: colors.ink },

  field: { gap: 6 },
  label: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted, marginTop: -2 },
  input: {
    minHeight: TAP,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.bad },
  inputLocked: { backgroundColor: colors.surface, color: colors.muted },
  error: { fontFamily: fonts.semibold, fontSize: 15, color: colors.bad },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 46,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: 99,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontFamily: fonts.semibold, fontSize: 16, color: colors.ink },
  chipTextOn: { color: colors.white },

  plate: { alignSelf: 'flex-start', borderWidth: 1.5, borderColor: colors.ink, borderRadius: 4, paddingHorizontal: 6, paddingTop: 2 },
  plateText: { fontFamily: fonts.bold, fontSize: 15, letterSpacing: 1, color: colors.ink },
});
