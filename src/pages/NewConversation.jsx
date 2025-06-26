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
import { getClientProvider } from '../firebase/providers';
import PaymentConfirmationModal from '../components/modals/PaymentConfirmationModal';

const NewConversation = () => {
  const { clientId: paramClientId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  // Función para determinar el tratamiento apropiado (Don/Doña)
  const getClientTreatment = (clientName) => {
    if (!clientName) return 'estimado cliente';
    
    // Lógica simple para determinar género - en producción esto debería ser un campo del cliente
    const commonFemaleNames = ['maria', 'ana', 'carmen', 'rosa', 'lucia', 'elena', 'patricia', 'laura', 'sandra', 'monica', 'claudia', 'alejandra', 'diana', 'beatriz', 'martha', 'gloria', 'adriana', 'paola', 'carolina', 'andrea', 'liliana', 'marcela', 'angela', 'catalina', 'esperanza'];
    const firstName = clientName.toLowerCase().split(' ')[0];
    
    if (commonFemaleNames.includes(firstName)) {
      return `Doña ${clientName.split(' ')[0]}`;
    } else {
      return `Don ${clientName.split(' ')[0]}`;
    }
  };
  
  // Función para obtener clientId de manera robusta
  const getClientId = () => {
    if (paramClientId) {
      return paramClientId;
    }
    
    // Fallback: extraer de la URL manualmente
    const hash = window.location.hash;
    const pathMatch = hash.match(/\/conversation\/new\/([^\/\?#]+)/);
    if (pathMatch && pathMatch[1]) {
      return pathMatch[1];
    }
    
    return null;
  };
  
  const clientId = getClientId();
  
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
  const [error, setError] = useState('');
  const [suggestedDeltas, setSuggestedDeltas] = useState({
    relationship: 0,
    history: 0,
    attitude: 0,
    sensitivity: 0,
    probability: 0
  });
  
  // Estados para el modal de pago - NUEVO
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProcessed, setPaymentProcessed] = useState(false);
  
  const messageEndRef = useRef(null);
  
  useEffect(() => {
    const loadClientAndStartConversation = async () => {
      // Validación inicial: verificar que tenemos clientId y usuario
      if (!clientId) {
        setError('Error: No se pudo identificar el cliente desde la URL. Por favor, vuelva a la lista de clientes e intente nuevamente.');
        setIsLoading(false);
        return;
      }
      
      if (!currentUser) {
        setError('Error: Usuario no autenticado. Por favor, inicie sesión nuevamente.');
        setIsLoading(false);
        return;
      }
      
      try {
        setIsLoading(true);
        setError('');
        
        // PASO 1: Buscar y validar que el cliente existe en Firebase
        const clientData = await getClientById(clientId);
        
        if (!clientData) {
          setError(`Error: No se encontró el cliente con ID "${clientId}". Es posible que haya sido eliminado o que el enlace sea incorrecto.`);
          setIsLoading(false);
          return;
        }
        
        // Validar que el cliente tiene los datos mínimos necesarios
        if (!clientData.name || !clientData.soul) {
          setError('Error: Los datos del cliente están incompletos. Por favor, verifique la información del cliente.');
          setIsLoading(false);
          return;
        }
        
        // PASO 2: Establecer los datos del cliente en el estado
        setClient(clientData);
        setCurrentSoul(clientData.soul);
        
        // PASO 3: Crear la conversación en Firebase
        const newConversationId = await createConversation(clientId, currentUser.uid, clientData.soul);
        
        if (!newConversationId) {
          setError('Error: No se pudo crear la conversación. Por favor, intente nuevamente.');
          setIsLoading(false);
          return;
        }
        
        setConversationId(newConversationId);
        
        // PASO 4: Generar saludo inicial sugerido CON TRATAMIENTO FORMAL
        // const agentName = currentUser.displayName || currentUser.email?.split('@')[0] || 'el equipo';
        // const clientTreatment = getClientTreatment(clientData.name);
        
        // Saludo formal con Don/Doña y información de deuda
        // const greeting = `Buenos días ${clientTreatment}, le saluda ${agentName} de Acriventas. Me comunico con usted respecto a su deuda pendiente por valor de $${clientData.debt.toLocaleString('es-CO')} COP.`;

        // Se obtiene el proveedor del cliente, si no tiene proveedor se usa Acriventas
        const provider = await getClientProvider(clientData.provider_id);

        const greeting = `Buenos días señor@ ${clientData.name}, le saluda Juan Pablo de Danta Labs, la empresa que esta apoyando a ${provider.name ? provider.name : "Acriventas"} en la gestión de su cartera. ¿Cómo ha estado? `

        setInitialGreeting(greeting);
        setSuggestedResponse(greeting);
        
      } catch (error) {
        console.error('Error al iniciar conversación:', error);
        
        // Manejo específico de errores
        if (error.code === 'permission-denied') {
          setError('Error: No tiene permisos para acceder a este cliente o crear conversaciones.');
        } else if (error.code === 'not-found') {
          setError('Error: El cliente especificado no existe o ha sido eliminado.');
        } else if (error.message?.includes('Firebase')) {
          setError('Error de conexión con la base de datos. Por favor, verifique su conexión a internet e intente nuevamente.');
        } else {
          setError(`Error inesperado al iniciar la conversación: ${error.message || 'Error desconocido'}`);
        }
        
        // Limpiar estados en caso de error
        setClient(null);
        setCurrentSoul(null);
        setConversationId(null);
        
      } finally {
        setIsLoading(false);
      }
    };
    
    // Solo ejecutar si tenemos las dependencias necesarias
    if (clientId && currentUser) {
      loadClientAndStartConversation();
    }
  }, [clientId, currentUser]);
  
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  // Función para manejar confirmación de pago - NUEVO
  const handlePaymentConfirmed = async (paymentDetails) => {
    try {
      // Actualizar cliente localmente
      setClient(prevClient => ({
        ...prevClient,
        debt: paymentDetails.remainingDebt
      }));

      setPaymentProcessed(true);
      
      // Si el pago fue completo, avanzar automáticamente a despedida
      if (paymentDetails.remainingDebt === 0) {
        setCurrentPhase(CONVERSATION_PHASES.FAREWELL);
      }

      // Enviar mensaje automático de agradecimiento
      if (conversationId) {
        try {
          const clientTreatment = getClientTreatment(client.name);
          
          // Obtener el nombre de la empresa del cliente o usar Acriventas por defecto
          let companyName = 'Acriventas';
          if (client.provider_id) {
            try {
              const provider = await getClientProvider(client.provider_id);
              if (provider && provider.name) {
                companyName = provider.name;
              }
            } catch (error) {
              console.error('Error al obtener proveedor:', error);
              // Usar Acriventas como fallback
            }
          }
          
          const thanksMessage = `Buenos días ${clientTreatment}, le habla Juan Pablo de Danta Labs, la empresa que esta apoyando a ${companyName} en la gestión de su cartera. Hemos recibido su soporte de pago. Esperamos poder seguir atendiéndolo próximamente`;

          // Agregar el mensaje automáticamente a la conversación
          const newTurn = {
            id: `agent-thanks-${Date.now()}`,
            sender: 'agent',
            message: thanksMessage,
            phase: CONVERSATION_PHASES.PAYMENT_CONFIRMATION,
            timestamp: new Date(),
            event: 'payment_thanks'
          };
          
          setTurns(prevTurns => [...prevTurns, newTurn]);

          await addConversationTurn(conversationId, {
            sender: 'agent',
            message: thanksMessage,
            phase: CONVERSATION_PHASES.PAYMENT_CONFIRMATION,
            event: 'payment_thanks'
          });

        } catch (error) {
          console.error('Error al enviar mensaje de agradecimiento:', error);
          // No bloquear el proceso de pago por este error
        }
      }

      console.log('Pago procesado exitosamente:', paymentDetails);
      
    } catch (error) {
      console.error('Error al procesar confirmación de pago:', error);
    }
  };
  
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
    
    // Validar que tenemos todo lo necesario para analizar el mensaje
    if (!clientId || !currentSoul) {
      return;
    }
    
    if (message.trim().split(/\s+/).length > 3) {
      try {
        const analysis = await analyzeClientMessage(message, turns, currentSoul, clientId);
        setEventType(analysis.eventType);
        setSuggestedDeltas(analysis.deltas);
      } catch (error) {
        console.error('Error al analizar mensaje:', error);
        // No bloquear la interfaz por errores de análisis
        setEventType('neutral');
        setSuggestedDeltas({
          relationship: 0,
          history: 0,
          attitude: 0,
          sensitivity: 0,
          probability: 0
        });
      }
    }
  };
  
  const handleAddClientMessage = async () => {
    if (!clientMessage.trim() || isSending) return;
    
    // Validar que tenemos todo lo necesario
    if (!conversationId || !clientId || !currentSoul) {
      setError('Error: Datos de conversación incompletos. Por favor, recargue la página.');
      return;
    }
    
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
      
      const responseResult = await generateAgentResponse(
        turns,
        result.currentSoul,
        clientMessage,
        eventType,
        clientId
      );
      
      setSuggestedResponse(responseResult.responseText);
      
      // Limpiar formulario
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
      setError(`Error al procesar el mensaje: ${error.message || 'Error desconocido'}`);
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
      'confirms_payment': { relationship: 10, history: 20, attitude: 20, sensitivity: -10, probability: 30 },
      'asks_bank_info': { relationship: 8, history: 5, attitude: 15, sensitivity: -5, probability: 25 }
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
        <div className="text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3 mx-auto"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
          <p className="mt-4 text-gray-600">
            {!clientId ? 'Obteniendo información del cliente...' : 
             !client ? 'Validando cliente...' :
             !conversationId ? 'Creando conversación...' :
             'Preparando interfaz...'}
          </p>
        </div>
      </div>
    );
  }
  
  // Mostrar errores con opciones de recuperación
  if (error) {
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
                <h3 className="text-sm font-medium text-red-800">
                  Error al iniciar conversación
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button 
              className="btn-primary flex-1"
              onClick={() => {
                setError('');
                setIsLoading(true);
                // Recargar la página para reintentar
                window.location.reload();
              }}
            >
              Reintentar
            </button>
            <button 
              className="btn-secondary flex-1"
              onClick={() => navigate('/clients')}
            >
              Volver a Clientes
            </button>
          </div>
          
          {/* Debug info para desarrollo */}
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 p-3 bg-gray-100 rounded text-xs">
              <summary className="cursor-pointer font-medium">Debug Info (Solo desarrollo)</summary>
              <div className="mt-2 space-y-1">
                <div><strong>ClientId:</strong> {clientId || 'undefined'}</div>
                <div><strong>URL:</strong> {window.location.href}</div>
                <div><strong>Hash:</strong> {window.location.hash}</div>
                <div><strong>Usuario:</strong> {currentUser?.email || 'No autenticado'}</div>
              </div>
            </details>
          )}
        </div>
      </div>
    );
  }
  
  // Validación final antes de mostrar la interfaz
  if (!client || !conversationId || !currentSoul) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Advertencia:</strong>
          <span className="block sm:inline"> Los datos de la conversación no están completamente cargados.</span>
          <div className="mt-2">
            <button 
              className="btn-secondary mr-2"
              onClick={() => window.location.reload()}
            >
              Recargar
            </button>
            <button 
              className="btn-secondary"
              onClick={() => navigate('/clients')}
            >
              Volver a Clientes
            </button>
          </div>
        </div>
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
        <h1 className="text-2xl font-bold">Conversación con {getClientTreatment(client.name)}</h1>
        <div className="flex gap-2">
          {/* Botón de Confirmar Pago - NUEVO */}
          <button 
            className="btn-primary flex flex-row items-center justify-center gap-1"
            onClick={() => setShowPaymentModal(true)}
            disabled={!client}
          >
            <svg className="w-8 h-8 -mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
            Confirmar Pago
          </button>
          
          <button 
            className="btn-primary"
            onClick={finishConversation}
          >
            Finalizar Conversación
          </button>
        </div>
      </div>

      {/* Notificación de pago procesado - NUEVO */}
      {paymentProcessed && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">
              Pago procesado exitosamente. La deuda del cliente ha sido actualizada.
            </span>
            <button
              onClick={() => setPaymentProcessed(false)}
              className="ml-auto text-green-600 hover:text-green-800"
            >
              ×
            </button>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          {/* Mostrar errores durante la conversación */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4" role="alert">
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
                            <p className="whitespace-pre-line">{turn.message}</p>
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
                  {initialGreeting && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-600 mb-1">Saludo inicial sugerido:</p>
                      <p className="text-sm">{initialGreeting}</p>
                      <button
                        className="text-xs text-blue-600 mt-1 underline"
                        onClick={() => setMessage(initialGreeting)}
                      >
                        Usar este saludo
                      </button>
                    </div>
                  )}
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
                    <option value="asks_bank_info">Solicita información bancaria</option>
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
              <p><span className="font-medium">Nombre:</span> {client.name}</p>
              <p><span className="font-medium">Tratamiento:</span> {getClientTreatment(client.name)}</p>
              <p><span className="font-medium">Teléfono:</span> {client.phone}</p>
              <p><span className="font-medium">Email:</span> {client.email || 'No disponible'}</p>
              {/* Mostrar deuda actualizada después del pago - MODIFICADO */}
              <p><span className="font-medium">Deuda:</span> ${(client.debt || 0).toLocaleString('es-CO')} COP</p>
              
              {/* Info de debug en desarrollo */}
              {process.env.NODE_ENV === 'development' && (
                <details className="mt-3 p-2 bg-gray-50 rounded text-xs">
                  <summary className="cursor-pointer font-medium text-gray-600">Debug Info</summary>
                  <div className="mt-2 space-y-1 text-gray-500">
                    <div><strong>ClientId:</strong> {clientId}</div>
                    <div><strong>ConversationId:</strong> {conversationId}</div>
                    <div><strong>Alma presente:</strong> {currentSoul ? '✅' : '❌'}</div>
                    <div><strong>Usuario:</strong> {currentUser?.email}</div>
                    <div><strong>Turnos:</strong> {turns.length}</div>
                  </div>
                </details>
              )}
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

      {/* Modal de confirmación de pago - NUEVO */}
      <PaymentConfirmationModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        clientId={clientId}
        clientName={client?.name || 'Cliente'}
        currentDebt={client?.debt || 0}
        onPaymentConfirmed={handlePaymentConfirmed}
      />
    </div>
  );
};

export default NewConversation;