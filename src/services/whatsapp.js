export const sendWhatsappMessage = (number, message) => {
    // Redirige a la URL de WhatsApp con el número y el mensaje
    window.open(`https://wa.me/57${number}?text=${encodeURIComponent(message)}`, '_blank');
}
