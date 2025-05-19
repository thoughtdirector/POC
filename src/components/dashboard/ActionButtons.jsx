import { useNavigate } from 'react-router-dom';
import { FaPlus, FaSearch, FaUserPlus } from 'react-icons/fa';

const ActionButtons = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-wrap gap-4 mb-8">
      <button
        onClick={() => navigate('/conversation/new')}
        className="btn-primary flex items-center gap-2"
      >
        <FaPlus /> Iniciar Conversación
      </button>
      
      <button
        onClick={() => navigate('/clients/search')}
        className="btn-secondary flex items-center gap-2"
      >
        <FaSearch /> Buscar Cliente
      </button>
      
      <button
        onClick={() => navigate('/clients/new')}
        className="btn-secondary flex items-center gap-2"
      >
        <FaUserPlus /> Agregar Cliente
      </button>
    </div>
  );
};

export default ActionButtons;