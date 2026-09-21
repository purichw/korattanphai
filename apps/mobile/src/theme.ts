// Mirror the web's semantic roles; tests/brand-parity.test.mjs guards drift.
export const theme = {
  colors: {
    bg: '#eef1ed',
    surface: '#ffffff',
    surfaceMuted: '#f7f8f6',
    ink: '#1c2420',
    muted: '#65726b',
    line: '#d8ded7',
    lineStrong: '#bac6bd',
    primary: '#245947',
    primaryStrong: '#12392d',
  },
  radius: 8,
  fontFamily: 'Google Sans',
  fonts: {
    regular: 'GoogleSans_400Regular',
    semibold: 'GoogleSans_600SemiBold',
    bold: 'GoogleSans_700Bold',
  },
} as const;
