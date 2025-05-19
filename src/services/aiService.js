// src/services/aiService.js

// Configuración para determinar qué servicio de IA usar
export const AI_SERVICES = {
  GEMINI: 'gemini',
  ZEPHYR: 'zephyr',
  // Fácil de añadir más servicios en el futuro
};

// Servicio actual a utilizar (configurando Zephyr como predeterminado)
let currentService = AI_SERVICES.ZEPHYR;

// Función para cambiar el servicio de IA
export const setAIService = (service) => {
  if (Object.values(AI_SERVICES).includes(service)) {
    currentService = service;
    return true;
  }
  return false;
};

// Función para obtener el servicio actual
export const getCurrentAIService = () => currentService;

// Importar los servicios específicos
import * as geminiService from './geminiService';
import * as zephyrService from './zephyrService';

// Función para analizar mensajes del cliente
export const analyzeClientMessage = async (message, conversationHistory, clientSoul) => {
  switch (currentService) {
    case AI_SERVICES.GEMINI:
      return geminiService.analyzeClientMessage(message, conversationHistory, clientSoul);
    case AI_SERVICES.ZEPHYR:
      return zephyrService.analyzeClientMessage(message, conversationHistory, clientSoul);
    default:
      throw new Error(`Servicio de IA no reconocido: ${currentService}`);
  }
};

// Función para generar respuestas del agente
export const generateAgentResponse = async (conversationHistory, clientSoul, lastClientMessage, lastEvent) => {
  switch (currentService) {
    case AI_SERVICES.GEMINI:
      return geminiService.generateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent);
    case AI_SERVICES.ZEPHYR:
      return zephyrService.generateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent);
    default:
      throw new Error(`Servicio de IA no reconocido: ${currentService}`);
  }
};