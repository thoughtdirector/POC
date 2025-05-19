import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import { v4 as uuidv4 } from 'uuid';

// Colecciones
const clientsCollection = collection(db, 'clients');

// Crear un nuevo cliente
export const createClient = async (clientData) => {
  const clientId = uuidv4();
  const clientRef = doc(db, 'clients', clientId);
  
  // Valores para el alma del cliente
  const soulVariables = {
    relationship: clientData.relationship || 50, // Relación/Cercanía
    history: clientData.history || 50, // Historial de Pago
    attitude: clientData.attitude || 50, // Actitud en la Llamada
    sensitivity: clientData.sensitivity || 50, // Sensibilidad a Presión
    probability: clientData.probability || 50 // Probabilidad de Pago
  };
  
  await setDoc(clientRef, {
    id: clientId,
    name: clientData.name,
    email: clientData.email || '',
    phone: clientData.phone || '',
    debt: Number(clientData.debt) || 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    soul: soulVariables,
    status: 'active',
    tags: clientData.tags || [],
    notes: clientData.notes || '',
    lastContact: null,
    paymentHistory: []
  });
  
  return clientId;
};

// Obtener un cliente por ID
export const getClientById = async (clientId) => {
  const clientDoc = await getDoc(doc(db, 'clients', clientId));
  if (clientDoc.exists()) {
    return { id: clientDoc.id, ...clientDoc.data() };
  }
  return null;
};

// Obtener todos los clientes
export const getAllClients = async () => {
  const snapshot = await getDocs(
    query(clientsCollection, orderBy('name', 'asc'))
  );
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Actualizar variables del alma de un cliente
export const updateClientSoul = async (clientId, soulUpdates) => {
  const clientRef = doc(db, 'clients', clientId);
  const clientDoc = await getDoc(clientRef);
  
  if (!clientDoc.exists()) {
    throw new Error('Cliente no encontrado');
  }
  
  const currentSoul = clientDoc.data().soul;
  
  // Función para mantener el valor entre 0 y 100
  const clamp = (value) => Math.min(Math.max(value, 0), 100);
  
  // Actualizar cada variable con el nuevo delta
  const updatedSoul = {
    relationship: clamp(currentSoul.relationship + (soulUpdates.relationship || 0)),
    history: clamp(currentSoul.history + (soulUpdates.history || 0)),
    attitude: clamp(currentSoul.attitude + (soulUpdates.attitude || 0)),
    sensitivity: clamp(currentSoul.sensitivity + (soulUpdates.sensitivity || 0)),
    probability: clamp(currentSoul.probability + (soulUpdates.probability || 0))
  };
  
  await updateDoc(clientRef, { 
    soul: updatedSoul,
    updatedAt: serverTimestamp() 
  });
  
  return updatedSoul;
};

// Actualizar directamente las variables del alma (sin deltas)
export const setClientSoul = async (clientId, soulValues) => {
  const clientRef = doc(db, 'clients', clientId);
  const clientDoc = await getDoc(clientRef);
  
  if (!clientDoc.exists()) {
    throw new Error('Cliente no encontrado');
  }
  
  // Función para mantener el valor entre 0 y 100
  const clamp = (value) => Math.min(Math.max(value, 0), 100);
  
  // Establecer los valores directamente
  const updatedSoul = {
    relationship: clamp(soulValues.relationship || 50),
    history: clamp(soulValues.history || 50),
    attitude: clamp(soulValues.attitude || 50),
    sensitivity: clamp(soulValues.sensitivity || 50),
    probability: clamp(soulValues.probability || 50)
  };
  
  await updateDoc(clientRef, { 
    soul: updatedSoul,
    updatedAt: serverTimestamp() 
  });
  
  return updatedSoul;
};

// Buscar clientes por texto
export const searchClients = async (searchText) => {
  if (!searchText || searchText.trim() === '') {
    return getAllClients();
  }
  
  const search = searchText.toLowerCase().trim();
  
  // Debido a las limitaciones de Firestore para búsquedas de texto,
  // hacemos la búsqueda del lado del cliente
  const snapshot = await getDocs(clientsCollection);
  const allClients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  return allClients.filter(client => 
    client.name.toLowerCase().includes(search) ||
    (client.email && client.email.toLowerCase().includes(search)) ||
    (client.phone && client.phone.includes(search))
  );
};

// Actualizar datos básicos del cliente
export const updateClient = async (clientId, updatedData) => {
  const clientRef = doc(db, 'clients', clientId);
  const clientDoc = await getDoc(clientRef);
  
  if (!clientDoc.exists()) {
    throw new Error('Cliente no encontrado');
  }
  
  // No permitimos actualizar el ID o las fechas de creación
  delete updatedData.id;
  delete updatedData.createdAt;
  
  await updateDoc(clientRef, {
    ...updatedData,
    updatedAt: serverTimestamp()
  });
  
  return clientId;
};

// Actualizar el estado de la deuda del cliente
export const updateClientDebt = async (clientId, newDebtAmount, paymentInfo = null) => {
  const clientRef = doc(db, 'clients', clientId);
  const clientDoc = await getDoc(clientRef);
  
  if (!clientDoc.exists()) {
    throw new Error('Cliente no encontrado');
  }
  
  const client = clientDoc.data();
  const updateData = { 
    debt: Number(newDebtAmount),
    updatedAt: serverTimestamp() 
  };
  
  // Si se proporciona información de pago, la añadimos al historial
  if (paymentInfo) {
    updateData.paymentHistory = [
      ...client.paymentHistory || [],
      {
        date: serverTimestamp(),
        amount: paymentInfo.amount,
        type: paymentInfo.type || 'payment',
        notes: paymentInfo.notes || ''
      }
    ];
  }
  
  await updateDoc(clientRef, updateData);
  
  return clientId;
};

// Registrar contacto con el cliente
export const recordClientContact = async (clientId) => {
  const clientRef = doc(db, 'clients', clientId);
  await updateDoc(clientRef, {
    lastContact: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
};

// Obtener clientes con deuda
export const getClientsWithDebt = async (minDebt = 0) => {
  const snapshot = await getDocs(
    query(
      clientsCollection, 
      where('debt', '>', minDebt),
      where('status', '==', 'active'),
      orderBy('debt', 'desc')
    )
  );
  
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};