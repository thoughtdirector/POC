import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../firebase/auth';

const Register = () => {
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    passwordConfirm: '',
    address: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validación
    if (formData.password !== formData.passwordConfirm) {
      return setError('Las contraseñas no coinciden');
    }
    
    if (formData.password.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres');
    }

    if (!formData.displayName.trim()) {
      return setError('El nombre completo es obligatorio');
    }

    if (!formData.address.trim()) {
      return setError('La dirección de residencia es obligatoria');
    }
    
    try {
      setError('');
      setLoading(true);
      await registerUser(
        formData.email, 
        formData.password, 
        formData.displayName,
        'agent', // rol por defecto
        formData.address // agregar dirección
      );
      navigate('/');
    } catch (err) {
      console.error('Error al registrar:', err);
      setError(
        err.code === 'auth/email-already-in-use'
          ? 'Este correo ya está registrado'
          : err.message || 'Error al crear la cuenta. Intente nuevamente.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-xl shadow-2xl">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Crear nueva cuenta
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Complete el formulario para registrarse
          </p>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-1">
                Nombre completo *
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Nombre completo"
                value={formData.displayName}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                Email *
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Correo electrónico"
                value={formData.email}
                onChange={handleChange}
              />
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
                Dirección de residencia *
              </label>
              <textarea
                id="address"
                name="address"
                rows="3"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm resize-none"
                placeholder="Ingrese su dirección completa de residencia"
                value={formData.address}
                onChange={handleChange}
              />
              <p className="mt-1 text-xs text-gray-500">
                Incluya dirección completa: calle, número, barrio, ciudad
              </p>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Contraseña *
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Contraseña (mínimo 6 caracteres)"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
            
            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700 mb-1">
                Confirmar contraseña *
              </label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
                placeholder="Confirmar contraseña"
                value={formData.passwordConfirm}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creando cuenta...
                </span>
              ) : (
                'Registrarse'
              )}
            </button>
          </div>
          
          <div className="text-center">
            <Link to="/login" className="text-sm text-primary-600 hover:text-primary-500">
              ¿Ya tiene una cuenta? Inicie sesión
            </Link>
          </div>
        </form>

        <div className="mt-4 text-xs text-gray-500 text-center">
          <p className="mb-2">Al registrarse, usted acepta nuestros términos y condiciones.</p>
          <p>Los campos marcados con * son obligatorios.</p>
        </div>
      </div>
    </div>
  );
};

export default Register;