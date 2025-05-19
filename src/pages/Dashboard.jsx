import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import ActionButtons from '../components/dashboard/ActionButtons';
import ConversationList from '../components/dashboard/ConversationList';
import ConversationFilter from '../components/dashboard/ConversationFilter';
import { 
  getNewConversations, 
  getActiveConversations, 
  getClosedConversations,
  getConversationsByNextActionDate
} from '../firebase/conversations';

const Dashboard = () => {
  const { currentUser } = useAuth();
  const [newConversations, setNewConversations] = useState([]);
  const [activeConversations, setActiveConversations] = useState([]);
  const [historicalConversations, setHistoricalConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newConversationsFilter, setNewConversationsFilter] = useState('newest');

  useEffect(() => {
    const fetchConversations = async () => {
      setIsLoading(true);
      try {
        // Cargar conversaciones según el filtro seleccionado
        let newConvs;
        if (newConversationsFilter === 'newest') {
          newConvs = await getNewConversations(currentUser.uid);
        } else {
          newConvs = await getConversationsByNextActionDate();
        }
        
        // Cargar conversaciones activas y cerradas
        const activeConvs = await getActiveConversations(currentUser.uid);
        const historicalConvs = await getClosedConversations(currentUser.uid);
        
        setNewConversations(newConvs);
        setActiveConversations(activeConvs);
        setHistoricalConversations(historicalConvs);
      } catch (error) {
        console.error('Error al cargar conversaciones:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConversations();
  }, [currentUser, newConversationsFilter]);

  const handleFilterChange = (filter) => {
    setNewConversationsFilter(filter);
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      
      {/* Botones de acción */}
      <ActionButtons />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          {/* Nuevas conversaciones con filtro */}
          <div className="mb-2">
            <h2 className="text-lg font-semibold">Nuevas Conversaciones</h2>
            <ConversationFilter onFilterChange={handleFilterChange} />
          </div>
          
          <ConversationList 
            title=""
            conversations={newConversations}
            isLoading={isLoading}
            emptyMessage="No hay nuevas conversaciones"
          />
          
          {/* Conversaciones activas */}
          <ConversationList 
            title="Conversaciones Activas"
            conversations={activeConversations}
            isLoading={isLoading}
            emptyMessage="No hay conversaciones activas"
          />
        </div>
        
        <div>
          {/* Historial de conversaciones */}
          <ConversationList 
            title="Historial de Conversaciones"
            conversations={historicalConversations}
            isLoading={isLoading}
            emptyMessage="No hay conversaciones en el historial"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;