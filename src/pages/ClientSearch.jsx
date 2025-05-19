import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchClients } from '../firebase/clients';

const ClientSearch = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) return;
    
    setIsLoading(true);
    setHasSearched(true);
    
    try {
      const clients = await searchClients(searchTerm);
      setResults(clients);
    } catch (error) {
      console.error('Error al buscar clientes:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Buscar Cliente</h1>
      
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            className="input flex-grow"
            placeholder="Nombre, teléfono o email del cliente"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button 
            type="submit" 
            className="btn-primary"
            disabled={isLoading}
          >
            {isLoading ? 'Buscando...' : 'Buscar'}
          </button>
        </div>
      </form>
      
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Resultados</h2>
        
        {isLoading ? (
          <div className="animate-pulse space-y-4 py-4">
            <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            <div className="h-5 bg-gray-200 rounded w-1/2"></div>
            <div className="h-5 bg-gray-200 rounded w-5/6"></div>
          </div>
        ) : results.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            {hasSearched 
              ? "No se encontraron resultados. Intente con otros términos de búsqueda." 
              : "Ingrese un término de búsqueda para encontrar clientes."}
          </p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {results.map(client => (
              <li 
                key={client.id} 
                className="py-3 hover:bg-gray-50 cursor-pointer"
                onClick={() => navigate(`/clients/${client.id}`)}
              >
                <div className="flex justify-between">
                  <span className="font-medium">{client.name}</span>
                  <span className="text-red-600 font-medium">
                    ${client.debt.toLocaleString('es-CO')}
                  </span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {client.phone} {client.email && `| ${client.email}`}
                </div>
                <div className="flex mt-2 space-x-2">
                  <button 
                    className="text-sm text-primary-600 hover:text-primary-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/clients/${client.id}`);
                    }}
                  >
                    Ver detalles
                  </button>
                  <button 
                    className="text-sm text-primary-600 hover:text-primary-800"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/conversation/new/${client.id}`);
                    }}
                  >
                    Iniciar conversación
                  </button>
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

export default ClientSearch;