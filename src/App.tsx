import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { SignupPage } from '@/pages/SignupPage';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { TranscricoesPage } from '@/pages/TranscricoesPage';
import { TranscricaoDetalhePage } from '@/pages/TranscricaoDetalhePage';
import { DocumentosPage } from '@/pages/DocumentosPage';
import { NovoDocumentoPage } from '@/pages/NovoDocumentoPage';
import { DocumentoDetalhePage } from '@/pages/DocumentoDetalhePage';
import { AssistenteIAPage } from '@/pages/AssistenteIAPage';
import { RelatoriosPage } from '@/pages/RelatoriosPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (session) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/transcricoes" element={<ProtectedRoute><TranscricoesPage /></ProtectedRoute>} />
      <Route path="/transcricoes/:id" element={<ProtectedRoute><TranscricaoDetalhePage /></ProtectedRoute>} />
      <Route path="/documentos" element={<ProtectedRoute><DocumentosPage /></ProtectedRoute>} />
      <Route path="/documentos/novo" element={<ProtectedRoute><NovoDocumentoPage /></ProtectedRoute>} />
      <Route path="/documentos/:id" element={<ProtectedRoute><DocumentoDetalhePage /></ProtectedRoute>} />
      <Route path="/assistente" element={<ProtectedRoute><AssistenteIAPage /></ProtectedRoute>} />
      <Route path="/relatorios" element={<ProtectedRoute><RelatoriosPage /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
