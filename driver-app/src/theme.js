// The same look as the rider app: DC cab red with a gray stripe, and Overpass, the highway-sign typeface.
// Red is kept for the one main action on each screen. Green means "you're live".
export const colors = {
  red: '#C8102E',
  redPress: '#A10D25',
  stripe: '#B4BAC2',
  ink: '#16202B',
  muted: '#55606E',
  line: '#DDE1E6',
  surface: '#F4F5F7',
  white: '#FFFFFF',
  live: '#0B7A43',
  liveBg: '#E7F4EC',
  bad: '#B3261E',
  badBg: '#FBECEA',
  notice: '#FFF5DA',
  noticeLine: '#E8C766',
  focus: '#1B5FD9',
};

// React Native on Android can't make a custom font bold by itself, so each weight is its own font file.
export const fonts = {
  regular: 'Overpass_400Regular',
  semibold: 'Overpass_600SemiBold',
  bold: 'Overpass_800ExtraBold',
};

// Every tap target is at least this tall: drivers tap between rides, often in a hurry.
export const TAP = 52;
