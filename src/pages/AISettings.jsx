import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AI_SERVICES, getCurrentAIService, setAIService } from '../services/aiService';

const AISettings = () => {
  const [currentService, setCurrentService] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  
  useEffect(() => {
    setCurrentService(getCurrentAIService());
    
    const savedApiKey = localStorage.getItem('huggingface_api_key') || '';
    setApiKey(savedApiKey);
  }, []);
  
  const handleSave = async () => {
    setIsSaving(true);
    setMessage('');
    
    try {
      setAIService(currentService);
      
      localStorage.setItem('huggingface_api_key', apiKey);
      
      setMessage('Configuración guardada correctamente');
      
      setTimeout(() => navigate('/'), 1500);
    } catch (error) {
      console.error('Error al guardar configuración:', error);
      setMessage('Error al guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Configuración de IA</h1>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="form-group mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Servicio de IA
          </label>
          <select
            className="input w-full"
            value={currentService}
            onChange={(e) => setCurrentService(e.target.value)}
          >
            <option value={AI_SERVICES.GEMINI}>Gemini (Predeterminado)</option>
            <option value={AI_SERVICES.ZEPHYR}>Zephyr 7B Alpha (Hugging Face)</option>
          </select>
          <p className="mt-1 text-sm text-gray-500">
            Selecciona el servicio de IA que se utilizará para procesar las conversaciones.
          </p>
        </div>
        
        {currentService === AI_SERVICES.ZEPHYR && (
          <div className="form-group mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key de Hugging Face
            </label>
            <input
              type="password"
              className="input w-full"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Ingresa tu API Key de Hugging Face"
            />
            <p className="mt-1 text-sm text-gray-500">
              Puedes obtener una API Key desde tu cuenta de <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-800">Hugging Face</a>.
            </p>
          </div>
        )}
        
        {message && (
          <div className={`p-3 rounded mb-4 ${message.includes('Error') ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
            {message}
          </div>
        )}
        
        <div className="flex justify-end gap-2">
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