import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllClients } from '../firebase/clients';
import { FaPlus, FaSearch } from 'react-icons/fa';

const ClientList = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    const fetchClients = async () => {
      try {
        setIsLoading(true);
        const clientsData = await getAllClients();
        setClients(clientsData);
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
    (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (client.phone && client.phone.includes(searchTerm))
  );
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex space-x-2">
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => navigate('/clients/new')}
          >
            <FaPlus /> Agregar Cliente
          </button>
          <button
            className="btn-secondary flex items-center gap-2"
            onClick={() => navigate('/clients/search')}
          >
            <FaSearch /> Búsqueda Avanzada
          </button>
        </div>
      </div>
      
      <div className="mb-6">
        <input
          type="text"
          className="input"
          placeholder="Buscar cliente por nombre, email o teléfono..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {isLoading ? (
          <div className="p-4">
            <div className="animate-pulse space-y-4">
              <div className="h-5 bg-gray-200 rounded"></div>
              <div className="h-5 bg-gray-200 rounded"></div>
              <div className="h-5 bg-gray-200 rounded"></div>
            </div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-500 mb-4">No se encontraron clientes.</p>
            <button
              className="btn-primary"
              onClick={() => navigate('/clients/new')}
            >
              Agregar Nuevo Cliente
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deuda</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado del Alma</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Acciones</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredClients.map((client) => (
                <tr 
                  key={client.id} 
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/clients/${client.id}`)}
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{client.name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-500">{client.phone}</div>
                    <div className="text-sm text-gray-500">{client.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-red-600">
                      ${client.debt.toLocaleString('es-CO')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-1">
                      {client.soul && (
                        <>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            client.soul.relationship > 70 ? 'bg-green-100 text-green-800' :
                            client.soul.relationship > 40 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            R:{client.soul.relationship}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            client.soul.probability > 70 ? 'bg-green-100 text-green-800' :
                            client.soul.probability > 40 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            P:{client.soul.probability}
                          </span>
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button 
                      className="text-primary-600 hover:text-primary-900 mr-3"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/conversation/new/${client.id}`);
                      }}
                    >
                      Iniciar Conversación
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ClientList;