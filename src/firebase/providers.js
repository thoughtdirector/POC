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
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./config";
import { v4 as uuidv4 } from "uuid";

// Colecciones
const providersCollection = collection(db, "providers");

// Crear un nuevo proveedor (No se usa pero por si acaso)
export const createProvider = async (providerData) => {
  const providerId = uuidv4();
  const providerRef = doc(db, "providers", providerId);

  /**
   * providerData schema
   * {
   *   name: string,
   *   address: string,
   *   bank_information: string
   * }
   */

  await setDoc(providerRef, {
    id: providerId,
    name: providerData.name,
    address: providerData.address,
    bank_information: providerData.bankInformation,
  });
};

// Obtener un proveedor por ID
export const getProviderById = async (providerId) => {
  if (!providerId) return null;
  const providerRef = doc(db, "providers", providerId);
  const providerDoc = await getDoc(providerRef);
  return providerDoc.exists()
    ? { id: providerDoc.id, ...providerDoc.data() }
    : null;
};

// Obtener todos los proveedores
export const getAllProviders = async () => {
  const snapshot = await getDocs(
    query(providersCollection, orderBy("name", "asc"))
  );
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};

// Actualizar un proveedor
export const updateProvider = async (providerId, updatedData) => {
  const providerRef = doc(db, "providers", providerId);
  const providerDoc = await getDoc(providerRef);

  if (!providerDoc.exists()) throw new Error("Proveedor no encontrado");

  await updateDoc(providerRef, {
    name: updatedData.name,
    address: updatedData.address,
    bank_information: updatedData.bankInformation,
  });

  return providerId;
};
