import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from './config';

const clientsCollection = collection(db, 'clients');

// Crear nuevo cliente
export const createClient = async (clientData) => {
  const newClient = {
    ...clientData,
    debt: Number(clientData.debt) || 0,
    status: 'active',
    soul: clientData.soul || {
      relationship: 50,
      history: 50,
      attitude: 50,
      sensitivity: 50,
      probability: 50
    },
    paymentHistory: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(clientsCollection, newClient);
  return docRef.id;
};

// Obtener cliente por ID
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
  const allClients = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

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

// Actualizar el estado de la deuda del cliente (función mejorada)
export const updateClientDebt = async (
  clientId,
  newDebtAmount,
  paymentInfo = null
) => {
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
    const paymentRecord = {
      id: `payment-${Date.now()}`, // ID único para el pago
      date: serverTimestamp(),
      amount: Number(paymentInfo.amount),
      type: paymentInfo.type || 'payment', // 'complete', 'partial'
      notes: paymentInfo.notes || '',
      previousDebt: Number(paymentInfo.previousDebt || client.debt || 0),
      remainingDebt: Number(newDebtAmount),
      processedBy: paymentInfo.processedBy || null // ID del agente que procesó
    };

    updateData.paymentHistory = [
      ...(client.paymentHistory || []),
      paymentRecord
    ];

    // Actualizar fecha de último pago
    updateData.lastPayment = serverTimestamp();
    
    // Si la deuda queda en 0, marcar como pagado
    if (Number(newDebtAmount) === 0) {
      updateData.status = 'paid';
      updateData.paidAt = serverTimestamp();
    }
  }

  await updateDoc(clientRef, updateData);

  return {
    clientId,
    newDebt: Number(newDebtAmount),
    paymentProcessed: !!paymentInfo
  };
};

// Nueva función para obtener historial de pagos de un cliente
export const getClientPaymentHistory = async (clientId) => {
  const clientRef = doc(db, 'clients', clientId);
  const clientDoc = await getDoc(clientRef);

  if (!clientDoc.exists()) {
    throw new Error('Cliente no encontrado');
  }

  const client = clientDoc.data();
  return client.paymentHistory || [];
};

// Nueva función para calcular estadísticas de pagos de un cliente
export const getClientPaymentStats = async (clientId) => {
  const paymentHistory = await getClientPaymentHistory(clientId);
  
  if (paymentHistory.length === 0) {
    return {
      totalPaid: 0,
      numberOfPayments: 0,
      averagePayment: 0,
      lastPaymentDate: null
    };
  }

  const totalPaid = paymentHistory.reduce((sum, payment) => sum + payment.amount, 0);
  const lastPayment = paymentHistory[paymentHistory.length - 1];

  return {
    totalPaid,
    numberOfPayments: paymentHistory.length,
    averagePayment: totalPaid / paymentHistory.length,
    lastPaymentDate: lastPayment.date,
    lastPaymentAmount: lastPayment.amount
  };
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

// Eliminar cliente
export const deleteClient = async (clientId) => {
  await deleteDoc(doc(db, 'clients', clientId));
  return true;
};

// Obtener clientes por estado
export const getClientsByStatus = async (status) => {
  const snapshot = await getDocs(
    query(
      clientsCollection,
      where('status', '==', status),
      orderBy('name', 'asc')
    )
  );

  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

// Obtener estadísticas generales de clientes
export const getClientsStats = async () => {
  const snapshot = await getDocs(clientsCollection);
  const clients = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  const totalClients = clients.length;
  const activeClients = clients.filter(client => client.status === 'active').length;
  const paidClients = clients.filter(client => client.status === 'paid').length;
  const totalDebt = clients.reduce((sum, client) => sum + (client.debt || 0), 0);
  const averageDebt = totalClients > 0 ? totalDebt / totalClients : 0;

  return {
    totalClients,
    activeClients,
    paidClients,
    totalDebt,
    averageDebt,
    clientsWithDebt: clients.filter(client => (client.debt || 0) > 0).length
  };
};

// Exportar todas las funciones
export {
  // Funciones básicas CRUD
  createClient,
  getClientById,
  getAllClients,
  updateClient,
  deleteClient,
  
  // Funciones de búsqueda y filtrado
  searchClients,
  getClientsByStatus,
  getClientsWithDebt,
  
  // Funciones del alma
  updateClientSoul,
  setClientSoul,
  
  // Funciones de deuda y pagos
  updateClientDebt,
  getClientPaymentHistory,
  getClientPaymentStats,
  
  // Funciones de contacto y estadísticas
  recordClientContact,
  getClientsStats
};