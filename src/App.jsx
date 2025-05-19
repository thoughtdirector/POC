import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Páginas
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ClientDetail from './pages/ClientDetail';
import ClientSearch from './pages/ClientSearch';
import NewClient from './pages/NewClient';
import SelectClientForConversation from './pages/SelectClientForConversation';
import ClientList from './pages/ClientList';
import NewConversation from './pages/NewConversation';
import ConversationDetail from './pages/ConversationDetail';
import AISettings from './pages/AISettings';
import Reports from './pages/Reports';


// Componentes de layout
import Layout from './components/layout/Layout';

// Ruta protegida
const PrivateRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div className="flex h-screen items-center justify-center">Cargando...</div>;
  }
  
  return currentUser ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="clients" element={<ClientList />} />
            <Route path="clients/:clientId" element={<ClientDetail />} />
            <Route path="clients/search" element={<ClientSearch />} />
            <Route path="clients/new" element={<NewClient />} />
            <Route path="conversation/new" element={<SelectClientForConversation />} />
            <Route path="conversation/new/:clientId" element={<NewConversation />} />
            <Route path="conversation/:conversationId" element={<ConversationDetail />} />
            <Route path="settings/ai" element={<AISettings />} />
            <Route path="reports" element={<Reports />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;