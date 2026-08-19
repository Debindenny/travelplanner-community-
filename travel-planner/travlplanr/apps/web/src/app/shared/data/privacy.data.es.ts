// Traducción borrador (no revisada legalmente) de privacy.data.ts.
// Generada automáticamente para dar cobertura en español; debe ser revisada
// por un profesional legal antes de tratarse como texto contractual definitivo.
import { TermsSection } from '../models/terms.models';

export const PRIVACY_LAST_UPDATED_ES = '01.07.2026';
export const PRIVACY_EFFECTIVE_DATE_ES = '1 de julio de 2026';

export const PRIVACY_INTRO_ES =
  '¡Bienvenido a Travl Planr! Esta Política de Privacidad describe cómo recopilamos, usamos, protegemos y compartimos tu información cuando usas nuestra plataforma de planificación de viajes impulsada por IA. Nos comprometemos a mantener tus datos seguros y a ser transparentes. Lee esto detenidamente para entender tus derechos y nuestras prácticas.';

export const PRIVACY_SECTIONS_ES: TermsSection[] = [
  {
    id: 'information-we-collect',
    title: '1. Información que Recopilamos',
    leadText: 'Recopilamos los siguientes datos para mejorar tu experiencia de planificación:',
    bullets: [
      'Datos que proporcionas: Cuando creas una cuenta o guardas un viaje, podemos recopilar tu nombre, correo electrónico, número de teléfono y preferencias de viaje (por ejemplo, destino, fechas de viaje, tamaño del grupo, preferencias de comida).',
      'Datos de chat y voz: Los mensajes que envías a nuestro asistente de viaje y las grabaciones de audio cuando usas el asistente de voz se recopilan y procesan (incluso por proveedores de IA externos; consulta la Sección 3) para generar respuestas e itinerarios. Las grabaciones de voz se transcriben a texto con este fin.',
      'Datos automáticos: Recopilamos detalles técnicos como el tipo de dispositivo, navegador, dirección IP, interacciones en el sitio y ubicación aproximada (si está habilitada) para personalizar itinerarios y mejorar el rendimiento.',
      'Sin datos financieros: No recopilamos ni almacenamos información de pago o tarjetas de crédito, ya que todas las reservas se realizan en sitios de socios (por ejemplo, TravelNext y Tripadvisor).',
    ],
  },
  {
    id: 'how-we-use-data',
    title: '2. Cómo Usamos Tus Datos',
    leadText: 'Tu información nos ayuda a:',
    bullets: [
      'Generar itinerarios personalizados usando nuestra IA según tus preferencias.',
      'Habilitar personalizaciones en tiempo real, como cambiar el transporte o editar actividades.',
      'Almacenar y gestionar tus planes de viaje guardados para acceso futuro.',
      'Enviar actualizaciones opcionales, consejos de viaje o notificaciones de soporte (puedes darte de baja en cualquier momento).',
    ],
  },
  {
    id: 'sharing-with-partners',
    title: '3. Compartir con Socios Externos',
    bullets: [
      'Cuando haces clic en "Reservar ahora", eres redirigido a socios de confianza (por ejemplo, TravelNext y Tripadvisor) para las reservas.',
      'Tus datos de reserva y pago son gestionados únicamente por estos socios, sujetos a sus políticas de privacidad.',
      'No recibimos, almacenamos ni procesamos tus datos financieros y no tenemos acceso a tu historial de reservas.',
      'Socios de procesamiento de IA: Para generar itinerarios y respuestas de chat, tus mensajes y datos de viaje se envían a uno o más proveedores de IA (Groq, Google Gemini, Anthropic y/o nuestra propia instancia autoalojada de Ollama), según cuál esté disponible en cada momento. Estos proveedores procesan el texto (y, en el caso de voz, el audio transcrito) únicamente para generar una respuesta; consulta sus respectivas políticas de privacidad para saber cómo gestionan los datos en su extremo.',
    ],
  },
  {
    id: 'cookies-tracking',
    title: '4. Cookies y Seguimiento',
    bullets: [
      'Usamos cookies para mantener tu sesión iniciada y recordar tus preferencias. Si añadimos herramientas de análisis de terceros en el futuro, esta política se actualizará para nombrarlas antes de que entren en funcionamiento.',
      'Puedes gestionar las preferencias de cookies a través de la configuración de tu navegador o contactándonos para excluirte del seguimiento no esencial.',
    ],
  },
  {
    id: 'data-security',
    title: '5. Seguridad de los Datos',
    bullets: [
      'Todas las transferencias de datos están protegidas con HTTPS (cifrado SSL) para proteger tu información.',
      'Aplicamos controles internos estrictos, incluidas políticas de acceso limitado, para salvaguardar tus datos.',
      'No vendemos, alquilamos ni compartimos tu información personal con anunciantes. Solo se comparte según lo descrito en la Sección 3 (redirecciones a socios de reserva y socios de procesamiento de IA).',
    ],
  },
  {
    id: 'privacy-choices',
    title: '6. Tus Opciones de Privacidad',
    leadText: 'Tienes control sobre tus datos:',
    bullets: [
      'Editar o eliminar: Actualiza o elimina tus datos personales y viajes guardados a través de la configuración de tu cuenta.',
      'Exclusión voluntaria: Date de baja de correos o notificaciones no esenciales usando el enlace de cancelación de suscripción en nuestros mensajes.',
      'Eliminación de datos: Solicita la eliminación completa de tus datos enviando un correo a privacy@travlplanr.com. Procesaremos tu solicitud salvo que estemos legalmente obligados a conservar ciertos datos (por ejemplo, por motivos de cumplimiento).',
    ],
  },
  {
    id: 'age-restrictions',
    title: '7. Restricciones de Edad',
    bullets: [
      'Travl Planr está diseñado para usuarios de 16 años o más.',
      'No recopilamos conscientemente datos de menores de 16 años. Si detectamos tales datos, los eliminaremos y notificaremos al padre, madre o tutor.',
    ],
  },
  {
    id: 'legal-compliance',
    title: '8. Cumplimiento Legal y Actualizaciones',
    bullets: [
      'Cumplimos con las leyes de privacidad aplicables, incluida la Ley de Protección de Datos Personales Digitales de la India de 2023, y los estándares internacionales cuando corresponda (por ejemplo, RGPD para usuarios de la UE, CCPA para residentes de California).',
      'Esta política puede actualizarse para reflejar cambios en nuestros servicios o requisitos legales. Las actualizaciones significativas se comunicarán por correo electrónico o mediante un aviso en nuestro sitio.',
      'La política está disponible en el pie de página, la configuración de la cuenta y páginas clave (por ejemplo, durante la creación de la cuenta).',
    ],
  },
  {
    id: 'contact-support',
    title: '9. Contacto y Soporte',
    leadText: '¿Tienes preguntas o necesitas ayuda?',
    contactLines: ['privacy@travlplanr.com', 'TravlPlanR Private Limited, Coimbatore, India'],
  },
];
