// src/services/openaiService.js
import axios from 'axios';
import { getConversationsByClient, getClosedConversations } from '../firebase/conversations';
import { getAllClients, getClientById } from '../firebase/clients';
import { getClientProvider } from '../firebase/providers';

// Función para obtener la API key de localStorage
const getApiKey = () => localStorage.getItem('openai_api_key') || "";

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

// Función para obtener contexto de conversaciones previas del cliente
const getPreviousConversationContext = async (clientId) => {
  try {
    if (!clientId) {
      console.log("ClientId no válido para obtener contexto previo");
      return null;
    }

    const conversations = await getConversationsByClient(clientId, 3);
    if (conversations.length === 0) return null;
    
    let contextText = "=== HISTORIAL PREVIO CON ESTE CLIENTE ===\n";
    
    conversations.forEach((conv, index) => {
      if (conv.turns && conv.turns.length > 0) {
        contextText += `\n--- Conversación ${index + 1} ---\n`;
        
        const recentTurns = conv.turns.slice(-6);
        recentTurns.forEach(turn => {
          const sender = turn.sender === 'agent' ? 'Agente' : 'Cliente';
          contextText += `${sender}: ${turn.message}\n`;
        });
        
        if (conv.summary && conv.summary.result) {
          contextText += `Resultado: ${conv.summary.result}\n`;
          if (conv.summary.notes) {
            contextText += `Notas: ${conv.summary.notes}\n`;
          }
        }
      }
    });
    
    return contextText;
  } catch (error) {
    console.error('Error obteniendo contexto previo:', error);
    return null;
  }
};

// Función para buscar clientes similares y obtener su contexto conversacional
const getSimilarClientContext = async (clientSoul, clientDebt = 0) => {
  try {
    if (!clientSoul || typeof clientDebt !== 'number') {
      console.log("Datos insuficientes para obtener contexto de clientes similares");
      return null;
    }

    const allClients = await getAllClients();
    
    const targetDebt = clientDebt || 1000000;
    
    const debtRange = targetDebt * 0.3;
    const similarDebtClients = allClients.filter(client => 
      client.id !== clientSoul.id && 
      client.debt >= (targetDebt - debtRange) && 
      client.debt <= (targetDebt + debtRange)
    );
    
    if (similarDebtClients.length === 0) return null;
    
    const similarClients = similarDebtClients
      .map(client => {
        if (!client.soul) return null;
        
        const similarity = 
          Math.abs(client.soul.relationship - clientSoul.relationship) +
          Math.abs(client.soul.attitude - clientSoul.attitude) +
          Math.abs(client.soul.sensitivity - clientSoul.sensitivity) +
          Math.abs(client.soul.probability - clientSoul.probability);
        
        return { client, similarity };
      })
      .filter(item => item !== null)
      .sort((a, b) => a.similarity - b.similarity)
      .slice(0, 2);
    
    if (similarClients.length === 0) return null;
    
    let contextText = "=== CONTEXTO DE CLIENTES SIMILARES ===\n";
    contextText += `(Clientes con perfil similar: deuda parecida, características del alma similares)\n\n`;
    
    for (const { client } of similarClients) {
      const conversations = await getConversationsByClient(client.id, 2);
      
      if (conversations.length > 0) {
        contextText += `--- Estilo conversacional de cliente similar ---\n`;
        contextText += `Perfil del alma: R:${client.soul.relationship} A:${client.soul.attitude} S:${client.soul.sensitivity} P:${client.soul.probability}\n`;
        
        conversations.forEach(conv => {
          if (conv.turns && conv.turns.length > 0) {
            const sampleTurns = conv.turns.slice(-4);
            sampleTurns.forEach(turn => {
              const sender = turn.sender === 'agent' ? 'Agente' : 'Cliente';
              contextText += `${sender}: ${turn.message}\n`;
            });
            
            if (conv.summary) {
              contextText += `Resultado: ${conv.summary.result}\n`;
            }
            contextText += "\n";
          }
        });
      }
    }
    
    return contextText;
  } catch (error) {
    console.error('Error obteniendo contexto de clientes similares:', error);
    return null;
  }
};

