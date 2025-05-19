import { useState } from 'react';

const ConversationFilter = ({ onFilterChange }) => {
  const [activeFilter, setActiveFilter] = useState('newest');

  const handleFilterChange = (filter) => {
    setActiveFilter(filter);
    onFilterChange(filter);
  };

  return (
    <div className="flex space-x-2 mb-4">
      <button
        className={`px-3 py-1 text-sm rounded-full ${
          activeFilter === 'newest' 
            ? 'bg-primary-100 text-primary-800' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        onClick={() => handleFilterChange('newest')}
      >
        Más recientes
      </button>
      <button
        className={`px-3 py-1 text-sm rounded-full ${
          activeFilter === 'upcoming' 
            ? 'bg-primary-100 text-primary-800' 
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
        onClick={() => handleFilterChange('upcoming')}
      >
        Próxima fecha
      </button>
    </div>
  );
};

export default ConversationFilter;