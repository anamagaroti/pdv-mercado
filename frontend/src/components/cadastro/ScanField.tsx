import { useEffect, useRef } from 'react';
import { Box, InputBase, Typography, CircularProgress } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import { tokens } from '../../theme/tokens';

interface ScanFieldProps {
  valor: string;
  onChange: (v: string) => void;
  onSubmit: (codigo: string) => void;
  carregando?: boolean;
  disabled?: boolean;
}

/**
 * Campo de leitura de código de barras — o elemento de assinatura visual
 * do sistema. Grande o suficiente para ser a âncora de toda a tela e
 * ganhar um brilho âmbar pulsante quando focado (simulando um leitor óptico).
 *
 * Fica sempre em foco: ao montar, ao concluir um cadastro e após cada
 * leitura, o foco volta automaticamente para cá, sem exigir clique do mouse.
 */
export default function ScanField({
  valor,
  onChange,
  onSubmit,
  carregando = false,
  disabled = false,
}: ScanFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Foco automático ao montar e ao concluir operações
  useEffect(() => {
    if (!disabled && !carregando) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [disabled, carregando]);

  // O leitor USB funciona como teclado: termina com Enter.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && valor.trim()) {
      onSubmit(valor.trim());
    }
  };

  return (
    <Box
      sx={{
        position: 'relative',
        bgcolor: tokens.color.bgSurfaceRaised,
        borderRadius: tokens.radius.lg + 'px',
        border: `2px solid ${tokens.color.border}`,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:focus-within': {
          borderColor: tokens.color.scan,
          boxShadow: `0 0 0 4px ${tokens.color.scanMuted}, 0 0 24px ${tokens.color.scan}28`,
          '@keyframes pulse': {
            '0%, 100%': { boxShadow: `0 0 0 4px ${tokens.color.scanMuted}, 0 0 24px ${tokens.color.scan}28` },
            '50%': { boxShadow: `0 0 0 6px ${tokens.color.scanMuted}, 0 0 36px ${tokens.color.scan}40` },
          },
          animation: 'pulse 2s ease-in-out infinite',
        },
        px: 3,
        py: 2.5,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      {carregando ? (
        <CircularProgress size={28} sx={{ color: tokens.color.scan, flexShrink: 0 }} />
      ) : (
        <QrCodeScannerIcon sx={{ fontSize: 28, color: tokens.color.scan, flexShrink: 0 }} />
      )}

      <Box sx={{ flex: 1 }}>
        <Typography
          variant="caption"
          sx={{
            color: tokens.color.textTertiary,
            fontFamily: tokens.font.mono,
            display: 'block',
            mb: 0.25,
            fontSize: 11,
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}
        >
          Código de barras
        </Typography>
        <InputBase
          inputRef={inputRef}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || carregando}
          placeholder="Bipear ou digitar código..."
          fullWidth
          sx={{
            fontFamily: tokens.font.mono,
            fontSize: 28,
            fontWeight: 400,
            color: tokens.color.textPrimary,
            letterSpacing: 2,
            '& input': { p: 0 },
            '& input::placeholder': { color: tokens.color.textTertiary, fontSize: 20 },
          }}
        />
      </Box>
    </Box>
  );
}
