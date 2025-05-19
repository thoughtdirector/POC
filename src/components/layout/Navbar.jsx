import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { logoutUser } from '../../firebase/auth';

const Navbar = () => {
  const { currentUser, userDetails } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };
  
  return (
    <nav className="bg-white p-4 shadow">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <span className="text-lg font-semibold text-gray-700">
            Sistema de Cobranza Adaptativa
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          {currentUser && (
            <>
              <span className="text-sm text-gray-600">
                {userDetails?.displayName || currentUser.email}
              </span>
              
              <button 
                className="text-sm text-gray-600 hover:text-gray-900"
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;