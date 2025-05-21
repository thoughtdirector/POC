import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { deleteConversation } from '../../firebase/conversations';
import { useState } from 'react';

const ConversationList = ({ 
  title,
  conversations,
  isLoading,
  emptyMessage = "No hay conversaciones disponibles",
  showClientInfo = true,
  onConversationDeleted = null
}) => {
  const navigate = useNavigate();
  const [localConversations, setLocalConversations] = useState(conversations);

  const handleDeleteConversation = async (conversationId, e) => {
    e.stopPropagation(); // Evitar que se navegue a la conversación
    
    if (window.confirm('¿Está seguro que desea eliminar esta conversación? Esta acción es permanente y no se puede deshacer.')) {
      try {
        await deleteConversation(conversationId);
        
        // Actualizar la lista de conversaciones
        if (onConversationDeleted) {
          onConversationDeleted(conversationId);
        } else {
          setLocalConversations(prevConversations => 
            prevConversations.filter(conv => conv.id !== conversationId)
          );
        }
        
      } catch (error) {
        console.error('Error al eliminar conversación:', error);
        alert('Error al eliminar la conversación: ' + error.message);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h2 className="text-lg font-semibold mb-4">{title}</h2>
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Usar lista local si no se proporciona callback, de lo contrario usar props
  const displayConversations = onConversationDeleted ? conversations : localConversations;

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      
      {displayConversations.length === 0 ? (
        <p className="text-gray-500 text-center py-4">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {displayConversations.map((conversation) => {
            // Determinar el color basado en el último remitente
            const lastSender = conversation.turns && conversation.turns.length > 0 
              ? conversation.turns[conversation.turns.length - 1].sender 
              : null;
            
            const borderColor = lastSender === 'client' 
              ? 'border-l-4 border-green-500' 
              : 'border-l-4 border-gray-300';
            
            // Formatear la fecha
            const dateString = conversation.startedAt 
              ? formatDistanceToNow(new Date(conversation.startedAt.seconds * 1000), { addSuffix: true, locale: es })
              : 'Fecha desconocida';

            return (
              <li 
                key={conversation.id} 
                className={`p-3 hover:bg-gray-50 cursor-pointer ${borderColor}`}
                onClick={() => navigate(`/conversation/${conversation.id}`)}
              >
                <div className="flex justify-between">
                  <span className="font-medium">
                    {showClientInfo ? conversation.clientName || 'Cliente' : ''}
                    {conversation.isActive && 
                      <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
                        Activa
                      </span>
                    }
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">{dateString}</span>
                    <button 
                      className="text-red-500 hover:text-red-700"
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      title="Eliminar conversación"
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        className="h-4 w-4" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" 
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {conversation.turns && conversation.turns.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1 truncate">
                    {conversation.turns[conversation.turns.length - 1].message}
                  </p>
                )}
                
                {conversation.nextActionDate && (
                  <div className="mt-2 text-xs text-blue-600">
                    Próxima acción: {formatDistanceToNow(
                      new Date(conversation.nextActionDate.seconds * 1000), 
                      { addSuffix: true, locale: es }
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default ConversationList;