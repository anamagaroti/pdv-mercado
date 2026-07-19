import { Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CancelIcon from '@mui/icons-material/Cancel';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { StatusNcm } from '../../api';
import { tokens } from '../../theme/tokens';

const CONFIG: Record<
  StatusNcm,
  { label: string; icon: React.ReactElement; color: string; bg: string }
> = {
  valido: {
    label: 'Válido',
    icon: <CheckCircleIcon sx={{ fontSize: '14px !important' }} />,
    color: tokens.color.statusValido,
    bg: tokens.color.statusValidoMuted,
  },
  nao_encontrado: {
    label: 'Não encontrado',
    icon: <HelpOutlineIcon sx={{ fontSize: '14px !important' }} />,
    color: tokens.color.statusNaoEncontrado,
    bg: tokens.color.statusNaoEncontradoMuted,
  },
  invalido: {
    label: 'Inválido',
    icon: <CancelIcon sx={{ fontSize: '14px !important' }} />,
    color: tokens.color.statusInvalido,
    bg: tokens.color.statusInvalidoMuted,
  },
  sem_ncm: {
    label: 'Sem NCM',
    icon: <RemoveCircleOutlineIcon sx={{ fontSize: '14px !important' }} />,
    color: tokens.color.statusSemNcm,
    bg: tokens.color.statusSemNcmMuted,
  },
};

export default function StatusNcmChip({ status }: { status: StatusNcm }) {
  const { label, icon, color, bg } = CONFIG[status];
  return (
    <Chip
      size="small"
      icon={icon}
      label={label}
      sx={{
        bgcolor: bg,
        color,
        fontWeight: 600,
        fontSize: 11,
        height: 22,
        '& .MuiChip-icon': { color },
      }}
    />
  );
}
