import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy,
  limit as firestoreLimit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import { v4 as uuidv4 } from 'uuid';
import { recordClientContact } from './clients';

// Fases de la conversación
export const CONVERSATION_PHASES = {
  GREETING: 'greeting',           // Fase 1 (Saludo)
  DEBT_NOTIFICATION: 'debt_notification', // Fase 2 (Comunicación de deuda)
  NEGOTIATION: 'negotiation',     // Fase 3 (Negociación)
  PAYMENT_CONFIRMATION: 'payment_confirmation', // Fase 4 (Concretar pago)
  FAREWELL: 'farewell'           // Fase 5 (Despedida)
};

// Estado de la conversación
export const CONVERSATION_STATUS = {
  NEW: 'new',
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  CLOSED: 'closed'
};

// Matriz de deltas según tipo de evento
export const EVENT_DELTAS = {
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

// Crear una nueva conversación
export const createConversation = async (clientId, agentId, initialSoulValues) => {
  // Obtener información del cliente para incluirla en la conversación
  const clientRef = doc(db, 'clients', clientId);
  const clientDoc = await getDoc(clientRef);
  
  if (!clientDoc.exists()) {
    throw new Error('Cliente no encontrado');
  }
  
  const client = clientDoc.data();
  
  // Registrar contacto en el cliente
  await recordClientContact(clientId);
  
  // Crear la conversación
  const newConversation = {
    clientId,
    clientName: client.name,
    agentId,
    startedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    status: CONVERSATION_STATUS.NEW,
    isActive: true,
    initialSoul: initialSoulValues || client.soul,
    currentSoul: initialSoulValues || client.soul,
    turns: [],
    nextActionDate: null,
    summary: null
  };
  
  const conversationRef = await addDoc(collection(db, 'conversations'), newConversation);
  return conversationRef.id;
};

// Añadir un turno a una conversación
export const addConversationTurn = async (conversationId, turnData) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  const conversation = conversationDoc.data();
  
  // Calcular las variables del alma actualizadas si hay un evento
  let currentSoul = { ...conversation.currentSoul };
  let deltas = { relationship: 0, history: 0, attitude: 0, sensitivity: 0, probability: 0 };
  
  if (turnData.event && turnData.event !== 'neutral') {
    deltas = EVENT_DELTAS[turnData.event] || deltas;
    
    // Clamping para mantener los valores entre 0-100
    const clamp = (value) => Math.min(Math.max(value, 0), 100);
    
    currentSoul = {
      relationship: clamp(currentSoul.relationship + (deltas.relationship || 0)),
      history: clamp(currentSoul.history + (deltas.history || 0)),
      attitude: clamp(currentSoul.attitude + (deltas.attitude || 0)),
      sensitivity: clamp(currentSoul.sensitivity + (deltas.sensitivity || 0)),
      probability: clamp(currentSoul.probability + (deltas.probability || 0))
    };
  }
  
  // Crear el nuevo turno con un timestamp JavaScript normal
  const now = new Date();
  const newTurn = { 
    id: uuidv4(),
    timestamp: now,
    timestampMillis: now.getTime(),
    ...turnData,
    phase: turnData.phase || CONVERSATION_PHASES.NEGOTIATION,
    deltas,
    currentSoul
  };
  
  // Añadir el turno a la conversación
  const turns = [...conversation.turns, newTurn];
  
  // Si la conversación es nueva, cambiarla a activa
  const status = conversation.status === CONVERSATION_STATUS.NEW ? 
    CONVERSATION_STATUS.ACTIVE : conversation.status;
  
  await updateDoc(conversationRef, { 
    turns,
    currentSoul,
    status,
    isActive: true,
    updatedAt: serverTimestamp()
  });
  
  // Si es el cliente quien habla, actualizar su alma en la colección de clientes
  if (turnData.sender === 'client' && turnData.event !== 'neutral') {
    const clientRef = doc(db, 'clients', conversation.clientId);
    await updateDoc(clientRef, { 
      soul: currentSoul,
      updatedAt: serverTimestamp()
    });
  }
  
  return { turns, currentSoul };
};

