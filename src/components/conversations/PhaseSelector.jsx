import React from 'react';
import { CONVERSATION_PHASES } from '../../firebase/conversations';

const PhaseSelector = ({ phase, onChange }) => {
  const handleChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className="form-group">
      <label className="label">Fase de la conversación</label>
      <select 
        className="input w-full" 
        value={phase} 
        onChange={handleChange}
      >
        <option value={CONVERSATION_PHASES.GREETING}>Fase 1: Saludo</option>
        <option value={CONVERSATION_PHASES.DEBT_NOTIFICATION}>Fase 2: Comunicación de deuda</option>
        <option value={CONVERSATION_PHASES.NEGOTIATION}>Fase 3: Negociación</option>
        <option value={CONVERSATION_PHASES.PAYMENT_CONFIRMATION}>Fase 4: Concretar pago</option>
        <option value={CONVERSATION_PHASES.FAREWELL}>Fase 5: Despedida</option>
      </select>
    </div>
  );
};

export default PhaseSelector;