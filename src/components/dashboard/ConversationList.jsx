import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const ConversationList = ({ 
  title,
  conversations,
  isLoading,
  emptyMessage = "No hay conversaciones disponibles",
  showClientInfo = true 
}) => {
  const navigate = useNavigate();

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

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      
      {conversations.length === 0 ? (
        <p className="text-gray-500 text-center py-4">{emptyMessage}</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {conversations.map((conversation) => {
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
                  </span>
                  <span className="text-sm text-gray-500">{dateString}</span>
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