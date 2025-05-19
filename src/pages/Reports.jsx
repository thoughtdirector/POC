import { useState, useEffect } from 'react';
import { getActiveConversations, getClosedConversations } from '../firebase/conversations';
import { getAllClients } from '../firebase/clients';

const Reports = () => {
  const [activeConversations, setActiveConversations] = useState([]);
  const [closedConversations, setClosedConversations] = useState([]);
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        
        // Cargar datos para los reportes
        const [activeConvs, closedConvs, clientsList] = await Promise.all([
          getActiveConversations(null, 100),
          getClosedConversations(null, 100),
          getAllClients()
        ]);
        
        setActiveConversations(activeConvs);
        setClosedConversations(closedConvs);
        setClients(clientsList);
      } catch (error) {
        console.error('Error al cargar datos para reportes:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);
  
  // Estadísticas de conversaciones
  const totalConversations = activeConversations.length + closedConversations.length;
  const conversationStats = {
    active: activeConversations.length,
    closed: closedConversations.length,
    payment: closedConversations.filter(c => c.summary?.result === 'payment').length,
    partialPayment: closedConversations.filter(c => c.summary?.result === 'partial_payment').length,
    promise: closedConversations.filter(c => c.summary?.result === 'promise').length,
    noPayment: closedConversations.filter(c => c.summary?.result === 'no_payment').length
  };
  
  // Estadísticas de clientes
  const clientStats = {
    total: clients.length,
    withDebt: clients.filter(c => c.debt > 0).length,
    totalDebt: clients.reduce((sum, client) => sum + (client.debt || 0), 0),
    highProbability: clients.filter(c => c.soul?.probability >= 70).length,
    mediumProbability: clients.filter(c => c.soul?.probability >= 40 && c.soul?.probability < 70).length,
    lowProbability: clients.filter(c => c.soul?.probability < 40).length
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Reportes</h1>
        <div className="animate-pulse space-y-6">
          <div className="h-40 bg-gray-200 rounded"></div>
          <div className="h-40 bg-gray-200 rounded"></div>
          <div className="h-60 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Reportes</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Estadísticas de conversaciones */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Estadísticas de Conversaciones</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-1">Activas</h3>
              <p className="text-2xl font-bold text-blue-600">{conversationStats.active}</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-green-800 mb-1">Cerradas</h3>
              <p className="text-2xl font-bold text-green-600">{conversationStats.closed}</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-green-800 mb-1">Pagos completos</h3>
              <p className="text-2xl font-bold text-green-600">{conversationStats.payment}</p>
              <p className="text-xs text-green-600">
                {totalConversations > 0 ? Math.round((conversationStats.payment / totalConversations) * 100) : 0}% del total
              </p>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Pagos parciales</h3>
              <p className="text-2xl font-bold text-yellow-600">{conversationStats.partialPayment}</p>
              <p className="text-xs text-yellow-600">
                {totalConversations > 0 ? Math.round((conversationStats.partialPayment / totalConversations) * 100) : 0}% del total
              </p>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Promesas de pago</h3>
              <p className="text-2xl font-bold text-yellow-600">{conversationStats.promise}</p>
              <p className="text-xs text-yellow-600">
                {totalConversations > 0 ? Math.round((conversationStats.promise / totalConversations) * 100) : 0}% del total
              </p>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-red-800 mb-1">Sin pago</h3>
              <p className="text-2xl font-bold text-red-600">{conversationStats.noPayment}</p>
              <p className="text-xs text-red-600">
                {totalConversations > 0 ? Math.round((conversationStats.noPayment / totalConversations) * 100) : 0}% del total
              </p>
            </div>
          </div>
        </div>
        
        {/* Estadísticas de clientes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Estadísticas de Clientes</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-800 mb-1">Total de clientes</h3>
              <p className="text-2xl font-bold text-blue-600">{clientStats.total}</p>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-red-800 mb-1">Con deuda</h3>
              <p className="text-2xl font-bold text-red-600">{clientStats.withDebt}</p>
              <p className="text-xs text-red-600">
                {clientStats.total > 0 ? Math.round((clientStats.withDebt / clientStats.total) * 100) : 0}% del total
              </p>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg col-span-2">
              <h3 className="text-sm font-medium text-red-800 mb-1">Deuda total</h3>
              <p className="text-2xl font-bold text-red-600">
                ${clientStats.totalDebt.toLocaleString('es-CO')}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-green-800 mb-1">Alta probabilidad de pago</h3>
              <p className="text-2xl font-bold text-green-600">{clientStats.highProbability}</p>
              <p className="text-xs text-green-600">
                {clientStats.total > 0 ? Math.round((clientStats.highProbability / clientStats.total) * 100) : 0}% del total
              </p>
            </div>
            
            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-yellow-800 mb-1">Media probabilidad</h3>
              <p className="text-2xl font-bold text-yellow-600">{clientStats.mediumProbability}</p>
              <p className="text-xs text-yellow-600">
                {clientStats.total > 0 ? Math.round((clientStats.mediumProbability / clientStats.total) * 100) : 0}% del total
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Top clientes con mayor deuda */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">Top 10 Clientes con Mayor Deuda</h2>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deuda</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Probabilidad de Pago</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Última Conversación</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {clients
                .sort((a, b) => b.debt - a.debt)
                .slice(0, 10)
                .map(client => (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-gray-900">{client.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-red-600">
                        ${client.debt.toLocaleString('es-CO')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${
                        client.soul?.probability >= 70 ? 'text-green-600' :
                        client.soul?.probability >= 40 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {client.soul?.probability || 0}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {client.lastContact ? new Date(client.lastContact.seconds * 1000).toLocaleDateString() : 'Sin contacto'}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;