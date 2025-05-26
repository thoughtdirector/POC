import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getClientById } from '../firebase/clients';
import { 
  createConversation, 
  addConversationTurn, 
  updateConversationSoulValues,
  CONVERSATION_PHASES 
} from '../firebase/conversations';
import { analyzeClientMessage, generateAgentResponse } from '../services/aiService';
import SoulVariablesEditor from '../components/clients/SoulVariablesEditor';
import PhaseSelector from '../components/conversations/PhaseSelector';

const NewConversation = () => {
  const { clientId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [client, setClient] = useState(null);
  const [conversationId, setConversationId] = useState(null);
  const [currentSoul, setCurrentSoul] = useState(null);
  const [turns, setTurns] = useState([]);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [suggestedResponse, setSuggestedResponse] = useState('');
  const [clientMessage, setClientMessage] = useState('');
  const [eventType, setEventType] = useState('neutral');
  const [initialGreeting, setInitialGreeting] = useState('');
  const [currentPhase, setCurrentPhase] = useState(CONVERSATION_PHASES.GREETING);
  const [suggestedDeltas, setSuggestedDeltas] = useState({
    relationship: 0,
    history: 0,
    attitude: 0,
    sensitivity: 0,
    probability: 0
  });
  
  const messageEndRef = useRef(null);
  
  useEffect(() => {
    const loadClientAndStartConversation = async () => {
      try {
        setIsLoading(true);
        
        const clientData = await getClientById(clientId);
        setClient(clientData);
        setCurrentSoul(clientData.soul);
        
        const newConversationId = await createConversation(clientId, currentUser.uid, clientData.soul);
        setConversationId(newConversationId);
        
        // Crear sugerencia de saludo inicial pero no enviarlo automáticamente
        const greeting = `Hola ${clientData.name}, le saluda ${currentUser.displayName} de Acriventas. Me comunico con usted respecto a su deuda pendiente.`;
        setInitialGreeting(greeting);
        setSuggestedResponse(greeting);
        
      } catch (error) {
        console.error('Error al iniciar conversación:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadClientAndStartConversation();
  }, [clientId, currentUser]);
  
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);
  
  const handleSendAgentMessage = async () => {
    if (!message.trim() || isSending) return;
    
    try {
      setIsSending(true);
      
      const newTurn = {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        message,
        phase: currentPhase,
        timestamp: new Date()
      };
      
      setTurns(prevTurns => [...prevTurns, newTurn]);
      
      await addConversationTurn(conversationId, {
        sender: 'agent',
        message,
        phase: currentPhase,
        event: 'neutral'
      });
      
      setMessage('');
      
      // Avanzar automáticamente a la siguiente fase si estamos en saludo
      if (currentPhase === CONVERSATION_PHASES.GREETING) {
        setCurrentPhase(CONVERSATION_PHASES.DEBT_NOTIFICATION);
      }
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  const handleClientMessageChange = async (e) => {
    const message = e.target.value;
    setClientMessage(message);
    
    if (message.trim().split(/\s+/).length > 3) {
      try {
        // CORREGIDO: Pasar clientId como parámetro
        const analysis = await analyzeClientMessage(message, turns, currentSoul, clientId);
        setEventType(analysis.eventType);
        setSuggestedDeltas(analysis.deltas);
      } catch (error) {
        console.error('Error al analizar mensaje:', error);
      }
    }
  };
  
  const handleAddClientMessage = async () => {
    if (!clientMessage.trim() || isSending) return;
    
    try {
      setIsSending(true);
      
      const newTurn = {
        id: `client-${Date.now()}`,
        sender: 'client',
        message: clientMessage,
        phase: currentPhase,
        timestamp: new Date(),
        event: eventType
      };
      
      setTurns(prevTurns => [...prevTurns, newTurn]);
      
      const result = await addConversationTurn(conversationId, {
        sender: 'client',
        message: clientMessage,
        phase: currentPhase,
        event: eventType
      });
      
      setCurrentSoul(result.currentSoul);
      
      // CORREGIDO: Pasar clientId como parámetro
      const responseResult = await generateAgentResponse(
        turns,
        result.currentSoul,
        clientMessage,
        eventType,
        clientId
      );
      
      setSuggestedResponse(responseResult.responseText);
      
      setClientMessage('');
      setEventType('neutral');
      setSuggestedDeltas({
        relationship: 0,
        history: 0,
        attitude: 0,
        sensitivity: 0,
        probability: 0
      });
      
      // Avanzar automáticamente de fase si el cliente acepta pagar
      if (eventType === 'accepts_payment' && currentPhase === CONVERSATION_PHASES.NEGOTIATION) {
        setCurrentPhase(CONVERSATION_PHASES.PAYMENT_CONFIRMATION);
      }
      
      // Avanzar automáticamente a despedida si confirma el pago
      if (eventType === 'confirms_payment' && currentPhase === CONVERSATION_PHASES.PAYMENT_CONFIRMATION) {
        setCurrentPhase(CONVERSATION_PHASES.FAREWELL);
      }
      
    } catch (error) {
      console.error('Error al agregar mensaje del cliente:', error);
    } finally {
      setIsSending(false);
    }
  };
  
  const handleEventTypeChange = (e) => {
    const newEventType = e.target.value;
    setEventType(newEventType);
    
    const EVENT_DELTAS = {
      'neutral': { relationship: 0, history: 0, attitude: 0, sensitivity: 0, probability: 0 },
      'accepts_payment': { relationship: 5, history: 10, attitude: 10, sensitivity: -5, probability: 20 },
      'offers_partial': { relationship: 5, history: 5, attitude: 10, sensitivity: -5, probability: 15 },
      'reschedule': { relationship: 2, history: -5, attitude: 5, sensitivity: 0, probability: -5 },
      'evades': { relationship: -5, history: -5, attitude: -10, sensitivity: 5, probability: -10 },
      'annoyed': { relationship: -10, history: -5, attitude: -15, sensitivity: 10, probability: -15 },
      'refuses': { relationship: -20, history: -20, attitude: -20, sensitivity: 20, probability: -30 },
      'thanks': { relationship: 5, history: 0, attitude: 10, sensitivity: -5, probability: 10 },
      'no_answer': { relationship: -5, history: -10, attitude: -5, sensitivity: 0, probability: -10 },
      'confirms_payment': { relationship: 10, history: 20, attitude: 20, sensitivity: -10, probability: 30 }
    };
    
    setSuggestedDeltas(EVENT_DELTAS[newEventType] || EVENT_DELTAS.neutral);
  };
  
  const handlePhaseChange = (phase) => {
    setCurrentPhase(phase);
  };
  
  const handleUseSuggestedResponse = () => {
    if (suggestedResponse) {
      setMessage(suggestedResponse);
      setSuggestedResponse('');
    }
  };
  
  const handleSoulChange = async (newValues) => {
    setCurrentSoul(newValues);
    try {
      await updateConversationSoulValues(conversationId, newValues);
    } catch (error) {
      console.error('Error al actualizar valores del alma:', error);
    }
  };
  
  const finishConversation = () => {
    navigate(`/conversation/${conversationId}`);
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
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
  
  // Agrupar los mensajes por fases
  const messagesByPhase = turns.reduce((acc, turn) => {
    const phase = turn.phase || CONVERSATION_PHASES.NEGOTIATION;
    if (!acc[phase]) {
      acc[phase] = [];
    }
    acc[phase].push(turn);
    return acc;
  }, {});
  
  // Obtener fases ordenadas
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
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold">Conversación con {client.name}</h1>
        <div>
          <button 
            className="btn-primary"
            onClick={finishConversation}
          >
            Finalizar Conversación
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {/* Mensajes de la conversación por fases */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="h-96 overflow-y-auto mb-4">
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
                          className={`mb-4 ${
                            turn.sender === 'agent' 
                              ? 'text-right' 
                              : 'text-left'
                          }`}
                        >
                          <div 
                            className={`inline-block rounded-lg px-4 py-2 max-w-[80%] ${
                              turn.sender === 'agent' 
                                ? 'bg-primary-100 text-primary-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            <p>{turn.message}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {turn.timestamp.toLocaleTimeString()}
                            </p>
                          </div>
                          
                          {turn.event && turn.event !== 'neutral' && (
                            <div className="text-xs text-gray-500 mt-1">
                              Evento: {turn.event}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {turns.length === 0 && (
                <div className="text-center p-4">
                  <p className="text-gray-500">No hay mensajes aún. Comience la conversación.</p>
                </div>
              )}
              
              <div ref={messageEndRef} />
            </div>
            
            {/* Formulario de mensaje del agente */}
            <div className="mb-4">
              <PhaseSelector 
                phase={currentPhase}
                onChange={handlePhaseChange}
              />
              
              <label className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                Mensaje del Agente
              </label>
              <div className="flex">
                <input
                  type="text"
                  className="input flex-grow"
                  placeholder="Escriba su mensaje..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <button
                  className="btn-primary ml-2"
                  onClick={handleSendAgentMessage}
                  disabled={isSending || !message.trim()}
                >
                  Enviar
                </button>
              </div>
              
              {suggestedResponse && (
                <div className="mt-2 p-2 bg-blue-50 rounded-md">
                  <p className="text-sm text-blue-600 mb-1">Respuesta sugerida:</p>
                  <p className="text-sm">{suggestedResponse}</p>
                  <button
                    className="text-xs text-blue-600 mt-1 underline"
                    onClick={handleUseSuggestedResponse}
                  >
                    Usar esta respuesta
                  </button>
                </div>
              )}
            </div>
            
            {/* Formulario de mensaje del cliente */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mensaje del Cliente
              </label>
              <textarea
                className="input w-full mb-2"
                rows="3"
                placeholder="Escriba lo que dijo el cliente..."
                value={clientMessage}
                onChange={handleClientMessageChange}
              ></textarea>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tipo de Evento
                  </label>
                  <select
                    className="input w-full"
                    value={eventType}
                    onChange={handleEventTypeChange}
                  >
                    <option value="neutral">Evento Neutro</option>
                    <option value="accepts_payment">Acepta pagar en fecha acordada</option>
                    <option value="offers_partial">Ofrece pago parcial</option>
                    <option value="reschedule">Propone nueva fecha</option>
                    <option value="evades">Evade o no da respuesta clara</option>
                    <option value="annoyed">Se muestra molesto</option>
                    <option value="refuses">Se niega a pagar</option>
                    <option value="thanks">Agradece recordatorio</option>
                    <option value="no_answer">No contesta la llamada</option>
                    <option value="confirms_payment">Confirma pago realizado</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Modificaciones Sugeridas
                  </label>
                  <div className="text-sm">
                    <p>Relación: {suggestedDeltas.relationship > 0 ? '+' : ''}{suggestedDeltas.relationship}</p>
                    <p>Historial: {suggestedDeltas.history > 0 ? '+' : ''}{suggestedDeltas.history}</p>
                    <p>Actitud: {suggestedDeltas.attitude > 0 ? '+' : ''}{suggestedDeltas.attitude}</p>
                    <p>Sensibilidad: {suggestedDeltas.sensitivity > 0 ? '+' : ''}{suggestedDeltas.sensitivity}</p>
                    <p>Probabilidad: {suggestedDeltas.probability > 0 ? '+' : ''}{suggestedDeltas.probability}</p>
                  </div>
                </div>
              </div>
              
              <button
                className="btn-secondary w-full"
                onClick={handleAddClientMessage}
                disabled={isSending || !clientMessage.trim()}
              >
                Agregar Mensaje del Cliente
              </button>
            </div>
          </div>
        </div>
        
        <div>
          {/* Información del cliente y variables del alma */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <h2 className="text-lg font-semibold mb-4">Información del Cliente</h2>
            <div className="space-y-2">
              <p><span className="font-medium">Teléfono:</span> {client.phone}</p>
              <p><span className="font-medium">Email:</span> {client.email || 'No disponible'}</p>
              <p><span className="font-medium">Estado de deuda:</span> Deuda pendiente</p>
              <p className="text-sm text-gray-500 mt-2 italic">Nota: Por razones de privacidad, no se muestran montos específicos en este módulo.</p>
            </div>
          </div>
          
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Variables del Alma</h2>
            <SoulVariablesEditor
              initialValues={currentSoul}
              readOnly={false}
              onChange={handleSoulChange}
            />
            <p className="mt-3 text-xs text-gray-500">
              Puede ajustar manualmente las variables según su percepción de la conversación.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewConversation;