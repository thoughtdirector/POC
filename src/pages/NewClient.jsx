import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createClient } from "../firebase/clients";
import { getAllProviders } from "../firebase/providers";
import SoulVariablesEditor from "../components/clients/SoulVariablesEditor";

const NewClient = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    debt: "",
    notes: "",
    provider_id: "",
  });

  const [soulValues, setSoulValues] = useState({
    relationship: 50,
    history: 50,
    attitude: 50,
    sensitivity: 50,
    probability: 50,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [providers, setProviders] = useState([]);

  const loadProviders = async () => {
    try {
      const providers = await getAllProviders();
      setProviders(providers);
    } catch (error) {
      console.error("Error al cargar proveedores:", error);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "debt" ? parseFloat(value) || "" : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validación básica
    if (!formData.name.trim()) {
      setError("El nombre del cliente es obligatorio");
      return;
    }

    if (!formData.phone.trim()) {
      setError("El teléfono es obligatorio");
      return;
    }

    if (isNaN(formData.debt) || formData.debt === "") {
      setError("Debe ingresar un monto de deuda válido");
      return;
    }

    try {
      setIsSubmitting(true);

      // Crear el cliente con los datos del formulario y las variables del alma
      const clientData = {
        ...formData,
        ...soulValues,
      };

      const clientId = await createClient(clientData);
      console.log("Cliente creado con ID:", clientId);

      // Redireccionar a la página del cliente
      navigate(`/clients/${clientId}`);
    } catch (err) {
      console.error("Error al crear el cliente:", err);
      setError(
        "Ocurrió un error al crear el cliente. Por favor, intente nuevamente."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Agregar Nuevo Cliente</h1>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6"
          role="alert"
        >
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-group">
            <label htmlFor="name" className="label">
              Nombre completo *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              className="input"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              className="input"
              value={formData.email}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="label">
              Teléfono *
            </label>
            <input
              type="text"
              id="phone"
              name="phone"
              className="input"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="debt" className="label">
              Monto de deuda *
            </label>
            <input
              type="number"
              id="debt"
              name="debt"
              className="input"
              value={formData.debt}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="provider" className="label">
              Proveedor
            </label>
            <select
              id="provider"
              name="provider_id"
              className="input"
              value={formData.provider_id}
              onChange={handleChange}
            >
              <option value="">Seleccionar proveedor</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group md:col-span-2">
            <label htmlFor="notes" className="label">
              Notas
            </label>
            <textarea
              id="notes"
              name="notes"
              rows="3"
              className="input"
              value={formData.notes}
              onChange={handleChange}
            ></textarea>
          </div>
        </div>

        <h3 className="text-lg font-semibold mt-8 mb-4">
          Variables del Alma del Cliente
        </h3>

        <SoulVariablesEditor
          initialValues={soulValues}
          onChange={setSoulValues}
        />

        <div className="flex justify-end gap-4 mt-8">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => navigate(-1)}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar Cliente"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NewClient;
