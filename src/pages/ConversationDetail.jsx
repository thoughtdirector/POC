import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getConversationDetails, 
  closeConversation,
  addManualConversationTurn,
  editConversationTurn,
  deleteConversationTurn
} from '../firebase/conversations';
import { generateAgentResponse } from '../services/aiService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SoulVariablesEditor from '../components/clients/SoulVariablesEditor';

const ConversationDetail = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTurn, setEditingTurn] = useState(null);
  const [suggestedResponse, setSuggestedResponse] = useState('');
  
  // Estados para agregar nuevos mensajes
  const [newMessage, setNewMessage] = useState({
    sender: 'agent',
    message: '',
    event: 'neutral',
    deltas: { relationship: 0, history: 0, attitude: 0, sensitivity: 0, probability: 0 },
    updateClientSoul: false
  });
  
  const [summary, setSummary] = useState({
    result: 'pending',
    notes: '',
    nextActionDate: ''
  });
  
  useEffect(() => {
    const loadConversation = async () => {
      try {
        setIsLoading(true);
        const conversationData = await getConversationDetails(conversationId);
        setConversation(conversationData);
        
        // Si ya tiene resumen, cargar los datos
        if (conversationData.summary) {
          setSummary(conversationData.summary);
        }
      } catch (error) {
        console.error('Error al cargar conversación:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadConversation();
  }, [conversationId]);
  
  const handleSummaryChange = (e) => {
    const { name, value } = e.target;
    setSummary(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleCloseConversation = async () => {
    try {
      setIsClosing(true);
      await closeConversation(conversationId, summary);
      
      // Recargar la conversación para mostrar el resumen
      const updatedConversation = await getConversationDetails(conversationId);
      setConversation(updatedConversation);
      
      // Salir del modo de cierre
      setIsClosing(false);
    } catch (error) {
      console.error('Error al cerrar conversación:', error);
      setIsClosing(false);
    }
  };
  
  const handleNewMessageChange = (e) => {
    const { name, value } = e.target;
    setNewMessage(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleDeltaChange = (variable, value) => {
    setNewMessage(prev => ({
      ...prev,
      deltas: {
        ...prev.deltas,
        [variable]: parseInt(value, 10) || 0
      }
    }));
  };
  
  const handleAddMessage = async () => {
    if (!newMessage.message.trim()) return;
    
    try {
      const turnData = {
        sender: newMessage.sender,
        message: newMessage.message,
        event: newMessage.event,
        deltas: newMessage.deltas,
        updateClientSoul: newMessage.updateClientSoul
      };
      
      await addManualConversationTurn(conversationId, turnData);
      
      // Recargar la conversación
      const updatedConversation = await getConversationDetails(conversationId);
      setConversation(updatedConversation);
      
      // Limpiar el formulario
      setNewMessage({
        sender: 'agent',
        message: '',
        event: 'neutral',
        deltas: { relationship: 0, history: 0, attitude: 0, sensitivity: 0, probability: 0 },
        updateClientSoul: false
      });
    } catch (error) {
      console.error('Error al agregar mensaje:', error);
    }
  };
  
  const handleEventChange = async (newEvent) => {
    // Solo generar sugerencias si la conversación está activa
    if (conversation && conversation.status === 'active') {
      try {
        // Usar el servicio de IA para generar una respuesta
        const responseResult = await generateAgentResponse(
          conversation.turns,
          conversation.currentSoul,
          editingTurn ? editingTurn.message : "Mensaje del cliente", 
          newEvent
        );
        
        setSuggestedResponse(responseResult.responseText);
      } catch (error) {
        console.error('Error al generar sugerencia:', error);
      }
    }
  };
  
  const handleEditTurn = async (turnId, updatedData) => {
    try {
      await editConversationTurn(conversationId, turnId, updatedData);
      
      // Recargar la conversación
      const updatedConversation = await getConversationDetails(conversationId);
      setConversation(updatedConversation);
      
      setEditingTurn(null);
    } catch (error) {
      console.error('Error al editar mensaje:', error);
    }
  };
  
  const handleDeleteTurn = async (turnId) => {
    if (window.confirm('¿Está seguro de que desea eliminar este mensaje?')) {
      try {
        await deleteConversationTurn(conversationId, turnId);
        
        // Recargar la conversación
        const updatedConversation = await getConversationDetails(conversationId);
        setConversation(updatedConversation);
      } catch (error) {
        console.error('Error al eliminar mensaje:', error);
      }
    }
  };
  
  const handleUseSuggestedResponse = () => {
    if (suggestedResponse) {
      setNewMessage(prev => ({
        ...prev,
        message: suggestedResponse
      }));
      setSuggestedResponse('');
    }
  };
  
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Manejar tanto timestamps de Firestore como objetos Date
    if (timestamp.seconds) {
      const date = new Date(timestamp.seconds * 1000);
      return format(date, 'PPp', { locale: es });
    } else if (timestamp instanceof Date) {
      return format(timestamp, 'PPp', { locale: es });
    } else {
      // Intentar parsear como string de fecha
      const date = new Date(timestamp);
      return format(date, 'PPp', { locale: es });
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  if (!conversation) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> No se pudo encontrar la conversación.</span>
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
        <div>
          <h1 className="text-2xl font-bold">Conversación con {conversation.clientName}</h1>
          <p className="text-gray-500">
            Iniciada el {formatDate(conversation.startedAt)}
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Botón de editar conversación */}
          <button 
            className={`btn-secondary ${isEditing ? 'bg-blue-100 border-blue-300' : ''}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Salir de Edición' : 'Editar Conversación'}
          </button>
          
          {conversation.status === 'active' && (
            <button 
              className="btn-primary"
              onClick={() => setIsClosing(true)}
            >
              Cerrar Conversación
            </button>
          )}
          <button 
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            Volver
          </button>
        </div>
      </div>
      
      {isEditing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded mb-6">
          <h3 className="font-semibold mb-2">Nota sobre edición de conversaciones</h3>
          <p>
            En este modo de edición no se generan sugerencias de IA automáticamente. Para obtener sugerencias 
            de mensajes basadas en el contexto y el alma del cliente, utilice la conversación 
            activa en lugar de la edición. Sin embargo, si modifica el tipo de evento de un mensaje, 
            se generará una sugerencia basada en este cambio.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {/* Historial de mensajes */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Mensajes</h2>
            
            {conversation.turns && conversation.turns.length > 0 ? (
              <div className="space-y-4">
                {conversation.turns.map((turn, index) => (
                  <div 
                    key={turn.id || index}
                    className={`flex ${
                      turn.sender === 'agent' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div 
                      className={`rounded-lg px-4 py-2 max-w-[80%] relative ${
                        turn.sender === 'agent' 
                          ? 'bg-primary-100 text-primary-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {/* Botones de edición (solo en modo edición) */}
                      {isEditing && (
                        <div className="absolute top-1 right-1 flex gap-1">
                          <button
                            className="text-xs text-blue-600 hover:text-blue-800"
                            onClick={() => setEditingTurn(turn)}
                          >
                            ✏️
                          </button>
                          <button
                            className="text-xs text-red-600 hover:text-red-800"
                            onClick={() => handleDeleteTurn(turn.id)}
                          >
                            🗑️
                          </button>
                        </div>
                      )}
                      
                      {editingTurn && editingTurn.id === turn.id ? (
                        <EditTurnForm 
                          turn={turn}
                          onSave={(updatedData) => handleEditTurn(turn.id, updatedData)}
                          onCancel={() => setEditingTurn(null)}
                          onEventChange={handleEventChange}
                        />
                      ) : (
                        <>
                          <p>{turn.message}</p>
                          <div className="text-xs text-gray-500 mt-1 flex justify-between">
                            <span>{formatDate(turn.timestamp)}</span>
                            {turn.isManual && <span className="text-blue-500">Manual</span>}
                            {turn.isEdited && <span className="text-orange-500">Editado</span>}
                          </div>
                          
                          {turn.event && turn.event !== 'neutral' && (
                            <div className="mt-2 text-xs">
                              <span className="font-medium">Evento: </span>
                              <span>{turn.event}</span>
                              
                              {turn.deltas && (
                                <div className="mt-1 grid grid-cols-5 gap-1">
                                  <span className={`${turn.deltas.relationship > 0 ? 'text-green-600' : turn.deltas.relationship < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    R: {turn.deltas.relationship > 0 ? '+' : ''}{turn.deltas.relationship}
                                  </span>
                                  <span className={`${turn.deltas.history > 0 ? 'text-green-600' : turn.deltas.history < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    H: {turn.deltas.history > 0 ? '+' : ''}{turn.deltas.history}
                                  </span>
                                  <span className={`${turn.deltas.attitude > 0 ? 'text-green-600' : turn.deltas.attitude < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    A: {turn.deltas.attitude > 0 ? '+' : ''}{turn.deltas.attitude}
                                  </span>
                                  <span className={`${turn.deltas.sensitivity > 0 ? 'text-green-600' : turn.deltas.sensitivity < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    S: {turn.deltas.sensitivity > 0 ? '+' : ''}{turn.deltas.sensitivity}
                                  </span>
                                  <span className={`${turn.deltas.probability > 0 ? 'text-green-600' : turn.deltas.probability < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                    P: {turn.deltas.probability > 0 ? '+' : ''}{turn.deltas.probability}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">
                No hay mensajes en esta conversación.
              </p>
            )}
            
            {suggestedResponse && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
                <p className="text-sm font-medium text-blue-700 mb-1">Sugerencia de respuesta:</p>
                <p className="text-sm text-blue-800">{suggestedResponse}</p>
                <div className="flex justify-end mt-2">
                  <button 
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    onClick={handleUseSuggestedResponse}
                  >
                    Usar esta respuesta
                  </button>
                </div>
              </div>
            )}
            
            {/* Formulario para agregar nuevos mensajes (modo edición) */}
            {isEditing && (
              <div className="mt-6 p-4 border-t border-gray-200">
                <h3 className="text-md font-semibold mb-3">Agregar Nuevo Mensaje</h3>
                
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Emisor
                      </label>
                      <select
                        name="sender"
                        className="input w-full"
                        value={newMessage.sender}
                        onChange={handleNewMessageChange}
                      >
                        <option value="agent">Agente</option>
                        <option value="client">Cliente</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de Evento
                      </label>
                      <select
                        name="event"
                        className="input w-full"
                        value={newMessage.event}
                        onChange={handleNewMessageChange}
                      >
                        <option value="neutral">Evento Neutro</option>
                        <option value="accepts_payment">Acepta pagar</option>
                        <option value="offers_partial">Ofrece pago parcial</option>
                        <option value="reschedule">Propone nueva fecha</option>
                        <option value="evades">Evade</option>
                        <option value="annoyed">Se muestra molesto</option>
                        <option value="refuses">Se niega a pagar</option>
                        <option value="thanks">Agradece</option>
                        <option value="no_answer">No contesta</option>
                        <option value="confirms_payment">Confirma pago</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje
                    </label>
                    <textarea
                      name="message"
                      rows="3"
                      className="input w-full"
                      value={newMessage.message}
                      onChange={handleNewMessageChange}
                      placeholder="Escriba el mensaje..."
                    ></textarea>
                  </div>
                  
                  {newMessage.event !== 'neutral' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Deltas para Variables del Alma
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                          <div>
                            <label className="text-xs text-gray-500">Relación</label>
                            <input
                              type="number"
                              min="-100"
                              max="100"
                              className="input w-full text-sm"
                              value={newMessage.deltas.relationship}
                              onChange={(e) => handleDeltaChange('relationship', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Historial</label>
                            <input
                              type="number"
                              min="-100"
                              max="100"
                              className="input w-full text-sm"
                              value={newMessage.deltas.history}
                              onChange={(e) => handleDeltaChange('history', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Actitud</label>
                            <input
                              type="number"
                              min="-100"
                              max="100"
                              className="input w-full text-sm"
                              value={newMessage.deltas.attitude}
                              onChange={(e) => handleDeltaChange('attitude', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Sensibilidad</label>
                            <input
                              type="number"
                              min="-100"
                              max="100"
                              className="input w-full text-sm"
                              value={newMessage.deltas.sensitivity}
                              onChange={(e) => handleDeltaChange('sensitivity', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">Probabilidad</label>
                            <input
                              type="number"
                              min="-100"
                              max="100"
                              className="input w-full text-sm"
                              value={newMessage.deltas.probability}
                              onChange={(e) => handleDeltaChange('probability', e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="updateClientSoul"
                          checked={newMessage.updateClientSoul}
                          onChange={(e) => setNewMessage(prev => ({
                            ...prev,
                            updateClientSoul: e.target.checked
                          }))}
                          className="mr-2"
                        />
                        <label htmlFor="updateClientSoul" className="text-sm text-gray-700">
                          Actualizar alma del cliente en la base de datos
                        </label>
                      </div>
                    </>
                  )}
                  
                  <button
                    className="btn-primary"
                    onClick={handleAddMessage}
                    disabled={!newMessage.message.trim()}
                  >
                    Agregar Mensaje
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Resumen de conversación */}
          {conversation.status === 'closed' && conversation.summary && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Resumen de la Conversación</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Resultado</h3>
                  <p className="font-medium">
                    {conversation.summary.result === 'payment' && 'Pago realizado'}
                    {conversation.summary.result === 'partial_payment' && 'Pago parcial'}
                    {conversation.summary.result === 'promise' && 'Promesa de pago'}
                    {conversation.summary.result === 'no_payment' && 'Sin pago'}
                    {conversation.summary.result === 'pending' && 'Pendiente'}
                  </p>
                </div>
                
                {conversation.summary.nextActionDate && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500">Próxima acción</h3>
                    <p>{formatDate(conversation.summary.nextActionDate)}</p>
                  </div>
                )}
                
                {conversation.summary.notes && (
                  <div className="md:col-span-2">
                    <h3 className="text-sm font-medium text-gray-500">Notas</h3>
                    <p className="whitespace-pre-line">{conversation.summary.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Modal de cierre de conversación */}
          {isClosing && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
                <h2 className="text-xl font-bold mb-4">Cerrar Conversación</h2>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Resultado
                    </label>
                    <select
                      name="result"
                      className="input w-full"
                      value={summary.result}
                      onChange={handleSummaryChange}
                    >
                      <option value="payment">Pago realizado</option>
                      <option value="partial_payment">Pago parcial</option>
                      <option value="promise">Promesa de pago</option>
                      <option value="no_payment">Sin pago</option>
                      <option value="pending">Pendiente</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fecha de próxima acción
                    </label>
                    <input
                      type="date"
                      name="nextActionDate"
                      className="input w-full"
                      value={summary.nextActionDate}
                      onChange={handleSummaryChange}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Notas
                    </label>
                    <textarea
                      name="notes"
                      rows="4"
                      className="input w-full"
                      value={summary.notes}
                      onChange={handleSummaryChange}
                      placeholder="Resumen de la conversación, acuerdos, observaciones..."
                    ></textarea>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 mt-6">
                  <button 
                    className="btn-secondary"
                    onClick={() => setIsClosing(false)}
                  >
                    Cancelar
                  </button>
                  <button 
                    className="btn-primary"
                    onClick={handleCloseConversation}
                  >
                    Cerrar Conversación
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div>
          {/* Información del cliente */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Información del Cliente</h2>
            
            <p className="mb-2">
              <span className="font-medium">Nombre:</span> {conversation.clientName}
            </p>
            
            {conversation.client && (
              <>
                <p className="mb-2">
                  <span className="font-medium">Teléfono:</span> {conversation.client.phone}
                </p>
                <p className="mb-2">
                  <span className="font-medium">Email:</span> {conversation.client.email || 'No disponible'}
                </p>
                <p className="mb-2">
                  <span className="font-medium">Estado:</span> Deuda pendiente
                </p>
                <p className="text-sm text-gray-500 italic">Nota: Por privacidad, no se muestran montos específicos.</p>
                
                <div className="mt-4">
                  <button 
                    className="text-primary-600 text-sm font-medium hover:text-primary-800"
                    onClick={() => navigate(`/clients/${conversation.clientId}`)}
                  >
                    Ver perfil completo
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* Variables del alma */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Variables del Alma</h2>
            
            {conversation.initialSoul && conversation.currentSoul && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Inicial</h3>
                  <SoulVariablesEditor
                    initialValues={conversation.initialSoul}
                    readOnly={true}
                  />
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Final</h3>
                  <SoulVariablesEditor
                    initialValues={conversation.currentSoul}
                    readOnly={true}
                  />
                </div>
                
                {/* Cambios en las variables */}
                <div className="mt-4 p-3 bg-gray-50 rounded-md">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Cambios</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="font-medium">Relación:</span>{' '}
                      <span className={
                        conversation.currentSoul.relationship > conversation.initialSoul.relationship
                          ? 'text-green-600'
                          : conversation.currentSoul.relationship < conversation.initialSoul.relationship
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }>
                        {conversation.currentSoul.relationship - conversation.initialSoul.relationship > 0 ? '+' : ''}
                        {conversation.currentSoul.relationship - conversation.initialSoul.relationship}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Historial:</span>{' '}
                      <span className={
                        conversation.currentSoul.history > conversation.initialSoul.history
                          ? 'text-green-600'
                          : conversation.currentSoul.history < conversation.initialSoul.history
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }>
                        {conversation.currentSoul.history - conversation.initialSoul.history > 0 ? '+' : ''}
                        {conversation.currentSoul.history - conversation.initialSoul.history}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Actitud:</span>{' '}
                      <span className={
                        conversation.currentSoul.attitude > conversation.initialSoul.attitude
                          ? 'text-green-600'
                          : conversation.currentSoul.attitude < conversation.initialSoul.attitude
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }>
                        {conversation.currentSoul.attitude - conversation.initialSoul.attitude > 0 ? '+' : ''}
                        {conversation.currentSoul.attitude - conversation.initialSoul.attitude}
                      </span>
                    </div>
                    <div>
                      <span className="font-medium">Sensibilidad:</span>{' '}
                      <span className={
                        conversation.currentSoul.sensitivity < conversation.initialSoul.sensitivity
                          ? 'text-green-600'
                          : conversation.currentSoul.sensitivity > conversation.initialSoul.sensitivity
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }>
                        {conversation.currentSoul.sensitivity - conversation.initialSoul.sensitivity > 0 ? '+' : ''}
                        {conversation.currentSoul.sensitivity - conversation.initialSoul.sensitivity}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-medium">Probabilidad de pago:</span>{' '}
                      <span className={
                        conversation.currentSoul.probability > conversation.initialSoul.probability
                          ? 'text-green-600'
                          : conversation.currentSoul.probability < conversation.initialSoul.probability
                            ? 'text-red-600'
                            : 'text-gray-500'
                      }>
                        {conversation.currentSoul.probability - conversation.initialSoul.probability > 0 ? '+' : ''}
                        {conversation.currentSoul.probability - conversation.initialSoul.probability}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Componente para editar un turno existente
const EditTurnForm = ({ turn, onSave, onCancel, onEventChange }) => {
  const [editData, setEditData] = useState({
    message: turn.message,
    event: turn.event || 'neutral',
    deltas: turn.deltas || { relationship: 0, history: 0, attitude: 0, sensitivity: 0, probability: 0 }
  });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Si cambia el evento, notificar al componente padre
    if (name === 'event' && value !== editData.event) {
      onEventChange && onEventChange(value);
    }
    
    setEditData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleDeltaChange = (variable, value) => {
    setEditData(prev => ({
      ...prev,
      deltas: {
        ...prev.deltas,
        [variable]: parseInt(value, 10) || 0
      }
    }));
  };
  
  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(editData);
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Mensaje
        </label>
        <textarea
          name="message"
          rows="2"
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          value={editData.message}
          onChange={handleChange}
        ></textarea>
      </div>
      
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Evento
        </label>
        <select
          name="event"
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          value={editData.event}
          onChange={handleChange}
        >
          <option value="neutral">Neutral</option>
          <option value="accepts_payment">Acepta pagar</option>
          <option value="offers_partial">Pago parcial</option>
          <option value="reschedule">Nueva fecha</option>
          <option value="evades">Evade</option>
          <option value="annoyed">Molesto</option>
          <option value="refuses">Se niega</option>
          <option value="thanks">Agradece</option>
          <option value="no_answer">No contesta</option>
          <option value="confirms_payment">Confirma pago</option>
        </select>
      </div>
      
      {editData.event !== 'neutral' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Deltas
          </label>
          <div className="grid grid-cols-5 gap-1">
            <input
              type="number"
              min="-100"
              max="100"
              className="w-full text-xs border border-gray-300 rounded px-1 py-1"
              value={editData.deltas.relationship}
              onChange={(e) => handleDeltaChange('relationship', e.target.value)}
              placeholder="R"
            />
            <input
              type="number"
              min="-100"
              max="100"
              className="w-full text-xs border border-gray-300 rounded px-1 py-1"
              value={editData.deltas.history}
              onChange={(e) => handleDeltaChange('history', e.target.value)}
              placeholder="H"
            />
            <input
              type="number"
              min="-100"
              max="100"
              className="w-full text-xs border border-gray-300 rounded px-1 py-1"
              value={editData.deltas.attitude}
              onChange={(e) => handleDeltaChange('attitude', e.target.value)}
              placeholder="A"
            />
            <input
              type="number"
              min="-100"
              max="100"
              className="w-full text-xs border border-gray-300 rounded px-1 py-1"
              value={editData.deltas.sensitivity}
              onChange={(e) => handleDeltaChange('sensitivity', e.target.value)}
              placeholder="S"
            />
            <input
              type="number"
              min="-100"
              max="100"
              className="w-full text-xs border border-gray-300 rounded px-1 py-1"
              value={editData.deltas.probability}
              onChange={(e) => handleDeltaChange('probability', e.target.value)}
              placeholder="P"
            />
          </div>
        </div>
      )}
      
      <div className="flex gap-2">
        <button
          type="submit"
          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
};

export default ConversationDetail;