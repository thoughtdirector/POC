import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './config';

// Registro de usuario
export const registerUser = async (email, password, displayName, role = 'agent') => {
  try {
    // Crear usuario en Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Actualizar el displayName
    await updateProfile(user, { displayName });
    
    // Crear documento de usuario en Firestore
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email,
      displayName,
      role,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp()
    });
    
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
      lastLogin: serverTimestamp()
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

// Obtener datos completos del usuario desde Firestore
export const getUserData = async (uid) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data();
    }
    return null;
  } catch (error) {
    console.error('Error al obtener datos del usuario:', error);
    throw error;
  }
};

// Restablecer contraseña
export const resetPassword = async (email) => {
  return sendPasswordResetEmail(auth, email);
};