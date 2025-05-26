import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AI_SERVICES, getCurrentAIService, setAIService } from '../services/aiService';

const AISettings = () => {
  const [currentService, setCurrentService] = useState('');
  const [huggingfaceApiKey, setHuggingfaceApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    setCurrentService(getCurrentAIService());
    
    // Cargar API keys guardadas
    const savedHuggingfaceKey = localStorage.getItem('huggingface_api_key') || '';
    const savedOpenaiKey = localStorage.getItem('openai_api_key') || '';
    
    setHuggingfaceApiKey(savedHuggingfaceKey);
    setOpenaiApiKey(savedOpenaiKey);
  }, []);
  
  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    
    try {
      // Validar que si se selecciona un servicio que requiere API key, la key esté presente
      if (currentService === AI_SERVICES.ZEPHYR && !huggingfaceApiKey.trim()) {
        setMessage('Error: Debe proporcionar una API Key válida para Hugging Face.');
        return;
      }
      
      if (currentService === AI_SERVICES.OPENAI && !openaiApiKey.trim()) {
        setMessage('Error: Debe proporcionar una API Key válida para OpenAI.');
        return;
      }
      
      // Guardar configuración
      setAIService(currentService);
      
      // Guardar API keys
      localStorage.setItem('huggingface_api_key', huggingfaceApiKey);
      localStorage.setItem('openai_api_key', openaiApiKey);
      
      setMessage('Configuración guardada correctamente');
      
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      setMessage('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };
  
  const getServiceDescription = (service) => {
    switch (service) {
      case AI_SERVICES.GEMINI:
        return "Servicio básico con respuestas predefinidas (no requiere configuración externa)";
      case AI_SERVICES.ZEPHYR:
        return "Modelo Zephyr 7B Beta de Hugging Face - Buena calidad, requiere API key gratuita";
      case AI_SERVICES.OPENAI:
        return "GPT-3.5 Turbo de OpenAI - Máxima calidad con contexto avanzado, requiere API key de pago";
      default:
        return "";
    }
  };
  
  const maskApiKey = (key) => {
    if (!key || key.length < 8) return key;
    return key.substring(0, 4) + '...' + key.substring(key.length - 4);
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Configuración de IA</h1>
      
      {/* Información general */}
      <div className="bg-blue-50 border border-blue-200 text-blue-800 p-4 rounded mb-6">
        <h3 className="font-semibold mb-2">💡 Acerca de los servicios de IA</h3>
        <p className="text-sm mb-2">
          El sistema utiliza diferentes servicios de IA para analizar las conversaciones y generar respuestas inteligentes adaptadas al perfil de cada cliente.
        </p>
        <p className="text-sm">
          <strong>Novedad:</strong> El servicio OpenAI incluye contexto avanzado que utiliza conversaciones previas con el mismo cliente, 
          o aprende del estilo conversacional de clientes similares si no existe historial previo.
        </p>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="form-group mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Servicio de IA
          </label>
          
          <div className="space-y-3">
            {/* Gemini */}
            <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="aiService"
                value={AI_SERVICES.GEMINI}
                checked={currentService === AI_SERVICES.GEMINI}
                onChange={(e) => setCurrentService(e.target.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Gemini (Básico)</div>
                <div className="text-sm text-gray-500">{getServiceDescription(AI_SERVICES.GEMINI)}</div>
              </div>
              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">GRATIS</span>
            </label>
            
            {/* Zephyr */}
            <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="aiService"
                value={AI_SERVICES.ZEPHYR}
                checked={currentService === AI_SERVICES.ZEPHYR}
                onChange={(e) => setCurrentService(e.target.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">Zephyr 7B Beta (Hugging Face)</div>
                <div className="text-sm text-gray-500">{getServiceDescription(AI_SERVICES.ZEPHYR)}</div>
              </div>
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">API GRATUITA</span>
            </label>
            
            {/* OpenAI */}
            <label className="flex items-start space-x-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="radio"
                name="aiService"
                value={AI_SERVICES.OPENAI}
                checked={currentService === AI_SERVICES.OPENAI}
                onChange={(e) => setCurrentService(e.target.value)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">OpenAI GPT-3.5 Turbo</div>
                <div className="text-sm text-gray-500">{getServiceDescription(AI_SERVICES.OPENAI)}</div>
                <div className="text-xs text-green-600 mt-1">
                  ✨ <strong>Incluye contexto avanzado:</strong> Usa conversaciones previas y aprende de clientes similares
                </div>
              </div>
              <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">PREMIUM</span>
            </label>
          </div>
        </div>
        
        {/* Configuración de API Keys */}
        <div className="space-y-6">
          {/* Hugging Face API Key */}
          {currentService === AI_SERVICES.ZEPHYR && (
            <div className="form-group border-t pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key de Hugging Face
              </label>
              <input
                type="password"
                className="input w-full mb-2"
                value={huggingfaceApiKey}
                onChange={(e) => setHuggingfaceApiKey(e.target.value)}
                placeholder="Ingresa tu API Key de Hugging Face"
              />
              {huggingfaceApiKey && (
                <p className="text-xs text-gray-500 mb-2">
                  API Key configurada: {maskApiKey(huggingfaceApiKey)}
                </p>
              )}
              <p className="text-sm text-gray-500">
                Obtén una API Key gratuita desde tu cuenta de{' '}
                <a 
                  href="https://huggingface.co/settings/tokens" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary-600 hover:text-primary-800 underline"
                >
                  Hugging Face
                </a>.
              </p>
            </div>
          )}
          
          {/* OpenAI API Key */}
          {currentService === AI_SERVICES.OPENAI && (
            <div className="form-group border-t pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key de OpenAI
              </label>
              <input
                type="password"
                className="input w-full mb-2"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="Ingresa tu API Key de OpenAI (sk-...)"
              />
              {openaiApiKey && (
                <p className="text-xs text-gray-500 mb-2">
                  API Key configurada: {maskApiKey(openaiApiKey)}
                </p>
              )}
              <div className="bg-amber-50 border border-amber-200 p-3 rounded text-sm text-amber-800 mb-2">
                <strong>💰 Costo estimado:</strong> ~$0.002 USD por conversación (muy económico)
              </div>
              <p className="text-sm text-gray-500">
                Obtén tu API Key desde{' '}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary-600 hover:text-primary-800 underline"
                >
                  OpenAI Platform
                </a>. 
                Necesitarás añadir créditos a tu cuenta (mínimo $5 USD).
              </p>
            </div>
          )}
        </div>
        
        {/* Características del servicio OpenAI */}
        {currentService === AI_SERVICES.OPENAI && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded">
            <h4 className="font-semibold text-green-800 mb-2">🚀 Características avanzadas de OpenAI</h4>
            <ul className="text-sm text-green-700 space-y-1">
              <li>• <strong>Contexto inteligente:</strong> Analiza conversaciones previas con el mismo cliente</li>
              <li>• <strong>Aprendizaje adaptativo:</strong> Si no hay historial, aprende del estilo de clientes similares</li>
              <li>• <strong>Respuestas por fases:</strong> Adapta el mensaje según la etapa de la conversación</li>
              <li>• <strong>Análisis de personalidad:</strong> Ajusta el tono según el perfil psicológico del cliente</li>
              <li>• <strong>Mayor precisión:</strong> Detecta mejor las intenciones y emociones del cliente</li>
            </ul>
          </div>
        )}
        
        {message && (
          <div className={`p-3 rounded mt-4 ${message.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {message}
          </div>
        )}
        
        <div className="flex justify-end gap-2 mt-8">
          <button
            className="btn-secondary"
            onClick={() => navigate(-1)}
            disabled={isSaving}
          >
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Guardando...' : 'Guardar configuración'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettings;