import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  getConversationDetails, 
  closeConversation,
  addManualConversationTurn,
  editConversationTurn,
  deleteConversationTurn,
  deleteConversation,
  updateConversationStatus,
  CONVERSATION_PHASES,
  CONVERSATION_STATUS
} from '../firebase/conversations';
import { generateAgentResponse } from '../services/aiService';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import SoulVariablesEditor from '../components/clients/SoulVariablesEditor';
import PhaseSelector from '../components/conversations/PhaseSelector';

const ConversationDetail = () => {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  
  const [conversation, setConversation] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingTurn, setEditingTurn] = useState(null);
  const [suggestedResponse, setSuggestedResponse] = useState('');
  const [responseAdded, setResponseAdded] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(CONVERSATION_PHASES.NEGOTIATION);
  const [error, setError] = useState('');
  
  // Estados para agregar nuevos mensajes
  const [newMessage, setNewMessage] = useState({
    sender: 'agent',
    message: '',
    event: 'neutral',
    phase: CONVERSATION_PHASES.NEGOTIATION,
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
      if (!conversationId) {
        setError('Error: ID de conversación no válido.');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError('');
        
        const conversationData = await getConversationDetails(conversationId);
        
        if (!conversationData) {
          setError('Error: No se encontró la conversación especificada. Es posible que haya sido eliminada.');
          setIsLoading(false);
          return;
        }
        
        // Validar que la conversación tiene los datos mínimos necesarios
        if (!conversationData.clientId || !conversationData.clientName) {
          setError('Error: Los datos de la conversación están incompletos.');
          setIsLoading(false);
          return;
        }
        
        setConversation(conversationData);
        
        // Si ya tiene resumen, cargar los datos
        if (conversationData.summary) {
          setSummary(conversationData.summary);
        }
        
        // Determinar la fase actual basada en el último mensaje
        if (conversationData.turns && conversationData.turns.length > 0) {
          const lastTurn = conversationData.turns[conversationData.turns.length - 1];
          if (lastTurn.phase) {
            setCurrentPhase(lastTurn.phase);
            setNewMessage(prev => ({
              ...prev,
              phase: lastTurn.phase
            }));
          }
        }
      } catch (error) {
        console.error('Error al cargar conversación:', error);
        
        if (error.code === 'permission-denied') {
          setError('Error: No tiene permisos para acceder a esta conversación.');
        } else if (error.code === 'not-found') {
          setError('Error: La conversación especificada no existe o ha sido eliminada.');
        } else if (error.message?.includes('Firebase')) {
          setError('Error de conexión con la base de datos. Por favor, verifique su conexión a internet.');
        } else {
          setError(`Error al cargar la conversación: ${error.message || 'Error desconocido'}`);
        }
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
    if (!conversation) return;
    
    try {
      setIsClosing(true);
      await closeConversation(conversationId, summary);
      
      // Recargar la conversación para mostrar el resumen
      const updatedConversation = await getConversationDetails(conversationId);
      setConversation(updatedConversation);
      
      setIsClosing(false);
    } catch (error) {
      console.error('Error al cerrar conversación:', error);
      setError(`Error al cerrar la conversación: ${error.message || 'Error desconocido'}`);
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
  
  const handlePhaseChange = (phase) => {
    setCurrentPhase(phase);
    setNewMessage(prev => ({
      ...prev,
      phase
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
  
  // Añadir un nuevo mensaje a la conversación
  const handleAddMessage = async () => {
    if (!newMessage.message.trim() || !conversation) return;
    
    try {
      const turnData = {
        sender: newMessage.sender,
        message: newMessage.message,
        event: newMessage.event,
        phase: newMessage.phase || currentPhase,
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
        phase: currentPhase,
        deltas: { relationship: 0, history: 0, attitude: 0, sensitivity: 0, probability: 0 },
        updateClientSoul: false
      });
      
      // Si se añade un mensaje del cliente, generar una sugerencia de respuesta
      if (turnData.sender === 'client' && updatedConversation.isActive && conversation.clientId) {
        try {
          const responseResult = await generateAgentResponse(
            updatedConversation.turns,
            updatedConversation.currentSoul,
            turnData.message,
            turnData.event,
            conversation.clientId
          );
          
          setSuggestedResponse(responseResult.responseText);
          setResponseAdded(true);
        } catch (error) {
          console.error('Error al generar sugerencia de respuesta:', error);
        }
      }
    } catch (error) {
      console.error('Error al agregar mensaje:', error);
      setError(`Error al agregar el mensaje: ${error.message || 'Error desconocido'}`);
    }
  };
  
  // Generar sugerencias cuando se cambia un evento
  const handleEventChange = async (newEvent) => {
    // Solo generar sugerencias si la conversación está activa y tenemos clientId
    if (conversation && conversation.isActive && conversation.clientId) {
      try {
        // Obtener el último mensaje del cliente (o el mensaje que se está editando)
        const clientMessage = editingTurn 
          ? editingTurn.message 
          : conversation.turns.find(t => t.sender === 'client')?.message || "Mensaje del cliente";
        
        const responseResult = await generateAgentResponse(
          conversation.turns,
          conversation.currentSoul,
          clientMessage,
          newEvent,
          conversation.clientId
        );
        
        setSuggestedResponse(responseResult.responseText);
        setResponseAdded(true);
      } catch (error) {
        console.error('Error al generar sugerencia:', error);
      }
    }
  };
  
  // Editar un turno existente
  const handleEditTurn = async (turnId, updatedData) => {
    if (!conversation) return;
    
    try {
      await editConversationTurn(conversationId, turnId, updatedData);
      
      // Recargar la conversación
      const updatedConversation = await getConversationDetails(conversationId);
      setConversation(updatedConversation);
      
      // Si se editó un mensaje del cliente, generar una sugerencia de respuesta
      if (editingTurn.sender === 'client' && conversation.isActive && conversation.clientId) {
        try {
          const responseResult = await generateAgentResponse(
            updatedConversation.turns,
            updatedConversation.currentSoul,
            updatedData.message,
            updatedData.event,
            conversation.clientId
          );
          
          setSuggestedResponse(responseResult.responseText);
          setResponseAdded(true);
        } catch (error) {
          console.error('Error al generar sugerencia de respuesta:', error);
        }
      }
      
      setEditingTurn(null);
    } catch (error) {
      console.error('Error al editar mensaje:', error);
      setError(`Error al editar el mensaje: ${error.message || 'Error desconocido'}`);
    }
  };
  
  // Eliminar un turno
  const handleDeleteTurn = async (turnId) => {
    if (!window.confirm('¿Está seguro de que desea eliminar este mensaje?')) return;
    
    try {
      await deleteConversationTurn(conversationId, turnId);
      
      // Recargar la conversación
      const updatedConversation = await getConversationDetails(conversationId);
      setConversation(updatedConversation);
    } catch (error) {
      console.error('Error al eliminar mensaje:', error);
      setError(`Error al eliminar el mensaje: ${error.message || 'Error desconocido'}`);
    }
  };
  
  // Eliminar conversación completa
  const handleDeleteConversation = async () => {
    if (!window.confirm('¿Está seguro que desea eliminar permanentemente esta conversación? Esta acción no se puede deshacer.')) return;
    
    try {
      await deleteConversation(conversationId);
      navigate('/');
    } catch (error) {
      console.error('Error al eliminar conversación:', error);
      setError(`Error al eliminar la conversación: ${error.message || 'Error desconocido'}`);
    }
  };
  
  // Cambiar estado de actividad
  const handleToggleActive = async () => {
    if (!conversation) return;
    
    try {
      if (conversation.isActive) {
        await updateConversationStatus(conversationId, CONVERSATION_STATUS.INACTIVE, false);
      } else {
        await updateConversationStatus(conversationId, CONVERSATION_STATUS.ACTIVE, true);
      }
      
      // Recargar la conversación
      const updatedConversation = await getConversationDetails(conversationId);
      setConversation(updatedConversation);
    } catch (error) {
      console.error('Error al cambiar estado de actividad:', error);
      setError(`Error al cambiar el estado: ${error.message || 'Error desconocido'}`);
    }
  };
  
  // Usar la respuesta sugerida
  const handleUseSuggestedResponse = () => {
    if (suggestedResponse) {
      setNewMessage(prev => ({
        ...prev,
        message: suggestedResponse,
        sender: 'agent'
      }));
      setSuggestedResponse('');
      setResponseAdded(false);
    }
  };
  
  // Continuar la conversación (botón explícito)
  const handleContinueConversation = () => {
    // Asegurarse de que la conversación esté activa
    if (conversation && !conversation.isActive) {
      handleToggleActive();
    }
    
    // Enfocar el campo de mensaje
    document.getElementById('message-input')?.focus();
  };
  
  // Formatear fechas
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
  
  // Estados de carga y error
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
          <p className="mt-4 text-gray-600">Cargando conversación...</p>
        </div>
      </div>
    );
  }
  
  if (error && !conversation) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="max-w-md mx-auto">
          <div className="bg-red-100 border border-red-400 text-red-700 px-6 py-4 rounded-lg shadow" role="alert">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error al cargar conversación</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button 
              className="btn-primary flex-1"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
            <button 
              className="btn-secondary flex-1"
              onClick={() => navigate('/')}
            >
              Volver al Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Agrupar mensajes por fases
  const getMessagesByPhase = () => {
    if (!conversation || !conversation.turns) return {};
    
    return conversation.turns.reduce((acc, turn) => {
      const phase = turn.phase || CONVERSATION_PHASES.NEGOTIATION;
      if (!acc[phase]) {
        acc[phase] = [];
      }
      acc[phase].push(turn);
      return acc;
    }, {});
  };
  
  // Ordenar las fases
  const orderedPhases = [
    CONVERSATION_PHASES.GREETING,
    CONVERSATION_PHASES.DEBT_NOTIFICATION,
    CONVERSATION_PHASES.NEGOTIATION,
    CONVERSATION_PHASES.PAYMENT_CONFIRMATION,
    CONVERSATION_PHASES.FAREWELL
  ];
  
  // Obtener nombre legible de fase
  const getPhaseName = (phase) => {
    switch (phase) {
      case CONVERSATION_PHASES.GREETING:
        return "Fase 1: Saludo";
      case CONVERSATION_PHASES.DEBT_NOTIFICATION:
        return "Fase 2: Comunicación de deuda";
      case CONVERSATION_PHASES.NEGOTIATION:
        return "Fase 3: Negociación";
      case CONVERSATION_PHASES.PAYMENT_CONFIRMATION:
        return "Fase 4: Concretar pago";
      case CONVERSATION_PHASES.FAREWELL:
        return "Fase 5: Despedida";
      default:
        return "Fase desconocida";
    }
  };
  
  const messagesByPhase = getMessagesByPhase();
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Conversación con {conversation.clientName}</h1>
          <p className="text-gray-500">
            Iniciada el {formatDate(conversation.startedAt)}
            <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
              conversation.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {conversation.isActive ? 'Activa' : 'Inactiva'}
            </span>
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Botón para editar conversación */}
          <button 
            className={`btn-secondary ${isEditing ? 'bg-blue-100 border-blue-300' : ''}`}
            onClick={() => setIsEditing(!isEditing)}
          >
            {isEditing ? 'Salir de Edición' : 'Editar Conversación'}
          </button>
          
          {/* Botón para activar/desactivar conversación */}
          <button 
            className={`btn-secondary ${conversation.isActive ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}
            onClick={handleToggleActive}
          >
            {conversation.isActive ? 'Desactivar' : 'Activar'}
          </button>
          
          {/* Botón para continuar la conversación */}
          {!conversation.isActive && (
            <button 
              className="btn-secondary"
              onClick={handleContinueConversation}
            >
              Continuar Conversación
            </button>
          )}
          
          {/* Botón para cerrar la conversación - solo visible si está activa */}
          {conversation.status !== CONVERSATION_STATUS.CLOSED && (
            <button 
              className="btn-primary"
              onClick={() => setIsClosing(true)}
            >
              Finalizar Conversación
            </button>
          )}
          
          {/* Botón para eliminar conversación */}
          <button 
            className="btn-secondary bg-red-600 text-white hover:bg-red-700"
            onClick={handleDeleteConversation}
          >
            Eliminar
          </button>
          
          {/* Botón para volver */}
          <button 
            className="btn-secondary"
            onClick={() => navigate(-1)}
          >
            Volver
          </button>
        </div>
      </div>
      
      {/* Mostrar errores durante la conversación */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6" role="alert">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600"
              >
                <span className="sr-only">Cerrar</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Nota sobre edición */}
      {isEditing && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded mb-6">
          <h3 className="font-semibold mb-2">Modo de edición activo</h3>
          <p>
            Puede modificar mensajes y eventos existentes. Si la conversación está activa,
            se generarán sugerencias de respuesta automáticamente basadas en los cambios realizados.
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {/* Historial de mensajes por fases */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Mensajes por Fases</h2>
            
            {orderedPhases.map(phase => {
              const phaseTurns = messagesByPhase[phase] || [];
              if (phaseTurns.length === 0) return null;
              
              return (
                <div key={phase} className="mb-6">
                  <h3 className="text-md font-semibold mb-2 bg-gray-100 p-2 rounded">
                    {getPhaseName(phase)}
                  </h3>
                  
                  <div className="space-y-4">
                    {phaseTurns.map((turn) => (
                      <div 
                        key={turn.id}
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
                </div>
              );
            })}
            
            {(!conversation.turns || conversation.turns.length === 0) && (
              <p className="text-gray-500 text-center py-4">
                No hay mensajes en esta conversación.
              </p>
            )}
            
            {/* Mostrar respuesta sugerida basada en los cambios */}
            {suggestedResponse && (
              <div className={`mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md transition-all duration-300 ${responseAdded ? 'opacity-100' : 'opacity-0'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-blue-700 mb-1">Sugerencia de respuesta:</p>
                    <p className="text-sm text-blue-800">{suggestedResponse}</p>
                  </div>
                  <button 
                    className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                    onClick={handleUseSuggestedResponse}
                  >
                    Usar esta respuesta
                  </button>
                </div>
                <p className="text-xs text-blue-600 mt-2">
                  Esta sugerencia se generó automáticamente basada en el contexto y los cambios realizados.
                </p>
              </div>
            )}
            
            {/* Formulario para agregar nuevos mensajes (solo visible si la conversación está activa) */}
            {conversation.isActive && (
              <div className="mt-6 p-4 border-t border-gray-200">
                <h3 className="text-md font-semibold mb-3">Agregar Nuevo Mensaje</h3>
                
                <div className="space-y-4">
                  <PhaseSelector 
                    phase={currentPhase}
                    onChange={handlePhaseChange}
                  />
                  
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
                        <option value="asks_bank_info">Solicita información bancaria</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="message-input" className="block text-sm font-medium text-gray-700 mb-1">
                      Mensaje
                    </label>
                    <textarea
                      id="message-input"
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
            
            {/* Mensaje indicando que la conversación no está activa */}
            {!conversation.isActive && (
              <div className="mt-6 p-4 border-t border-gray-200">
                <div className="bg-gray-50 p-4 rounded-md text-center">
                  <p className="text-gray-600">
                    Esta conversación no está activa. Pulse "Activar" si desea añadir más mensajes.
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Resumen de conversación */}
          {conversation.status === CONVERSATION_STATUS.CLOSED && conversation.summary && (
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
                  <h3 className="text-sm font-medium text-gray-500 mb-2">Actual</h3>
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
    phase: turn.phase || CONVERSATION_PHASES.NEGOTIATION,
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
  
  const handlePhaseChange = (phase) => {
    setEditData(prev => ({
      ...prev,
      phase
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
          Fase
        </label>
        <select
          name="phase"
          className="w-full text-sm border border-gray-300 rounded px-2 py-1"
          value={editData.phase}
          onChange={(e) => handlePhaseChange(e.target.value)}
        >
          <option value={CONVERSATION_PHASES.GREETING}>Fase 1: Saludo</option>
          <option value={CONVERSATION_PHASES.DEBT_NOTIFICATION}>Fase 2: Comunicación de deuda</option>
          <option value={CONVERSATION_PHASES.NEGOTIATION}>Fase 3: Negociación</option>
          <option value={CONVERSATION_PHASES.PAYMENT_CONFIRMATION}>Fase 4: Concretar pago</option>
          <option value={CONVERSATION_PHASES.FAREWELL}>Fase 5: Despedida</option>
        </select>
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