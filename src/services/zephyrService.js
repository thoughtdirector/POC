// src/services/zephyrService.js
import axios from 'axios';

// Función para obtener la API key de localStorage
const getApiKey = () => localStorage.getItem('huggingface_api_key') || ".";

// Detección de eventos y sugerencia de deltas
export const analyzeClientMessage = async (message, conversationHistory, clientSoul) => {
  try {
    const API_KEY = getApiKey();
    
    // Si no hay API key configurada, usar directamente el fallback
    if (!API_KEY || API_KEY.trim() === "") {
      console.log("No hay API key configurada para Hugging Face, usando fallback local");
      return fallbackAnalyzeClientMessage(message, conversationHistory, clientSoul);
    }
    
    // Configuración de la API de Hugging Face - URL ACTUALIZADA para el modelo beta
    const API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta";
    
    // Configuración de axios para Hugging Face
    const huggingFaceApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Historial de conversación formateado (últimas 3 interacciones para mantener el contexto compacto)
    const recentHistory = conversationHistory.slice(-3).map(turn => 
      `${turn.sender === 'agent' ? 'Agente' : 'Cliente'}: ${turn.message}`
    ).join('\n');
    
    // Formato del prompt siguiendo el formato correcto para Zephyr-7b-beta
    // Usa el formato de chat que el modelo espera: <|system|>, <|user|>, <|assistant|>
    const prompt = `<|system|>
Eres un asistente especializado en analizar mensajes en un contexto de cobranza. Tu tarea es categorizar la respuesta del cliente.

El cliente tiene las siguientes características:
- Relación/Cercanía: ${clientSoul.relationship}/100
- Historial de Pago: ${clientSoul.history}/100
- Actitud: ${clientSoul.attitude}/100
- Sensibilidad a Presión: ${clientSoul.sensitivity}/100
- Probabilidad de Pago: ${clientSoul.probability}/100

Historial reciente: 
${recentHistory}
<|user|>
Clasifica este mensaje del cliente: "${message}"

Elige UNA de estas categorías EXACTAS sin explicación:
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
<|assistant|>`;

    console.log("Enviando solicitud a Hugging Face API para análisis...");
    
    // Llamada a la API con los parámetros ajustados para Zephyr-7b-beta
    const response = await huggingFaceApi.post('', {
      inputs: prompt,
      parameters: {
        max_new_tokens: 20,         // Reducido para esta tarea específica
        temperature: 0.1,           // Reducido para respuestas más deterministas
        top_p: 0.95,
        do_sample: true,
        return_full_text: false     // Solo queremos la respuesta, no el prompt
      }
    });

    console.log("Respuesta de Hugging Face:", response.data);
    
    // Procesar respuesta - extraer solo la categoría
    let responseText = '';
    if (Array.isArray(response.data)) {
      responseText = response.data[0]?.generated_text || '';
    } else {
      responseText = response.data.generated_text || '';
    }
    
    // Extraer solo la palabra clave de la respuesta (limpiar texto adicional)
    let eventType = 'neutral';
    const possibleEvents = [
      'neutral', 'accepts_payment', 'offers_partial', 'reschedule', 
      'evades', 'annoyed', 'refuses', 'thanks', 'no_answer', 'confirms_payment'
    ];
    
    for (const event of possibleEvents) {
      if (responseText.toLowerCase().includes(event)) {
        eventType = event;
        break;
      }
    }
    
    // Mapeo de eventos a deltas
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
      'confirms_payment': { relationship: 10, history: 20, attitude: 20, sensitivity: -10, probability: 30 }
    };

    // Obtener deltas según el evento detectado
    const deltas = deltaMap[eventType] || deltaMap.neutral;

    console.log(`Evento detectado por Zephyr: "${eventType}" con deltas:`, deltas);
    
    return {
      eventType,
      deltas,
      explanation: `Evento detectado por Zephyr: "${eventType}"`,
      confidence: 0.8
    };
  } catch (error) {
    console.error('Error al analizar mensaje con Zephyr:', error);
    console.log("Usando fallback local debido al error");
    // En caso de error, usar fallback local
    return fallbackAnalyzeClientMessage(message, conversationHistory, clientSoul);
  }
};

// Generación de respuestas
export const generateAgentResponse = async (conversationHistory, clientSoul, lastClientMessage, lastEvent) => {
  try {
    const API_KEY = getApiKey();
    
    // Si no hay API key configurada, usar directamente el fallback
    if (!API_KEY || API_KEY.trim() === "") {
      console.log("No hay API key configurada para Hugging Face, usando fallback local");
      return fallbackGenerateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent);
    }
    
    // Configuración de la API de Hugging Face - URL ACTUALIZADA para el modelo beta
    const API_URL = "https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta";
    
    // Configuración de axios para Hugging Face
    const huggingFaceApi = axios.create({
      baseURL: API_URL,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    // Construir un historial de chat reciente para contexto (últimas 3 interacciones)
    let chatHistory = '';
    const recentConversation = conversationHistory.slice(-3);
    
    for (const turn of recentConversation) {
      if (turn.sender === 'agent') {
        chatHistory += `Agente: ${turn.message}\n`;
      } else {
        chatHistory += `Cliente: ${turn.message}\n`;
      }
    }
    
    // Determine el tono basado en el alma del cliente
    let tone = 'neutral';
    if (clientSoul.relationship > 70) {
      tone = clientSoul.sensitivity > 70 ? 'amistoso sin presión' : 'amistoso directo';
    } else if (clientSoul.relationship < 40) {
      tone = clientSoul.sensitivity < 40 ? 'formal directo' : 'formal suave';
    }
    
    // Formato del prompt para generar respuesta
    const prompt = `<|system|>
Eres un agente de cobranza de la empresa Acriventas. Tu objetivo es obtener el pago de una deuda pendiente mientras mantienes una buena relación con el cliente.

Debes usar un tono "${tone}" basado en el perfil del cliente:
- Relación/Cercanía: ${clientSoul.relationship}/100
- Historial de Pago: ${clientSoul.history}/100
- Actitud: ${clientSoul.attitude}/100
- Sensibilidad a Presión: ${clientSoul.sensitivity}/100
- Probabilidad de Pago: ${clientSoul.probability}/100

Historial reciente de la conversación:
${chatHistory}

El último mensaje del cliente fue: "${lastClientMessage}"
El tipo de evento detectado es: "${lastEvent}"
<|user|>
Genera una respuesta empática y efectiva como agente de cobranza. La respuesta debe ser concisa (máximo 2 frases), adaptada al perfil del cliente, y enfocada en lograr el pago de la deuda.
<|assistant|>`;

    console.log("Enviando solicitud para generar respuesta a Hugging Face API...");
    const response = await huggingFaceApi.post('', {
      inputs: prompt,
      parameters: {
        max_new_tokens: 100,        // Límite ajustado para respuestas concisas
        temperature: 0.7,           // Suficiente creatividad para respuestas naturales
        top_p: 0.95,
        do_sample: true,
        return_full_text: false     // Solo queremos la respuesta generada
      }
    });

    console.log("Respuesta de Hugging Face para generación:", response.data);
    
    // Procesar respuesta
    let responseText = '';
    if (Array.isArray(response.data)) {
      responseText = response.data[0]?.generated_text || '';
    } else {
      responseText = response.data.generated_text || '';
    }
    
    // Limpiar la respuesta para eliminar cualquier texto adicional no deseado
    responseText = responseText.trim();
    
    // Si la respuesta está vacía, usar respuesta por defecto
    if (!responseText) {
      responseText = "Entiendo. ¿Podría por favor indicarnos cuándo podríamos esperar el pago de su deuda?";
    }

    console.log(`Respuesta generada por Zephyr usando tono "${tone}": ${responseText}`);
    
    return {
      responseText,
      explanation: `Respuesta generada por Zephyr usando tono "${tone}"`,
      confidence: 0.8
    };
  } catch (error) {
    console.error('Error al generar respuesta con Zephyr:', error);
    console.log("Usando fallback local para respuesta debido al error");
    // En caso de error, usar fallback local
    return fallbackGenerateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent);
  }
};

// Funciones de fallback (basadas en el sistema anterior) para usar cuando no hay conexión a la API
const fallbackAnalyzeClientMessage = (message, conversationHistory, clientSoul) => {
  const messageText = message.toLowerCase();
  
  // Detección simple basada en palabras clave
  let eventType = 'neutral';
  
  if (messageText.includes('pagar') || messageText.includes('transferir') || messageText.includes('depositar')) {
    if (messageText.includes('completo') || messageText.includes('todo')) {
      eventType = 'accepts_payment';
    } else if (messageText.includes('parte') || messageText.includes('parcial') || messageText.includes('algo')) {
      eventType = 'offers_partial';
    } else if (messageText.includes('próxima') || messageText.includes('después') || messageText.includes('luego')) {
      eventType = 'reschedule';
    }
  } else if (messageText.includes('gracias') || messageText.includes('agradezco')) {
    eventType = 'thanks';
  } else if (messageText.includes('ya pagué') || messageText.includes('realicé el pago') || messageText.includes('transferí')) {
    eventType = 'confirms_payment';
  } else if (messageText.includes('no puedo') || messageText.includes('imposible')) {
    eventType = 'evades';
  } else if (messageText.includes('molesto') || messageText.includes('harto') || messageText.includes('fastidio')) {
    eventType = 'annoyed';
  } else if (messageText.includes('no voy a pagar') || messageText.includes('no pagaré') || messageText.includes('olvídate')) {
    eventType = 'refuses';
  }
  
  // Mapeo de eventos a deltas
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
    'confirms_payment': { relationship: 10, history: 20, attitude: 20, sensitivity: -10, probability: 30 }
  };
  
  const deltas = deltaMap[eventType] || deltaMap.neutral;
  
  console.log(`Evento detectado por fallback: "${eventType}" con deltas:`, deltas);
  
  return {
    eventType,
    deltas,
    explanation: `Evento detectado por fallback: "${eventType}" basado en palabras clave.`,
    confidence: 0.6
  };
};

const fallbackGenerateAgentResponse = (conversationHistory, clientSoul, lastClientMessage, lastEvent) => {
  // Decidir tono basado en variables del alma
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
  
  // Base de respuestas según evento y tono
  const responseTemplates = {
    'accepts_payment': {
      friendly_no_pressure: "¡Excelente noticia! Gracias por tu disposición. Cuando puedas hacer el pago, solo avísame.",
      friendly: "¡Perfecto! Muchas gracias por tu colaboración. ¿Te envío los datos para el pago?",
      formal_direct: "Muy bien. Le agradecemos su decisión. Necesitamos que realice el pago antes del fin de semana.",
      formal_soft: "Gracias por su confirmación. ¿Prefiere que le enviemos los datos bancarios por este medio?",
      neutral: "Entendido. ¿Desea que le enviemos la información para realizar el pago?"
    },
    'offers_partial': {
      friendly_no_pressure: "Agradezco mucho tu esfuerzo por pagar una parte. Cualquier aporte es bienvenido.",
      friendly: "Gracias por tu disposición. Un pago parcial nos ayuda mucho. ¿Cuándo podrías realizar este abono?",
      formal_direct: "Tomamos nota de su oferta de pago parcial. ¿Cuándo podríamos esperar el resto del monto?",
      formal_soft: "Entendemos su situación. El pago parcial es un buen primer paso. ¿Cuándo sería posible?",
      neutral: "De acuerdo con el pago parcial. ¿Qué monto podría transferir y cuándo?"
    },
    'reschedule': {
      friendly_no_pressure: "No hay problema, entiendo que necesitas reprogramar. ¿Qué fecha te resultaría más conveniente?",
      friendly: "Claro que podemos ajustar la fecha. ¿Cuál sería el mejor momento para ti?",
      formal_direct: "Podemos considerar una nueva fecha. ¿Cuál es su propuesta concreta para el pago?",
      formal_soft: "Entendemos la necesidad de reprogramar. ¿Qué fecha le resultaría adecuada para realizar el pago?",
      neutral: "De acuerdo. ¿Cuál sería la nueva fecha propuesta para el pago?"
    },
    'evades': {
      friendly_no_pressure: "Entiendo que quizás no es el mejor momento para hablar de esto. ¿Te parece si retomamos la conversación en otro momento?",
      friendly: "Noto que es un tema delicado. ¿Hay algo específico que podamos resolver para facilitar el pago?",
      formal_direct: "Necesitamos una respuesta concreta respecto al pago pendiente. ¿Podría indicarnos su plan de acción?",
      formal_soft: "Entendemos que pueda ser un tema complicado. ¿Podríamos concretar cuándo sería posible abordar el pago?",
      neutral: "¿Podría por favor indicarnos cuál es su situación respecto al pago pendiente?"
    },
    'annoyed': {
      friendly_no_pressure: "Lamento si te he incomodado. No es mi intención molestar, solo buscamos encontrar una solución que funcione para ambos.",
      friendly: "Disculpa si te he molestado. ¿Qué podríamos hacer para resolver esta situación de la mejor manera?",
      formal_direct: "Entendemos su molestia. Sin embargo, necesitamos resolver el tema del pago pendiente. ¿Qué solución propone?",
      formal_soft: "Lamentamos si esta comunicación le resulta incómoda. ¿Habría un mejor momento o forma para abordar el tema?",
      neutral: "Entiendo. ¿Cómo preferiría que manejemos esta situación para llegar a una solución?"
    },
    'refuses': {
      friendly_no_pressure: "Entiendo tu posición. Quizás podríamos explorar algunas alternativas que se ajusten mejor a tu situación actual.",
      friendly: "Comprendo que sea difícil en este momento. ¿Podríamos considerar opciones de pago más flexibles?",
      formal_direct: "Tomamos nota de su negativa. Sin embargo, la deuda permanece vigente. ¿Podríamos discutir alternativas de pago?",
      formal_soft: "Entendemos que pueda tener dificultades. ¿Le interesaría conocer otras opciones disponibles para resolver esta situación?",
      neutral: "¿Podríamos explorar alternativas que faciliten el pago de la deuda pendiente?"
    },
    'thanks': {
      friendly_no_pressure: "¡No hay de qué! Estamos aquí para ayudarte. Si necesitas cualquier cosa, no dudes en hacérmelo saber.",
      friendly: "Es un placer poder ser de ayuda. ¿Hay algo más en lo que pueda asistirte?",
      formal_direct: "De nada. ¿Podríamos entonces confirmar cuándo realizará el pago?",
      formal_soft: "Nos alegra poder serle de utilidad. ¿Necesita alguna otra información para proceder?",
      neutral: "De nada. ¿Tiene alguna otra consulta respecto al pago?"
    },
    'confirms_payment': {
      friendly_no_pressure: "¡Excelente noticia! Muchas gracias por tu pago. Verificaremos y te confirmaremos en cuanto se refleje en nuestro sistema.",
      friendly: "¡Genial! Gracias por confirmar tu pago. Lo verificaremos a la brevedad y te daremos el comprobante.",
      formal_direct: "Gracias por su confirmación. Procederemos a verificar el pago y le notificaremos cuando esté procesado.",
      formal_soft: "Agradecemos su pago. Realizaremos la verificación correspondiente y le informaremos una vez completado el proceso.",
      neutral: "Gracias por informarnos. Verificaremos el pago y actualizaremos el estado de su cuenta."
    },
    'default': {
      friendly_no_pressure: "Entiendo perfectamente. No te preocupes, cuando puedas realizar el pago me avisas.",
      friendly: "Agradezco que estemos en contacto. ¿Hay algo en lo que pueda ayudarte para facilitar el proceso?",
      formal_direct: "Necesitamos regularizar su situación. ¿Podría por favor indicarnos una fecha concreta de pago?",
      formal_soft: "Entendemos que pueden surgir contratiempos. ¿Podría comentarnos cuándo le sería posible realizar el pago?",
      neutral: "¿Podría por favor indicarnos cuándo podríamos esperar el pago?"
    }
  };
  
  // Seleccionar plantilla de respuesta
  const eventResponses = responseTemplates[lastEvent] || responseTemplates.default;
  const response = eventResponses[tone] || eventResponses.neutral;
  
  console.log(`Respuesta generada por fallback usando tono "${tone}": ${response}`);
  
  return {
    responseText: response,
    explanation: `Respuesta generada por fallback usando tono "${tone}"`,
    confidence: 0.7
  };
};