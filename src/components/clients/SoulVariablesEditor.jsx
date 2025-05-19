import { useState, useEffect } from 'react';

const SoulVariablesEditor = ({ initialValues, onChange, readOnly = false }) => {
  const [soulValues, setSoulValues] = useState({
    relationship: 50,
    history: 50,
    attitude: 50,
    sensitivity: 50,
    probability: 50,
    ...initialValues
  });

  useEffect(() => {
    if (initialValues) {
      setSoulValues({
        relationship: 50,
        history: 50,
        attitude: 50,
        sensitivity: 50,
        probability: 50,
        ...initialValues
      });
    }
  }, [initialValues]);

  const handleChange = (variable, value) => {
    const newValues = {
      ...soulValues,
      [variable]: parseInt(value, 10)
    };
    
    setSoulValues(newValues);
    
    if (onChange) {
      onChange(newValues);
    }
  };

  const getColorClass = (value) => {
    if (value < 30) return 'bg-red-500';
    if (value < 50) return 'bg-orange-500';
    if (value < 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const renderSlider = (label, key, description) => (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className={`px-2 py-1 rounded-full text-white text-xs font-medium ${getColorClass(soulValues[key])}`}>
          {soulValues[key]}
        </span>
      </div>
      
      <input
        type="range"
        min="0"
        max="100"
        step="1"
        value={soulValues[key]}
        onChange={(e) => handleChange(key, e.target.value)}
        disabled={readOnly}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
      />
      
      <p className="mt-1 text-sm text-gray-500">{description}</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {renderSlider(
        "Relación/Cercanía", 
        "relationship", 
        "Indica cuán cercana es la relación con el cliente."
      )}
      
      {renderSlider(
        "Historial de Pago", 
        "history", 
        "Nivel de cumplimiento de pagos en el pasado."
      )}
      
      {renderSlider(
        "Actitud en la Llamada", 
        "attitude", 
        "Disposición emocional del cliente en la conversación."
      )}
      
      {renderSlider(
        "Sensibilidad a Presión", 
        "sensitivity", 
        "Nivel de reacción negativa a la insistencia o tono de urgencia."
      )}
      
      {renderSlider(
        "Probabilidad de Pago", 
        "probability", 
        "Estimación de si pagará pronto."
      )}
    </div>
  );
};

export default SoulVariablesEditor;