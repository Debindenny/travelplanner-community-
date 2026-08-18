// Traduction provisoire (non validée juridiquement) de privacy.data.ts.
// Générée automatiquement pour la couverture en français ; doit être relue
// par un professionnel du droit avant d'être considérée comme définitive.
import { TermsSection } from '../models/terms.models';

export const PRIVACY_LAST_UPDATED_FR = '01.07.2026';
export const PRIVACY_EFFECTIVE_DATE_FR = '1 juillet 2026';

export const PRIVACY_INTRO_FR =
  'Bienvenue sur Travl Planr ! Cette Politique de Confidentialité décrit comment nous collectons, utilisons, protégeons et partageons vos informations lorsque vous utilisez notre plateforme de planification de voyages basée sur l\'IA. Nous nous engageons à assurer la sécurité et la transparence de vos données. Merci de lire attentivement ce document pour comprendre vos droits et nos pratiques.';

export const PRIVACY_SECTIONS_FR: TermsSection[] = [
  {
    id: 'information-we-collect',
    title: '1. Informations que nous collectons',
    leadText: 'Nous recueillons les données suivantes pour améliorer votre expérience de planification :',
    bullets: [
      'Données que vous fournissez : Lorsque vous créez un compte ou enregistrez un voyage, nous pouvons collecter votre nom, adresse e-mail, numéro de téléphone et préférences de voyage (par exemple, destination, dates de voyage, taille du groupe, choix de repas).',
      'Données de chat et vocales : Les messages envoyés à notre assistant de voyage et les enregistrements audio lors de l\'utilisation de l\'assistant vocal sont collectés et traités (y compris par des fournisseurs d\'IA tiers — voir Section 3) pour générer des réponses et des itinéraires. Les enregistrements vocaux sont transcrits en texte à cette fin.',
      'Données automatiques : Nous collectons des détails techniques tels que le type d\'appareil, le navigateur, l\'adresse IP, les interactions sur le site et la localisation approximative (si activée) pour personnaliser les itinéraires et améliorer les performances.',
      'Aucune donnée financière : Nous ne collectons ni ne stockons d\'informations de paiement ou de carte bancaire, toutes les réservations ayant lieu sur les sites de partenaires (par exemple, TravelNext et Tripadvisor).',
    ],
  },
  {
    id: 'how-we-use-data',
    title: '2. Comment nous utilisons vos données',
    leadText: 'Vos informations nous aident à :',
    bullets: [
      'Générer des itinéraires personnalisés grâce à notre IA en fonction de vos préférences.',
      'Permettre des personnalisations en temps réel, comme changer de transport ou modifier des activités.',
      'Stocker et gérer vos plans de voyage enregistrés pour un accès futur.',
      'Envoyer des mises à jour facultatives, des conseils de voyage ou des notifications d\'assistance (vous pouvez vous désabonner à tout moment).',
    ],
  },
  {
    id: 'sharing-with-partners',
    title: '3. Partage avec des partenaires tiers',
    bullets: [
      'Lorsque vous cliquez sur « Réserver maintenant », vous êtes redirigé vers des partenaires de confiance (par exemple, TravelNext et Tripadvisor) pour les réservations.',
      'Vos données de réservation et de paiement sont gérées uniquement par ces partenaires, conformément à leurs politiques de confidentialité.',
      'Nous ne recevons, ne stockons ni ne traitons vos données financières et n\'avons pas accès à votre historique de réservation.',
      'Partenaires de traitement IA : Pour générer les itinéraires et les réponses de chat, vos messages et informations de voyage sont envoyés à un ou plusieurs fournisseurs d\'IA — Groq, Google Gemini, Anthropic et/ou notre propre instance Ollama auto-hébergée — selon celui disponible à ce moment-là. Ces fournisseurs traitent le texte (et, pour la voix, l\'audio transcrit) uniquement pour générer une réponse ; consultez leurs politiques de confidentialité respectives pour savoir comment ils traitent les données de leur côté.',
    ],
  },
  {
    id: 'cookies-tracking',
    title: '4. Cookies et suivi',
    bullets: [
      'Nous utilisons des cookies pour vous maintenir connecté et mémoriser vos préférences. Si nous ajoutons des outils d\'analyse tiers à l\'avenir, cette politique sera mise à jour pour les nommer avant leur mise en service.',
      'Vous pouvez gérer vos préférences en matière de cookies via les paramètres de votre navigateur ou en nous contactant pour vous désinscrire du suivi non essentiel.',
    ],
  },
  {
    id: 'data-security',
    title: '5. Sécurité des données',
    bullets: [
      'Tous les transferts de données sont sécurisés via HTTPS (chiffrement SSL) afin de protéger vos informations.',
      'Nous appliquons des contrôles internes stricts, y compris des politiques d\'accès limité, pour protéger vos données.',
      'Nous ne vendons, ne louons ni ne partageons vos informations personnelles avec des annonceurs. Elles ne sont partagées que comme décrit à la Section 3 (redirections vers les partenaires de réservation et partenaires de traitement IA).',
    ],
  },
  {
    id: 'privacy-choices',
    title: '6. Vos choix en matière de confidentialité',
    leadText: 'Vous avez le contrôle de vos données :',
    bullets: [
      'Modifier ou supprimer : Mettez à jour ou supprimez vos informations personnelles et voyages enregistrés via les paramètres de votre compte.',
      'Désinscription : Désabonnez-vous des e-mails ou notifications non essentiels via le lien de désinscription dans nos messages.',
      'Suppression des données : Demandez l\'effacement complet de vos données en envoyant un e-mail à privacy@travlplanr.com. Nous traiterons votre demande sauf obligation légale de conserver certaines données (par exemple, à des fins de conformité).',
    ],
  },
  {
    id: 'age-restrictions',
    title: '7. Restrictions d\'âge',
    bullets: [
      'Travl Planr est conçu pour les utilisateurs âgés de 16 ans et plus.',
      'Nous ne collectons pas sciemment de données d\'enfants de moins de 16 ans. Si nous détectons de telles données, nous les supprimerons et informerons le parent ou tuteur.',
    ],
  },
  {
    id: 'legal-compliance',
    title: '8. Conformité légale et mises à jour',
    bullets: [
      'Nous respectons les lois de confidentialité applicables, y compris la loi indienne sur la protection des données personnelles numériques de 2023, et les normes internationales le cas échéant (par exemple, le RGPD pour les utilisateurs de l\'UE, le CCPA pour les résidents de Californie).',
      'Cette politique peut être mise à jour pour refléter des changements dans nos services ou exigences légales. Les mises à jour importantes seront communiquées par e-mail ou par un avis sur notre site.',
      'La politique est accessible dans le pied de page, les paramètres du compte et les pages clés (par exemple, lors de la création du compte).',
    ],
  },
  {
    id: 'contact-support',
    title: '9. Contact et assistance',
    leadText: 'Des questions ou besoin d\'aide ?',
    contactLines: ['privacy@travlplanr.com', 'TravlPlanR Private Limited, Coimbatore, Inde'],
  },
];
