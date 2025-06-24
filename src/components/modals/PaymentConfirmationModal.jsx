// src/components/modals/PaymentConfirmationModal.jsx
import React, { useState } from 'react';
import { updateClientDebt } from '../../firebase/clients';

const PaymentConfirmationModal = ({ 
  isOpen, 
  onClose, 
  clientId, 
  clientName, 
  currentDebt,
  onPaymentConfirmed 
}) => {
  const [paymentData, setPaymentData] = useState({
    amountPaid: '',
    paymentType: 'complete', // 'complete' o 'partial'
    notes: ''
  });
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Calcular deuda restante
  const amountPaid = parseFloat(paymentData.amountPaid) || 0;
  const remainingDebt = Math.max(0, currentDebt - amountPaid);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setPaymentData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Limpiar errores al cambiar inputs
  };

  const handlePaymentTypeChange = (e) => {
    const type = e.target.value;
    setPaymentData(prev => ({
      ...prev,
      paymentType: type,
      // Si es pago completo, pre-llenar con la deuda total
      amountPaid: type === 'complete' ? currentDebt.toString() : prev.amountPaid
    }));
  };

  const validateForm = () => {
    if (!paymentData.amountPaid || amountPaid <= 0) {
      setError('El monto pagado debe ser mayor a 0');
      return false;
    }
    
    if (amountPaid > currentDebt) {
      setError('El monto pagado no puede ser mayor a la deuda actual');
      return false;
    }
    
    return true;
  };

  const handleConfirmPayment = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Información del pago para el historial
      const paymentInfo = {
        amount: amountPaid,
        type: paymentData.paymentType,
        notes: paymentData.notes,
        previousDebt: currentDebt,
        remainingDebt: remainingDebt
      };

      // Actualizar la deuda del cliente
      await updateClientDebt(clientId, remainingDebt, paymentInfo);

      // Notificar al componente padre
      if (onPaymentConfirmed) {
        onPaymentConfirmed({
          amountPaid,
          remainingDebt,
          paymentType: paymentData.paymentType,
          notes: paymentData.notes
        });
      }

      // Limpiar formulario y cerrar modal
      setPaymentData({
        amountPaid: '',
        paymentType: 'complete',
        notes: ''
      });
      
      onClose();
      
    } catch (error) {
      console.error('Error al procesar el pago:', error);
      setError(`Error al procesar el pago: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setPaymentData({
      amountPaid: '',
      paymentType: 'complete',
      notes: ''
    });
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">
            Confirmar Pago
          </h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={isProcessing}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleConfirmPayment} className="space-y-4">
          {/* Información del cliente */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-medium text-gray-800">Cliente: {clientName}</h3>
            <p className="text-sm text-gray-600">
              Deuda actual: ${currentDebt.toLocaleString('es-CO')} COP
            </p>
          </div>

          {/* Tipo de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Pago
            </label>
            <select
              name="paymentType"
              value={paymentData.paymentType}
              onChange={handlePaymentTypeChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            >
              <option value="complete">Pago Completo</option>
              <option value="partial">Pago Parcial</option>
            </select>
          </div>

          {/* Monto pagado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monto Pagado (COP)
            </label>
            <input
              type="number"
              name="amountPaid"
              value={paymentData.amountPaid}
              onChange={handleInputChange}
              placeholder="Ingrese el monto pagado"
              min="0"
              max={currentDebt}
              step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
              required
            />
          </div>

          {/* Cálculo de deuda restante */}
          {paymentData.amountPaid && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex justify-between text-sm">
                <span>Deuda actual:</span>
                <span>${currentDebt.toLocaleString('es-CO')} COP</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Monto a pagar:</span>
                <span>-${amountPaid.toLocaleString('es-CO')} COP</span>
              </div>
              <div className="border-t border-blue-200 mt-2 pt-2">
                <div className="flex justify-between font-medium">
                  <span>Deuda restante:</span>
                  <span className={remainingDebt === 0 ? 'text-green-600' : 'text-gray-800'}>
                    ${remainingDebt.toLocaleString('es-CO')} COP
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notas adicionales */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notas Adicionales (Opcional)
            </label>
            <textarea
              name="notes"
              value={paymentData.notes}
              onChange={handleInputChange}
              placeholder="Ej: Pago realizado por transferencia bancaria, fecha de próximo abono..."
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
          </div>

          {/* Mensaje de error */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Botones de acción */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
              disabled={isProcessing}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
              disabled={isProcessing || !paymentData.amountPaid}
            >
              {isProcessing ? 'Procesando...' : 'Confirmar Pago'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentConfirmationModal;