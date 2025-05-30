import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

// Registro de usuario con dirección
export const registerUser = async (email, password, displayName, role = 'agent', address = '') => {
  try {
    // Validar que se proporcione la dirección
    if (!address.trim()) {
      throw new Error('La dirección de residencia es obligatoria');
    }

    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Actualizar el displayName en el perfil de Auth
    await updateProfile(user, { displayName });
    
    // Crear documento de usuario en Firestore con dirección
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email,
      displayName,
      role,
      address: address.trim(), // Agregar dirección
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    console.log('Usuario registrado exitosamente con dirección:', address.trim());
    return user;
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    throw error;
  }
};

// Inicio de sesión
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Actualizar último login
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    return userCredential.user;
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    throw error;
  }
};

// Cerrar sesión
export const logoutUser = async () => {
  return signOut(auth);
};

// Obtener datos completos del usuario desde Firestore (incluye dirección)
export const getUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData;
    }
    return null;
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    throw error;
  }
};

// Actualizar datos del usuario (incluye dirección)
export const updateUserData = async (uid, updatedData) => {
  try {
    // Validar que no se actualicen campos críticos
    const allowedFields = ['displayName', 'address', 'phone', 'notes'];
    const filteredData = {};
    
    Object.keys(updatedData).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredData[key] = updatedData[key];
      }
    });
    
    // Agregar timestamp de actualización
    filteredData.updatedAt = serverTimestamp();
    
    await setDoc(doc(db, 'users', uid), filteredData, { merge: true });
    
    console.log('Datos del usuario actualizados exitosamente');
    return true;
  } catch (error) {
    console.error('Error al actualizar datos del usuario:', error);
    throw error;
  }
};

// Restablecer contraseña
export const resetPassword = async (email) => {
  return sendPasswordResetEmail(auth, email);
};

// Obtener perfil completo del usuario con validación
export const getUserProfile = async (uid) => {
  try {
    const userData = await getUserData(uid);
    
    if (!userData) {
      throw new Error('Usuario no encontrado en la base de datos');
    }
    
    // Verificar si tiene todos los campos requeridos
    const requiredFields = ['displayName', 'email', 'role'];
    const missingFields = requiredFields.filter(field => !userData[field]);
    
    if (missingFields.length > 0) {
      console.warn('Campos faltantes en el perfil del usuario:', missingFields);
    }
    
    return {
      ...userData,
      hasCompleteProfile: missingFields.length === 0 && userData.address?.trim(),
      missingFields
    };
  } catch (error) {
    console.error('Error al obtener perfil del usuario:', error);
    throw error;
  }
};

// Validar integridad del perfil de usuario
export const validateUserProfile = async (uid) => {
  try {
    const profile = await getUserProfile(uid);
    
    const validationResult = {
      isValid: profile.hasCompleteProfile,
      missingFields: profile.missingFields || [],
      warnings: []
    };
    
    // Verificar dirección específicamente
    if (!profile.address || !profile.address.trim()) {
      validationResult.warnings.push('La dirección de residencia no está registrada');
      validationResult.missingFields.push('address');
      validationResult.isValid = false;
    }
    
    // Verificar otros campos opcionales pero recomendados
    if (!profile.phone) {
      validationResult.warnings.push('El teléfono no está registrado (opcional)');
    }
    
    return validationResult;
  } catch (error) {
    console.error('Error al validar perfil del usuario:', error);
    return {
      isValid: false,
      missingFields: ['all'],
      warnings: ['Error al validar el perfil'],
      error: error.message
    };
  }
};