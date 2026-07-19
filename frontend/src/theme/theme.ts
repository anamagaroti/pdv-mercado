import { createTheme } from '@mui/material/styles';
import { tokens } from './tokens';

export const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: tokens.color.bgBase,
      paper: tokens.color.bgSurface,
    },
    primary: {
      main: tokens.color.accent,
      contrastText: '#FFFFFF',
    },
    text: {
      primary: tokens.color.textPrimary,
      secondary: tokens.color.textSecondary,
    },
    divider: tokens.color.border,
    success: { main: tokens.color.statusValido },
    warning: { main: tokens.color.statusNaoEncontrado },
    error: { main: tokens.color.statusInvalido },
  },
  typography: {
    fontFamily: tokens.font.body,
    h1: { fontFamily: tokens.font.display, fontWeight: 600 },
    h2: { fontFamily: tokens.font.display, fontWeight: 600 },
    h3: { fontFamily: tokens.font.display, fontWeight: 600 },
    h4: { fontFamily: tokens.font.display, fontWeight: 600 },
    h5: { fontFamily: tokens.font.display, fontWeight: 600 },
    h6: { fontFamily: tokens.font.display, fontWeight: 600 },
    button: { fontWeight: 600, textTransform: 'none' as const },
  },
  shape: {
    borderRadius: tokens.radius.md,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.color.bgBase,
        },
        '*:focus-visible': {
          outline: `2px solid ${tokens.color.accent}`,
          outlineOffset: 2,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: `1px solid ${tokens.color.border}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: tokens.radius.sm,
          paddingTop: 8,
          paddingBottom: 8,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: 'small',
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderColor: tokens.color.border,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
      },
    },
  },
});