// Construir prompt contextual mejorado - AÑADIMOS clientId como parámetro
const buildContextualPrompt = async (clientId, clientSoul, conversationHistory, isAnalysis = false) => {
  if (!clientId) {
    return {
      contextSection: "=== SIN CONTEXTO PREVIO ===\nEsta es la primera interacción registrada.\n",
      currentConversation: "",
      currentPhase: 'greeting',
      phaseDescription: "FASE 1 - SALUDO: Establecer contacto inicial, identificarse y crear rapport usando tratamiento formal",
      clientInfo: null
    };
  }

  // Obtener información del cliente
  let clientInfo = null;
  try {
    clientInfo = await getClientById(clientId);
  } catch (error) {
    console.error('Error obteniendo información del cliente:', error);
  }

  const providerInfo = await getClientProvider(clientInfo?.provider_id);

  const previousContext = await getPreviousConversationContext(clientId);
  const similarContext = previousContext ? null : await getSimilarClientContext(clientSoul, clientInfo?.debt || 0);
  
  let contextSection = "";
  
  if (previousContext) {
    contextSection = previousContext;
  } else if (similarContext) {
    contextSection = similarContext;
  } else {
    contextSection = "=== SIN CONTEXTO PREVIO ===\nEsta es la primera interacción registrada con este tipo de perfil.\n";
  }
  
  let currentConversation = "";
  if (conversationHistory && conversationHistory.length > 0) {
    currentConversation = "\n=== CONVERSACIÓN ACTUAL ===\n";
    conversationHistory.slice(-8).forEach(turn => {
      const sender = turn.sender === 'agent' ? 'Agente' : 'Cliente';
      currentConversation += `${sender}: ${turn.message}\n`;
      if (turn.event && turn.event !== 'neutral') {
        currentConversation += `[Evento detectado: ${turn.event}]\n`;
      }
    });
  }
  
  const currentPhase = conversationHistory && conversationHistory.length > 0 
    ? conversationHistory[conversationHistory.length - 1].phase || 'negotiation'
    : 'greeting';
  
  const phaseDescription = {
    greeting: "FASE 1 - SALUDO: Establecer contacto inicial, identificarse y crear rapport usando tratamiento formal",
    debt_notification: "FASE 2 - COMUNICACIÓN DE DEUDA: Informar sobre la deuda pendiente de manera clara, usando montos específicos si el cliente pregunta",
    negotiation: "FASE 3 - NEGOCIACIÓN: Buscar acuerdo de pago, manejar objeciones con respeto",
    payment_confirmation: "FASE 4 - CONCRETAR PAGO: Facilitar los datos de pago y confirmar compromisos",
    farewell: "FASE 5 - DESPEDIDA: Cerrar la conversación de manera cordial y profesional"
  };
  
  return {
    contextSection,
    currentConversation,
    currentPhase,
    phaseDescription: phaseDescription[currentPhase] || phaseDescription.negotiation,
    clientInfo,
    providerInfo
  };
};

// Detección de eventos y sugerencia de deltas - MODIFICAMOS para recibir clientId
export const analyzeClientMessage = async (message, conversationHistory, clientSoul, clientId = null) => {
  try {
    const API_KEY = getApiKey();
    
    if (!API_KEY || API_KEY.trim() === "") {
      return fallbackAnalyzeClientMessage(message, conversationHistory, clientSoul);
    }
    
    const API_URL = "https://api.openai.com/v1/chat/completions";
    
    const openaiApi = axios.create({
      baseURL: API_URL.replace('/chat/completions', ''),
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const context = await buildContextualPrompt(
      clientId, 
      clientSoul, 
      conversationHistory, 
      true
    );
    
    const systemPrompt = `Eres un especialista en análisis de comunicaciones para cobranza. Tu tarea es categorizar respuestas de clientes.

IMPORTANTE: 
- Siempre usar tratamiento formal (usted, nunca tutear)
- Usar Don/Doña según corresponda
- En fase de comunicación de deuda, mencionar montos específicos si el cliente pregunta

${context.contextSection}

PERFIL ACTUAL DEL CLIENTE:
- Relación/Cercanía: ${clientSoul.relationship}/100
- Historial de Pago: ${clientSoul.history}/100  
- Actitud: ${clientSoul.attitude}/100
- Sensibilidad a Presión: ${clientSoul.sensitivity}/100
- Probabilidad de Pago: ${clientSoul.probability}/100

FASE ACTUAL: ${context.phaseDescription}

${context.currentConversation}

INSTRUCCIONES:
Analiza el siguiente mensaje del cliente y clasifícalo en UNA de estas categorías EXACTAS:
- neutral
- accepts_payment
- offers_partial  
- reschedule
- evades
- annoyed
- refuses
- thanks
- no_answer
- confirms_payment
- asks_bank_info

Responde SOLO con la categoría, sin explicaciones adicionales.`;

    const userPrompt = `Mensaje del cliente a analizar: "${message}"`;

    const response = await openaiApi.post('/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user", 
          content: userPrompt
        }
      ],
      max_tokens: 20,
      temperature: 0.1
    });
    
    let responseText = response.data.choices[0]?.message?.content?.trim() || '';
    
    let eventType = 'neutral';
    const possibleEvents = [
      'neutral', 'accepts_payment', 'offers_partial', 'reschedule', 
      'evades', 'annoyed', 'refuses', 'thanks', 'no_answer', 'confirms_payment', 'asks_bank_info'
    ];
    
    for (const event of possibleEvents) {
      if (responseText.toLowerCase().includes(event)) {
        eventType = event;
        break;
      }
    }
    
    const deltaMap = {
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

    const deltas = deltaMap[eventType] || deltaMap.neutral;
    
    return {
      eventType,
      deltas,
      explanation: `Evento detectado por OpenAI: "${eventType}" con contexto de conversaciones previas`,
      confidence: 0.9
    };
  } catch (error) {
    console.error('Error al analizar mensaje con OpenAI:', error);
    return fallbackAnalyzeClientMessage(message, conversationHistory, clientSoul);
  }
};

