import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getClientById, updateClient, updateClientDebt } from '../firebase/clients';
import { getConversationsByClient } from '../firebase/conversations';
import SoulVariablesEditor from '../components/clients/SoulVariablesEditor';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const ClientDetail = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  
  const [client, setClient] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedClient, setEditedClient] = useState(null);
  
  useEffect(() => {
    const loadClientData = async () => {
      try {
        setIsLoading(true);
        
        // Cargar datos del cliente
        const clientData = await getClientById(clientId);
        setClient(clientData);
        setEditedClient(clientData);
        
        // Cargar conversaciones recientes
        const recentConversations = await getConversationsByClient(clientId);
        setConversations(recentConversations);
      } catch (error) {
        console.error('Error al cargar datos del cliente:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadClientData();
  }, [clientId]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditedClient(prev => ({
      ...prev,
      [name]: name === 'debt' ? parseFloat(value) || 0 : value
    }));
  };
  
  const handleSoulChange = (newSoulValues) => {
    setEditedClient(prev => ({
      ...prev,
      soul: newSoulValues
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      
      // Actualizar datos básicos, incluyendo el alma
      await updateClient(clientId, {
        name: editedClient.name,
        email: editedClient.email,
        phone: editedClient.phone,
        notes: editedClient.notes,
        soul: editedClient.soul // Incluir el alma en la actualización
      });
      
      // Actualizar monto de deuda si cambió
      if (client.debt !== editedClient.debt) {
        await updateClientDebt(clientId, editedClient.debt);
      }
      
      // Actualizar el objeto cliente local
      setClient(editedClient);
      setIsEditing(false);
    } catch (error) {
      console.error('Error al actualizar cliente:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const startNewConversation = () => {
    navigate(`/conversation/new/${clientId}`);
  };
  
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp.seconds * 1000);
    return format(date, 'PPP', { locale: es });
  };
  
  if (isLoading && !client) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        </div>
      </div>
    );
  }
  
  if (!client) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> No se pudo encontrar el cliente.</span>
        </div>
        <button 
          className="btn-secondary mt-4"
          onClick={() => navigate(-1)}
        >
          Volver
        </button>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <button 
                className="btn-secondary"
                onClick={() => setIsEditing(true)}
              >
                Editar
              </button>
              <button 
                className="btn-primary"
                onClick={startNewConversation}
              >
                Nueva Conversación
              </button>
            </>
          ) : (
            <button 
              className="btn-secondary"
              onClick={() => {
                setEditedClient(client);
                setIsEditing(false);
              }}
            >
              Cancelar Edición
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {isEditing ? (
            <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="form-group">
                  <label htmlFor="name" className="label">Nombre completo</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    className="input"
                    value={editedClient.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="email" className="label">Email</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="input"
                    value={editedClient.email}
                    onChange={handleChange}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="phone" className="label">Teléfono</label>
                  <input
                    type="text"
                    id="phone"
                    name="phone"
                    className="input"
                    value={editedClient.phone}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="debt" className="label">Monto de deuda</label>
                  <input
                    type="number"
                    id="debt"
                    name="debt"
                    className="input"
                    value={editedClient.debt}
                    onChange={handleChange}
                    required
                  />
                </div>
                
                <div className="form-group md:col-span-2">
                  <label htmlFor="notes" className="label">Notas</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows="3"
                    className="input"
                    value={editedClient.notes}
                    onChange={handleChange}
                  ></textarea>
                </div>
              </div>
              
              {/* Editor de variables del alma */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-3">Variables del Alma</h3>
                <SoulVariablesEditor 
                  initialValues={editedClient.soul}
                  onChange={handleSoulChange}
                  readOnly={false}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Ajuste las variables de relación con el cliente según su conocimiento actual.
                </p>
              </div>
              
              <div className="flex justify-end mt-6">
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p>{client.email || 'No disponible'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Teléfono</h3>
                  <p>{client.phone || 'No disponible'}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Monto de deuda</h3>
                  <p className="text-xl font-semibold text-red-600">
                    ${client.debt.toLocaleString('es-CO')}
                  </p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Último contacto</h3>
                  <p>{client.lastContact ? formatDate(client.lastContact) : 'Sin contacto reciente'}</p>
                </div>
                
                {client.notes && (
                  <div className="md:col-span-2 mt-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Notas</h3>
                    <p className="text-gray-700 whitespace-pre-line">{client.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Historial de conversaciones */}
          <div className="bg-white rounded-lg shadow p-6 mt-6">
            <h2 className="text-lg font-semibold mb-4">Conversaciones Recientes</h2>
            
            {conversations.length === 0 ? (
              <p className="text-gray-500 text-center py-4">
                No hay conversaciones registradas con este cliente.
              </p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {conversations.map((conversation) => {
                  const startDate = conversation.startedAt ? 
                    format(new Date(conversation.startedAt.seconds * 1000), 'PPp', { locale: es }) : 
                    'Fecha desconocida';
                    
                  const lastTurn = conversation.turns && conversation.turns.length > 0 ?
                    conversation.turns[conversation.turns.length - 1] : null;
                  
                  return (
                    <li 
                      key={conversation.id} 
                      className="py-3 cursor-pointer hover:bg-gray-50"
                      onClick={() => navigate(`/conversation/${conversation.id}`)}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">Conversación del {startDate}</span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          conversation.status === 'closed' ? 'bg-green-100 text-green-800' : 
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {conversation.status === 'closed' ? 'Finalizada' : 'Activa'}
                        </span>
                      </div>
                      
                      {lastTurn && (
                        <p className="text-sm text-gray-600 mt-1 truncate">
                          <span className="font-medium">
                            {lastTurn.sender === 'agent' ? 'Agente: ' : 'Cliente: '}
                          </span>
                          {lastTurn.message}
                        </p>
                      )}
                      
                      {conversation.summary && (
                        <div className="mt-1 text-xs">
                          <span className="text-gray-500">Resultado: </span>
                          <span className="font-medium">{conversation.summary.result}</span>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            
            <div className="mt-4">
              <button 
                className="text-primary-600 text-sm font-medium hover:text-primary-800"
                onClick={() => navigate(`/client/${clientId}/conversations`)}
              >
                Ver todas las conversaciones
              </button>
            </div>
          </div>
        </div>
        
        <div>
          {/* Variables del alma */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Variables del Alma</h2>
            
            <SoulVariablesEditor 
              initialValues={isEditing ? editedClient.soul : client.soul} 
              onChange={isEditing ? handleSoulChange : null}
              readOnly={!isEditing}
            />
            
            <div className="mt-4 text-sm text-gray-500">
              <p>
                Estas variables representan la disposición y relación del cliente, 
                y se ajustan automáticamente durante las conversaciones.
              </p>
              <p className="mt-2">
                Para modificar estos valores, utilice el botón "Editar" en la parte superior.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientDetail;