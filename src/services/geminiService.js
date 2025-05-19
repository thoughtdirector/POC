// Este archivo preparará la estructura para la integración con Gemini
// Por ahora, simulamos las respuestas de la API

// Simular la detección de eventos y sugerencia de deltas
export const analyzeClientMessage = async (message, conversationHistory, clientSoul) => {
  // En el futuro, aquí irá la llamada a la API de Gemini
  // Por ahora, implementamos una lógica simple basada en palabras clave
  
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
  
  // Mapeo de eventos a deltas (esto se centralizará cuando integremos con Gemini)
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
  
  return {
    eventType,
    deltas,
    explanation: `Evento detectado "${eventType}" basado en palabras clave como "${messageText.split(' ').slice(0, 3).join(' ')}..."`,
    confidence: 0.7 // Simulamos un nivel de confianza
  };
};

// Simular la generación de respuestas basadas en el alma del cliente
export const generateAgentResponse = async (conversationHistory, clientSoul, lastClientMessage, lastEvent) => {
  // En el futuro, aquí irá la llamada a la API de Gemini
  // Por ahora, generamos respuestas predefinidas basadas en el alma
  
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
  
  return {
    responseText: response,
    explanation: `Respuesta generada usando tono "${tone}" basado en Relación: ${clientSoul.relationship}, Sensibilidad: ${clientSoul.sensitivity}`,
    confidence: 0.8 // Simulamos un nivel de confianza
  };
};