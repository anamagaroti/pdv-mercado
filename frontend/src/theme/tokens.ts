/**
 * Sistema de tokens visuais.
 *
 * Direção: um painel operacional denso (inspirado em Linear/Stripe/Vercel),
 * não uma página de marketing — por isso o risco visual fica concentrado
 * em UM elemento de assinatura: o campo gigante de leitura de código de
 * barras, que ganha um brilho âmbar pulsante quando focado, lembrando o
 * feixe de um leitor óptico. O resto da interface fica deliberadamente
 * quieto: superfícies em grafite-azulado, tipografia funcional, paleta curta.
 *
 * Os status do validador de NCM (verde/amarelo/vermelho/cinza) já são fixos
 * pelo escopo do projeto — por isso o accent principal (violeta) é uma cor
 * à parte, para não ser confundido com nenhum desses estados.
 */
export const tokens = {
  color: {
    bgBase: '#10131A',
    bgSurface: '#171B24',
    bgSurfaceRaised: '#1E232E',
    border: '#293040',
    borderStrong: '#3A4254',

    textPrimary: '#EEF0F4',
    textSecondary: '#9AA3B5',
    textTertiary: '#646E80',

    accent: '#7C6CF6', // violeta — ações primárias, links, foco geral
    accentMuted: '#332D55',

    scan: '#F5A623', // âmbar — assinatura visual do leitor de código de barras
    scanMuted: '#3A2E14',

    statusValido: '#3DD68C',
    statusValidoMuted: '#163A2C',
    statusNaoEncontrado: '#F5C242',
    statusNaoEncontradoMuted: '#3A330F',
    statusInvalido: '#FF6B6B',
    statusInvalidoMuted: '#3A1818',
    statusSemNcm: '#7C8696',
    statusSemNcmMuted: '#252A33',
  },
  font: {
    display: "'Space Grotesk', sans-serif",
    body: "'Inter', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 16,
  },
} as const;