// Generación de respuestas - MODIFICAMOS para recibir clientId
export const generateAgentResponse = async (conversationHistory, clientSoul, lastClientMessage, lastEvent, clientId = null) => {
  try {
    const API_KEY = getApiKey();
    
    if (!API_KEY || API_KEY.trim() === "") {
      const clientInfo = await getClientById(clientId);
      const providerInfo = await getClientProvider(clientInfo?.provider_id);
      return fallbackGenerateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent, providerInfo, clientInfo);
    }
    
    const API_URL = "https://api.openai.com/v1/chat/completions";
    
    const openaiApi = axios.create({
      baseURL: API_URL.replace('/chat/completions', ''),
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    const context = await buildContextualPrompt(
      clientId, 
      clientSoul, 
      conversationHistory, 
      false
    );
    
    // Obtener tratamiento apropiado
    const clientTreatment = context.clientInfo ? getClientTreatment(context.clientInfo.name) : 'estimado cliente';
    
    let toneDescription = '';
    if (clientSoul.relationship > 70) {
      toneDescription = clientSoul.sensitivity > 70 
        ? 'cordial y comprensivo, evitando presión excesiva' 
        : 'cordial pero directo, manteniendo profesionalismo';
    } else if (clientSoul.relationship < 40) {
      toneDescription = clientSoul.sensitivity < 40 
        ? 'formal y directo, profesional pero firme' 
        : 'formal y considerado, profesional y respetuoso';
    } else {
      toneDescription = 'profesional equilibrado, manteniendo cortesía';
    }
    
    // Información de deuda para fase de comunicación
    const debtInfo = context.clientInfo && context.currentPhase === 'debt_notification' 
      ? `\nINFORMACIÓN DE DEUDA: $${context.clientInfo.debt.toLocaleString('es-CO')} COP`
      : '';
    
    // Modificado para usar el nombre del proveedor del cliente
    const systemPrompt = `Eres un agente de cobranza profesional de ${context.providerInfo.name}. Tu objetivo es recuperar pagos pendientes manteniendo buenas relaciones con los clientes.

REGLAS FUNDAMENTALES DE COMUNICACIÓN:
1. SIEMPRE usar tratamiento formal (usted, nunca tutear)
2. SIEMPRE dirigirse al cliente como "${clientTreatment}"
3. En FASE DE COMUNICACIÓN DE DEUDA: Si el cliente pregunta por el monto, proporcionar la cifra específica
4. Mantener tono profesional, empático y orientado a soluciones
5. Adaptar el tono al perfil del cliente
6. Si el cliente pregunta por los datos bancarios, proporcionar la información bancaria

${lastEvent === "asks_bank_info" ? `
  INFORMACIÓN BANCARIA:
  ${context.providerInfo.bank_information}
  `: ""
}

${context.contextSection}

INFORMACIÓN DEL CLIENTE:${debtInfo}

PERFIL ACTUAL DEL CLIENTE:
- Relación/Cercanía: ${clientSoul.relationship}/100
- Historial de Pago: ${clientSoul.history}/100
- Actitud: ${clientSoul.attitude}/100  
- Sensibilidad a Presión: ${clientSoul.sensitivity}/100
- Probabilidad de Pago: ${clientSoul.probability}/100

TONO RECOMENDADO: ${toneDescription}

FASE ACTUAL: ${context.phaseDescription}

${context.currentConversation}

ÚLTIMO MENSAJE DEL CLIENTE: "${lastClientMessage}"
EVENTO DETECTADO: "${lastEvent}"

INSTRUCCIONES ESPECÍFICAS POR FASE:
- SALUDO: Preséntese cordialmente usando "Don/Doña", identifique al cliente, establezca el motivo de la llamada
- COMUNICACIÓN DE DEUDA: Informe sobre la deuda. Si pregunta por el monto, mencione la cifra específica
- NEGOCIACIÓN: Busque acuerdos, maneje objeciones con respeto, ofrezca alternativas
- CONCRETAR PAGO: Facilite el proceso, confirme fechas y métodos
- DESPEDIDA: Cierre cordialmente, confirme acuerdos, agradezca

Genere UNA respuesta concisa (máximo 2 oraciones) usando tratamiento formal y dirigiéndose como "${clientTreatment}".`;

    const userPrompt = `Basándose en el contexto y el evento "${lastEvent}", genere una respuesta apropiada como agente de cobranza usando tratamiento formal.`;

    const response = await openaiApi.post('/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });
    
    let responseText = response.data.choices[0]?.message?.content?.trim() || '';
    
    if (!responseText) {
      responseText = `${clientTreatment}, entiendo su situación. ¿Podríamos coordinar una fecha para el pago de su deuda pendiente?`;
    }
    
    return {
      responseText,
      explanation: `Respuesta generada por OpenAI con tratamiento formal "${clientTreatment}" y tono "${toneDescription}"`,
      confidence: 0.9
    };
  } catch (error) {
    console.error('Error al generar respuesta con OpenAI:', error);
    return fallbackGenerateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent, context.providerInfo, context.clientInfo);
  }
};

// Funciones de fallback actualizadas con tratamiento formal
const fallbackAnalyzeClientMessage = (message, conversationHistory, clientSoul) => {
  const messageText = message.toLowerCase();
  
  let eventType = 'neutral';
  
  if (messageText.includes('datos bancarios') || messageText.includes('información bancaria') || 
      messageText.includes('número de cuenta') || messageText.includes('cuenta bancaria') ||
      (messageText.includes('banco') && (messageText.includes('cuál') || messageText.includes('cual') || messageText.includes('dónde') || messageText.includes('donde'))) ||
      (messageText.includes('cuenta') && (messageText.includes('cuál') || messageText.includes('cual') || messageText.includes('número'))) ||
      (messageText.includes('transferir') && (messageText.includes('dónde') || messageText.includes('donde') || messageText.includes('cuál') || messageText.includes('cual'))) ||
      (messageText.includes('pagar') && (messageText.includes('dónde') || messageText.includes('donde') || messageText.includes('cuál') || messageText.includes('cual'))) ||
      messageText.includes('datos para pagar') || messageText.includes('información para pagar')) {
    eventType = 'asks_bank_info';
  } else if (messageText.includes('pagar') || messageText.includes('transferir') || messageText.includes('depositar')) {
    if (messageText.includes('completo') || messageText.includes('todo') || messageText.includes('total')) {
      eventType = 'accepts_payment';
    } else if (messageText.includes('parte') || messageText.includes('parcial') || messageText.includes('algo') || messageText.includes('abono')) {
      eventType = 'offers_partial';
    } else if (messageText.includes('próxima') || messageText.includes('después') || messageText.includes('luego') || messageText.includes('semana')) {
      eventType = 'reschedule';
    } else {
      eventType = 'accepts_payment';
    }
  } else if (messageText.includes('gracias') || messageText.includes('agradezco') || messageText.includes('agradecida')) {
    eventType = 'thanks';
  } else if (messageText.includes('ya pagué') || messageText.includes('realicé el pago') || messageText.includes('transferí') || messageText.includes('consigné')) {
    eventType = 'confirms_payment';
  } else if (messageText.includes('no puedo') || messageText.includes('imposible') || messageText.includes('difícil')) {
    eventType = 'evades';
  } else if (messageText.includes('molesto') || messageText.includes('harto') || messageText.includes('fastidio') || messageText.includes('joder')) {
    eventType = 'annoyed';
  } else if (messageText.includes('no voy a pagar') || messageText.includes('no pagaré') || messageText.includes('olvídate') || messageText.includes('no pienso')) {
    eventType = 'refuses';
  }
  
  const deltaMap = {
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
  
  const deltas = deltaMap[eventType] || deltaMap.neutral;
  
  return {
    eventType,
    deltas,
    explanation: `Evento detectado por análisis local mejorado: "${eventType}" basado en patrones de lenguaje.`,
    confidence: 0.7
  };
};

// Modificado para recibir providerInfo
const fallbackGenerateAgentResponse = (conversationHistory, clientSoul, lastClientMessage, lastEvent, providerInfo = null, clientInfo = null) => {

  let tone = 'neutral';
  
  if (clientSoul.relationship > 70) {
    if (clientSoul.sensitivity > 70) {
      tone = 'friendly_no_pressure';
    } else {
      tone = 'friendly';
    }
  } else if (clientSoul.relationship < 40) {
    if (clientSoul.sensitivity < 40) {
      tone = 'formal_direct';
    } else {
      tone = 'formal_soft';
    }
  }
  
  // Respuestas con tratamiento formal
  const responseTemplates = {
    'accepts_payment': {
      friendly_no_pressure: "Excelente, me alegra mucho escuchar eso. Cuando usted pueda realizar el pago, solo avíseme y le envío toda la información necesaria.",
      friendly: "Perfecto, muchas gracias por su disposición. ¿Le parece bien que le envíe los datos bancarios ahora mismo?",
      formal_direct: "Muy bien, agradecemos su decisión. Le voy a proporcionar los datos para que pueda realizar el pago antes del viernes.",
      formal_soft: "Gracias por su confirmación. ¿Prefiere que le envíe la información de pago por WhatsApp o por correo?",
      neutral: "Entendido. ¿Desea que le proporcione los datos bancarios para realizar el pago?"
    },
    'offers_partial': {
      friendly_no_pressure: "Agradezco mucho su esfuerzo por hacer este abono. Cualquier pago nos ayuda bastante y valoramos su compromiso.",
      friendly: "Gracias por ofrecerse a hacer un abono. Eso nos ayuda mucho. ¿Cuándo podría usted realizar esta transferencia?",
      formal_direct: "Tomamos nota de su propuesta de pago parcial. ¿Podría indicarnos cuándo haría este abono y cuándo el saldo restante?",
      formal_soft: "Entendemos su situación y agradecemos su disposición. ¿Qué porcentaje de la deuda podría usted cubrir inicialmente?",
      neutral: "De acuerdo con el pago parcial. ¿Podríamos coordinar cuándo haría usted este primer abono?"
    },
    'reschedule': {
      friendly_no_pressure: "No hay ningún problema, entiendo que usted necesita más tiempo. ¿Qué fecha le resultaría más cómoda?",
      friendly: "Claro que podemos ajustar la fecha. ¿Cuál sería el mejor momento para usted realizar el pago?",
      formal_direct: "Podemos considerar una nueva fecha. ¿Cuál es su propuesta concreta y definitiva para el pago?",
      formal_soft: "Entendemos la necesidad de reprogramar. ¿Qué fecha le resultaría más conveniente para realizar el pago?",
      neutral: "De acuerdo. ¿Cuál sería la nueva fecha propuesta para efectuar el pago?"
    },
    'evades': {
      friendly_no_pressure: "Entiendo que puede ser un tema delicado. No se preocupe, podemos buscar juntos la mejor solución para su situación.",
      friendly: "Comprendo que es una situación compleja. ¿Hay algo específico que podamos resolver para facilitar el pago?",
      formal_direct: "Necesitamos una respuesta concreta sobre el pago pendiente. ¿Podría indicarnos cuál es su situación actual?",
      formal_soft: "Entendemos que pueda ser un tema complicado. ¿Podríamos programar una fecha para hablar con más tranquilidad?",
      neutral: "¿Podría por favor ayudarnos a entender cuál es su situación respecto al pago pendiente?"
    },
    'annoyed': {
      friendly_no_pressure: "Lamento mucho si le he causado alguna molestia. No es mi intención incomodarle, solo buscamos encontrar una solución que funcione para ambas partes.",
      friendly: "Disculpe si le he generado alguna molestia. ¿Qué podríamos hacer diferente para resolver esta situación de la mejor manera?",
      formal_direct: "Entendemos su molestia, sin embargo necesitamos resolver el tema del pago pendiente. ¿Qué alternativa propone usted?",
      formal_soft: "Lamentamos si esta comunicación le resulta incómoda. ¿Habría un mejor momento o forma para abordar este tema?",
      neutral: "Comprendo su posición. ¿Cómo preferiría usted que manejáramos esta situación para llegar a una solución?"
    },
    'refuses': {
      friendly_no_pressure: "Entiendo su posición actual. Quizás podríamos explorar algunas alternativas de pago que se ajusten mejor a su situación.",
      friendly: "Comprendo que sea difícil en este momento. ¿Podríamos considerar un plan de pagos más flexible?",
      formal_direct: "Tomamos nota de su respuesta. Sin embargo, la deuda permanece vigente. ¿Podríamos discutir alternativas viables?",
      formal_soft: "Entendemos que pueda tener dificultades. ¿Le interesaría conocer otras opciones de pago disponibles?",
      neutral: "¿Podríamos explorar alternativas que faciliten el pago de la deuda pendiente?"
    },
    'thanks': {
      friendly_no_pressure: "No hay de qué. Es un placer poder ayudarle. Si necesita cualquier cosa adicional, no dude en contactarme.",
      friendly: "Es un gusto poder ser de ayuda. ¿Hay algo más en lo que pueda asistirle para facilitar el proceso?",
      formal_direct: "De nada. ¿Podríamos entonces confirmar cuándo realizará el pago de la deuda pendiente?",
      formal_soft: "Nos alegra poder serle de utilidad. ¿Necesita alguna información adicional para proceder con el pago?",
      neutral: "De nada. ¿Tiene alguna otra consulta respecto al proceso de pago?"
    },
    'confirms_payment': {
      friendly_no_pressure: "Excelente noticia. Muchas gracias por realizar el pago. Vamos a verificarlo y le confirmaremos en cuanto se refleje en el sistema.",
      friendly: "Genial. Gracias por confirmar su pago. Lo verificaremos inmediatamente y le daremos el comprobante correspondiente.",
      formal_direct: "Gracias por su confirmación. Procederemos a verificar el pago y le notificaremos una vez esté procesado en el sistema.",
      formal_soft: "Agradecemos mucho su pago. Realizaremos la verificación correspondiente y le informaremos cuando esté todo listo.",
      neutral: "Gracias por informarnos. Verificaremos el pago y actualizaremos el estado de su cuenta."
    },
    'asks_bank_info': {
      friendly_no_pressure: `Señor@ ${clientInfo?.name || ''}, esta es la información de las cuentas bancarias para ${providerInfo?.name || 'nuestra empresa'}: ${providerInfo?.bank_information || 'Le enviaré la información bancaria por separado.'}`,
      friendly: `Don/Doña ${clientInfo?.name || ''}, le adjunto las cuentas de ${providerInfo?.name || 'nuestra empresa'}: ${providerInfo?.bank_information || 'Le enviaré la información bancaria completa.'}`,
      formal_direct: `Señor@ ${clientInfo?.name || ''}, esta es la información de las cuentas bancarias para ${providerInfo?.name || 'nuestra empresa'}: ${providerInfo?.bank_information || 'Recibirá la información bancaria detallada.'}`,
      formal_soft: `Don/Doña ${clientInfo?.name || ''}, le adjunto las cuentas de ${providerInfo?.name || 'nuestra empresa'}: ${providerInfo?.bank_information || 'Le haré llegar todos los datos bancarios necesarios.'}`,
      neutral: `Señor@ ${clientInfo?.name || ''}, esta es la información de las cuentas bancarias para ${providerInfo?.name || 'nuestra empresa'}: ${providerInfo?.bank_information || 'Le proporcionaré la información bancaria completa.'}`
    },
    'default': {
      friendly_no_pressure: "Entiendo perfectamente su situación. No se preocupe, cuando pueda realizar el pago solo avíseme.",
      friendly: "Agradezco que mantengamos esta comunicación. ¿Hay algo en lo que pueda ayudarle para facilitar el proceso de pago?",
      formal_direct: "Necesitamos regularizar su situación de deuda pendiente. ¿Podría indicarnos una fecha específica de pago?",
      formal_soft: "Entendemos que pueden surgir inconvenientes. ¿Podría comentarnos cuándo le sería posible realizar el pago?",
      neutral: "¿Podría por favor indicarnos cuándo podríamos esperar el pago de la deuda pendiente?"
    }
  };
  
  const eventResponses = responseTemplates[lastEvent] || responseTemplates.default;
  const response = eventResponses[tone] || eventResponses.neutral;
  
  return {
    responseText: response,
    explanation: `Respuesta generada con tratamiento formal y tono "${tone}" adaptado al perfil del cliente`,
    confidence: 0.8
  };
};