import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllClients } from '../firebase/clients';

const SelectClientForConversation = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const fetchClients = async () => {
      try {
        const clientList = await getAllClients();
        setClients(clientList);
      } catch (error) {
        console.error('Error al cargar clientes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchClients();
  }, []);
  
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.phone.includes(searchTerm)
  );
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Seleccionar Cliente para Conversación</h1>
      
      <div className="mb-6">
        <input
          type="text"
          className="input"
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow">
        {isLoading ? (
          <div className="p-4">Cargando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-gray-500">No se encontraron clientes.</p>
            <button 
              className="btn-primary mt-4"
              onClick={() => navigate('/clients/new')}
            >
              Agregar Nuevo Cliente
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {filteredClients.map(client => (
              <li 
                key={client.id}
                className="p-4 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/conversation/new/${client.id}`)}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{client.name}</span>
                  <span className="text-primary-600 font-semibold">
                    ${client.debt.toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {client.phone} | {client.email}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="mt-6">
        <button 
          className="btn-secondary"
          onClick={() => navigate(-1)}
        >
          Volver
        </button>
      </div>
    </div>
  );
};

export default SelectClientForConversation;