export const AI_SERVICES = {
  GEMINI: 'gemini',
  ZEPHYR: 'zephyr',
  OPENAI: 'openai',
};

let currentService = AI_SERVICES.OPENAI;

export const setAIService = (service) => {
  if (Object.values(AI_SERVICES).includes(service)) {
    currentService = service;
    return true;
  }
  return false;
};

export const getCurrentAIService = () => currentService;

import * as geminiService from './geminiService';
import * as zephyrService from './zephyrService';
import * as openaiService from './openaiService';

// Funciones principales con clientId como parámetro opcional
export const analyzeClientMessage = async (message, conversationHistory, clientSoul, clientId = null) => {
  switch (currentService) {
    case AI_SERVICES.GEMINI:
      return geminiService.analyzeClientMessage(message, conversationHistory, clientSoul);
    case AI_SERVICES.ZEPHYR:
      return zephyrService.analyzeClientMessage(message, conversationHistory, clientSoul);
    case AI_SERVICES.OPENAI:
      return openaiService.analyzeClientMessage(message, conversationHistory, clientSoul, clientId);
    default:
      throw new Error(`Servicio de IA no reconocido: ${currentService}`);
  }
};

export const generateAgentResponse = async (conversationHistory, clientSoul, lastClientMessage, lastEvent, clientId = null) => {
  switch (currentService) {
    case AI_SERVICES.GEMINI:
      return geminiService.generateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent);
    case AI_SERVICES.ZEPHYR:
      return zephyrService.generateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent);
    case AI_SERVICES.OPENAI:
      return openaiService.generateAgentResponse(conversationHistory, clientSoul, lastClientMessage, lastEvent, clientId);
    default:
      throw new Error(`Servicio de IA no reconocido: ${currentService}`);
  }
};