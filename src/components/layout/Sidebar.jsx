import { NavLink } from 'react-router-dom';
import { FaHome, FaUserFriends, FaComments, FaChartLine, FaCog, FaRobot } from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';

const Sidebar = () => {
  const { isAdmin } = useAuth();
  
  return (
    <div className="bg-gray-800 text-white w-64 flex-shrink-0 hidden md:block">
      <div className="p-4">
        <h2 className="text-xl font-bold">Acriventas</h2>
      </div>
      
      <nav className="mt-8">
        <NavLink 
          to="/" 
          className={({ isActive }) => 
            `flex items-center py-2 px-4 ${
              isActive ? 'bg-gray-700' : 'hover:bg-gray-700'
            }`
          }
          end
        >
          <FaHome className="mr-3" />
          Dashboard
        </NavLink>
        
        <NavLink 
          to="/clients" 
          className={({ isActive }) => 
            `flex items-center py-2 px-4 ${
              isActive ? 'bg-gray-700' : 'hover:bg-gray-700'
            }`
          }
        >
          <FaUserFriends className="mr-3" />
          Clientes
        </NavLink>
        
        <NavLink 
          to="/conversations" 
          className={({ isActive }) => 
            `flex items-center py-2 px-4 ${
              isActive ? 'bg-gray-700' : 'hover:bg-gray-700'
            }`
          }
        >
          <FaComments className="mr-3" />
          Conversaciones
        </NavLink>
        
        <NavLink 
          to="/reports" 
          className={({ isActive }) => 
            `flex items-center py-2 px-4 ${
              isActive ? 'bg-gray-700' : 'hover:bg-gray-700'
            }`
          }
        >
          <FaChartLine className="mr-3" />
          Reportes
        </NavLink>
        
        <NavLink 
  to="/settings/ai" 
  className={({ isActive }) => 
    `flex items-center py-2 px-4 ${
      isActive ? 'bg-gray-700' : 'hover:bg-gray-700'
    }`
  }
>
  <FaRobot className="mr-3" /> 
  Configuración IA
    </NavLink>



        {isAdmin && (
          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              `flex items-center py-2 px-4 ${
                isActive ? 'bg-gray-700' : 'hover:bg-gray-700'
              }`
            }
          >
            <FaCog className="mr-3" />
            Configuración
          </NavLink>
        )}
      </nav>
    </div>
  );
};

export default Sidebar;