// Obtener una conversación por ID
export const getConversationById = async (conversationId) => {
  const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
  if (conversationDoc.exists()) {
    return { id: conversationDoc.id, ...conversationDoc.data() };
  }
  return null;
};

// Obtener conversaciones con más detalles
export const getConversationDetails = async (conversationId) => {
  const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
  
  if (!conversationDoc.exists()) {
    return null;
  }
  
  const conversation = { id: conversationDoc.id, ...conversationDoc.data() };
  
  // Obtener datos del cliente para la conversación
  if (conversation.clientId) {
    try {
      const clientDoc = await getDoc(doc(db, 'clients', conversation.clientId));
      if (clientDoc.exists()) {
        conversation.client = { id: clientDoc.id, ...clientDoc.data() };
      }
    } catch (error) {
      console.error('Error al cargar datos del cliente:', error);
    }
  }
  
  return conversation;
};

// Obtener conversaciones por cliente
export const getConversationsByClient = async (clientId, limitCount = 5) => {
  const q = query(
    collection(db, 'conversations'),
    where('clientId', '==', clientId),
    orderBy('startedAt', 'desc'),
    firestoreLimit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Cerrar una conversación con resumen
export const closeConversation = async (conversationId, summary) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  const conversation = conversationDoc.data();
  
  // Actualizar la conversación con el resumen y marcarla como cerrada
  await updateDoc(conversationRef, {
    status: CONVERSATION_STATUS.CLOSED,
    isActive: false,
    closedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    summary: {
      ...summary,
      createdAt: serverTimestamp()
    }
  });
  
  // Actualizar el alma del cliente con el estado final
  if (conversation.clientId) {
    const clientRef = doc(db, 'clients', conversation.clientId);
    await updateDoc(clientRef, {
      soul: conversation.currentSoul,
      updatedAt: serverTimestamp()
    });
  }
  
  return conversationId;
};

// Obtener conversaciones nuevas
export const getNewConversations = async (agentId = null, limitCount = 10) => {
  let q;
  
  if (agentId) {
    q = query(
      collection(db, 'conversations'),
      where('status', '==', CONVERSATION_STATUS.NEW),
      where('agentId', '==', agentId),
      orderBy('startedAt', 'desc'),
      firestoreLimit(limitCount)
    );
  } else {
    q = query(
      collection(db, 'conversations'),
      where('status', '==', CONVERSATION_STATUS.NEW),
      orderBy('startedAt', 'desc'),
      firestoreLimit(limitCount)
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Obtener conversaciones activas
export const getActiveConversations = async (agentId = null, limitCount = 10) => {
  let q;
  
  if (agentId) {
    q = query(
      collection(db, 'conversations'),
      where('status', '==', CONVERSATION_STATUS.ACTIVE),
      where('isActive', '==', true),
      where('agentId', '==', agentId),
      orderBy('startedAt', 'desc'),
      firestoreLimit(limitCount)
    );
  } else {
    q = query(
      collection(db, 'conversations'),
      where('status', '==', CONVERSATION_STATUS.ACTIVE),
      where('isActive', '==', true),
      orderBy('startedAt', 'desc'),
      firestoreLimit(limitCount)
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Obtener conversaciones activas por cliente
export const getActiveConversationsByClient = async (clientId) => {
  const q = query(
    collection(db, 'conversations'),
    where('clientId', '==', clientId),
    where('isActive', '==', true),
    where('status', 'in', [CONVERSATION_STATUS.NEW, CONVERSATION_STATUS.ACTIVE]),
    orderBy('updatedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Obtener historial de conversaciones (cerradas)
export const getClosedConversations = async (agentId = null, limitCount = 100) => {
  let q;
  
  if (agentId) {
    q = query(
      collection(db, 'conversations'),
      where('status', '==', CONVERSATION_STATUS.CLOSED),
      where('agentId', '==', agentId),
      orderBy('closedAt', 'desc'),
      firestoreLimit(limitCount)
    );
  } else {
    q = query(
      collection(db, 'conversations'),
      where('status', '==', CONVERSATION_STATUS.CLOSED),
      orderBy('closedAt', 'desc'),
      firestoreLimit(limitCount)
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Obtener conversaciones por fecha próxima
export const getConversationsByNextActionDate = async (limitCount = 10) => {
  const now = new Date();
  const q = query(
    collection(db, 'conversations'),
    where('status', '==', CONVERSATION_STATUS.ACTIVE),
    where('isActive', '==', true),
    where('nextActionDate', '>=', now),
    orderBy('nextActionDate', 'asc'),
    firestoreLimit(limitCount)
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

// Verificar si el último mensaje fue del cliente
export const getLastMessageSender = (conversation) => {
  if (!conversation.turns || conversation.turns.length === 0) {
    return null;
  }
  
  const lastTurn = conversation.turns[conversation.turns.length - 1];
  return lastTurn.sender;
};

// Función para actualizar valores del alma
export const updateConversationSoulValues = async (conversationId, soulValues) => {
  try {
    const conversationRef = doc(db, 'conversations', conversationId);
    const conversationDoc = await getDoc(conversationRef);
    
    if (!conversationDoc.exists()) {
      throw new Error('Conversación no encontrada');
    }
    
    const conversation = conversationDoc.data();
    
    // Actualizar la conversación
    await updateDoc(conversationRef, { 
      currentSoul: soulValues,
      updatedAt: serverTimestamp()
    });
    
    // Actualizar también el cliente
    if (conversation.clientId) {
      const clientRef = doc(db, 'clients', conversation.clientId);
      await updateDoc(clientRef, { 
        soul: soulValues,
        updatedAt: serverTimestamp()
      });
    }
    
    return soulValues;
  } catch (error) {
    console.error('Error al actualizar valores del alma:', error);
    throw error;
  }
};

// Eliminar una conversación (hard delete)
export const deleteConversation = async (conversationId) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  // Eliminar físicamente el documento
  await deleteDoc(conversationRef);
  
  return conversationId;
};

// Cambiar el estado de actividad de una conversación
export const updateConversationStatus = async (conversationId, newStatus, isActive = true) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  // Validar que sea un estado válido
  if (!Object.values(CONVERSATION_STATUS).includes(newStatus)) {
    throw new Error('Estado de conversación no válido');
  }
  
  await updateDoc(conversationRef, {
    status: newStatus,
    isActive: isActive,
    updatedAt: serverTimestamp()
  });
  
  return conversationId;
};

// Función para editar un turno existente
export const editConversationTurn = async (conversationId, turnId, updatedTurnData) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  const conversation = conversationDoc.data();
  
  // Encontrar y actualizar el turno
  const turns = conversation.turns.map(turn => {
    if (turn.id === turnId) {
      return {
        ...turn,
        ...updatedTurnData,
        phase: updatedTurnData.phase || turn.phase,
        isEdited: true,
        editedAt: new Date()
      };
    }
    return turn;
  });
  
  await updateDoc(conversationRef, { 
    turns,
    updatedAt: serverTimestamp()
  });
  
  return turns;
};

// Función para eliminar un turno
export const deleteConversationTurn = async (conversationId, turnId) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  const conversation = conversationDoc.data();
  
  // Filtrar el turno a eliminar
  const turns = conversation.turns.filter(turn => turn.id !== turnId);
  
  await updateDoc(conversationRef, { 
    turns,
    updatedAt: serverTimestamp()
  });
  
  return turns;
};

// Sugerir respuesta (preparado para integración con Gemini)
export const suggestResponse = async (conversationId, currentTurn) => {
  // En el futuro, aquí se integrará con la API de Gemini
  // Por ahora, devolvemos respuestas predefinidas basadas en el alma del cliente
  
  const conversationDoc = await getDoc(doc(db, 'conversations', conversationId));
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  const conversation = conversationDoc.data();
  const soul = conversation.currentSoul;
  
  // Decisión básica basada en el alma
  let tone = 'neutral';
  
  if (soul.relationship > 70) {
    if (soul.sensitivity > 70) {
      tone = 'friendly_no_pressure';
    } else {
      tone = 'friendly';
    }
  } else if (soul.relationship < 40) {
    if (soul.sensitivity < 40) {
      tone = 'formal_direct';
    } else {
      tone = 'formal_soft';
    }
  }
  
  // Respuestas predeterminadas según el tono
  const responses = {
    friendly_no_pressure: "Entiendo perfectamente su situación. Cuando pueda realizar el pago me avisa, ¿le parece bien?",
    friendly: "Agradezco su disposición. ¿Le parecería bien que coordinemos el pago para la fecha que mejor le convenga?",
    formal_direct: "Necesitamos que regularice su situación a la brevedad. ¿Podría indicarnos una fecha concreta de pago?",
    formal_soft: "Entendemos que pueden surgir inconvenientes. ¿Podría indicarnos cuándo le sería posible realizar el pago?",
    neutral: "¿Podría por favor indicarnos cuándo podríamos esperar el pago de su deuda?"
  };
  
  // En el futuro, esta lógica será reemplazada por la llamada a Gemini
  return {
    suggestedResponse: responses[tone],
    suggestedEvent: null, // Gemini también podría sugerir el evento más probable
    aiExplanation: `Sugerencia basada en: Relación ${soul.relationship}, Sensibilidad ${soul.sensitivity}`
  };
};

// Añadir un turno manual
export const addManualConversationTurn = async (conversationId, turnData) => {
  const conversationRef = doc(db, 'conversations', conversationId);
  const conversationDoc = await getDoc(conversationRef);
  
  if (!conversationDoc.exists()) {
    throw new Error('Conversación no encontrada');
  }
  
  const conversation = conversationDoc.data();
  
  // Para turnos manuales, no procesamos automáticamente los deltas
  // Solo usamos los deltas si se proporcionan explícitamente
  const deltas = turnData.deltas || { relationship: 0, history: 0, attitude: 0, sensitivity: 0, probability: 0 };
  
  // Si se proporcionan deltas, calcular el nuevo alma
  let currentSoul = { ...conversation.currentSoul };
  
  if (turnData.event && turnData.event !== 'neutral' && turnData.deltas) {
    // Clamping para mantener los valores entre 0-100
    const clamp = (value) => Math.min(Math.max(value, 0), 100);
    
    currentSoul = {
      relationship: clamp(currentSoul.relationship + (deltas.relationship || 0)),
      history: clamp(currentSoul.history + (deltas.history || 0)),
      attitude: clamp(currentSoul.attitude + (deltas.attitude || 0)),
      sensitivity: clamp(currentSoul.sensitivity + (deltas.sensitivity || 0)),
      probability: clamp(currentSoul.probability + (deltas.probability || 0))
    };
  }
  
  // Crear el nuevo turno
  const now = new Date();
  const newTurn = { 
    id: uuidv4(),
    timestamp: now,
    timestampMillis: now.getTime(),
    ...turnData,
    phase: turnData.phase || CONVERSATION_PHASES.NEGOTIATION,
    deltas,
    currentSoul,
    isManual: true
  };
  
  // Añadir el turno a la conversación
  const turns = [...conversation.turns, newTurn];
  
  await updateDoc(conversationRef, { 
    turns,
    currentSoul,
    updatedAt: serverTimestamp()
  });
  
  // No actualizamos el alma del cliente automáticamente en turnos manuales
  // Solo si se especifica explícitamente
  if (turnData.updateClientSoul && turnData.sender === 'client' && turnData.event !== 'neutral') {
    const clientRef = doc(db, 'clients', conversation.clientId);
    await updateDoc(clientRef, { 
      soul: currentSoul,
      updatedAt: serverTimestamp()
    });
  }
  
  return { turns, currentSoul };
};