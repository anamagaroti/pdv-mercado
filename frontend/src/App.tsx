import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import CadastroPage from './pages/CadastroPage';
import ProdutosPage from './pages/ProdutosPage';
import ValidadorNcmPage from './pages/ValidadorNcmPage';

import NfePage from './pages/NfePage';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Navigate to="/cadastro" replace />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/produtos" element={<ProdutosPage />} />
        <Route path="/nfe" element={<NfePage />} />
        <Route path="/ncm" element={<ValidadorNcmPage />} />
      </Routes>
    </AppLayout>
  );
}
