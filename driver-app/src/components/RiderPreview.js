// "What riders see": the driver's cab drawn the way it appears in the rider app's list, so drivers
// know exactly what a rider is looking at when they call.
import { StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n';
import { carLine, riderTags } from '../lib/format';
import { colors, fonts } from '../theme';
import { Body, Card, Plate } from './ui';

export default function RiderPreview({ driver }) {
  const { t, lang } = useT();
  const tags = riderTags(driver, t);
  return (
    <Card>
      <View style={st.row} accessible accessibilityLabel={`${driver.display_name}, ${driver.company_name}, ${carLine(driver, lang, t)}, ${driver.plate}`}>
        <View style={st.eta}>
          <Text style={st.etaNumber}>3</Text>
          <Text style={st.etaUnit}>min</Text>
        </View>
        <View style={st.body}>
          <Text style={st.name}>{driver.display_name}</Text>
          <Text style={st.muted}>{driver.company_name}</Text>
          <Text style={st.muted}>{carLine(driver, lang, t)}</Text>
          <Plate>{driver.plate}</Plate>
          {tags.length ? <Text style={st.tags}>{tags.join('   ')}</Text> : null}
        </View>
      </View>
      <Body muted style={st.note}>
        {t('home.previewNote')}
      </Body>
    </Card>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  eta: { width: 56, alignItems: 'center' },
  etaNumber: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 36, color: colors.ink },
  etaUnit: { fontFamily: fonts.semibold, fontSize: 14, color: colors.muted },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.bold, fontSize: 19, color: colors.ink },
  muted: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  tags: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink, marginTop: 4 },
  note: { fontSize: 15, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 10 },
});
