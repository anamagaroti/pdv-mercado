import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Tooltip,
} from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import ListAltIcon from '@mui/icons-material/ListAlt';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { tokens } from '../../theme/tokens';

const SIDEBAR_WIDTH = 220;
const SIDEBAR_COLLAPSED = 64;

const ROTAS = [
  { path: '/cadastro', label: 'Cadastro', icon: <QrCodeScannerIcon /> },
  { path: '/produtos', label: 'Produtos', icon: <ListAltIcon /> },
  { path: '/nfe', label: 'NF-e de Compra', icon: <ReceiptLongIcon /> },
  { path: '/ncm', label: 'Validar NCM', icon: <FactCheckIcon /> },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const sidebarWidth = expanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: tokens.color.bgBase }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: sidebarWidth,
          flexShrink: 0,
          transition: 'width 0.2s ease',
          '& .MuiDrawer-paper': {
            width: sidebarWidth,
            overflow: 'hidden',
            bgcolor: tokens.color.bgSurface,
            borderRight: `1px solid ${tokens.color.border}`,
            transition: 'width 0.2s ease',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
      >
        {/* Logo */}
        <Box
          onClick={() => setExpanded((e) => !e)}
          sx={{
            height: 56,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 2,
            cursor: 'pointer',
            flexShrink: 0,
            '&:hover': { bgcolor: tokens.color.bgSurfaceRaised },
          }}
        >
          <ShoppingCartIcon sx={{ color: tokens.color.scan, fontSize: 22, flexShrink: 0 }} />
          {expanded && (
            <Typography
              sx={{
                fontFamily: tokens.font.display,
                fontWeight: 600,
                fontSize: 15,
                color: tokens.color.textPrimary,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              Cadastro
            </Typography>
          )}
        </Box>

        <Divider sx={{ borderColor: tokens.color.border }} />

        <List sx={{ flex: 1, py: 1, px: 0.5 }}>
          {ROTAS.map(({ path, label, icon }) => {
            const ativo = location.pathname.startsWith(path);
            return (
              <Tooltip key={path} title={!expanded ? label : ''} placement="right" arrow>
                <ListItemButton
                  onClick={() => navigate(path)}
                  selected={ativo}
                  sx={{
                    borderRadius: tokens.radius.sm + 'px',
                    mb: 0.5,
                    minHeight: 40,
                    px: expanded ? 1.5 : 1,
                    gap: 1.5,
                    '&.Mui-selected': {
                      bgcolor: tokens.color.accentMuted,
                      '&:hover': { bgcolor: tokens.color.accentMuted },
                    },
                    '&:hover': { bgcolor: tokens.color.bgSurfaceRaised },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      color: ativo ? tokens.color.accent : tokens.color.textSecondary,
                    }}
                  >
                    {icon}
                  </ListItemIcon>
                  {expanded && (
                    <ListItemText
                      primary={label}
                      primaryTypographyProps={{
                        fontSize: 14,
                        fontWeight: ativo ? 600 : 400,
                        color: ativo ? tokens.color.textPrimary : tokens.color.textSecondary,
                        whiteSpace: 'nowrap',
                      }}
                    />
                  )}
                </ListItemButton>
              </Tooltip>
            );
          })}
        </List>
      </Drawer>

      {/* Conteúdo principal */}
      <Box
        component="main"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
