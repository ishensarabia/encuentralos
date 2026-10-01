// Interface text (everything on the site that is not in content/).
// Kept in one file so the reviewing organization can check it in one pass.

export const SITE = {
  name: 'Encuéntralos',
  description: 'Qué hacer en las primeras horas y días después de una desaparición en México. Gratis y sin guardar ningún dato.',
};

// Items shown on the home page, in order. They must exist in content/.
export const HOME_ITEMS = ['no-esperes', 'no-necesitas-denuncia', 'donde-reportar', 'ag-cnb'];

// The public site refuses to build unless these are approved:
// the guide must say clearly that there is no waiting period and no denuncia is needed.
export const REQUIRED_PUBLIC_ITEMS = ['no-esperes', 'no-necesitas-denuncia', 'donde-reportar'];

// One page per national section, keyed by section id.
export const PAGES = {
  checklist: { file: 'pasos.html', nav: 'Paso a paso', description: 'Qué hacer ahora, en los primeros días y en las semanas siguientes.' },
  documentos: { file: 'informacion.html', nav: 'Qué información reunir', description: 'Datos y documentos que ayudan en la búsqueda.' },
  adn: { file: 'adn.html', nav: 'Muestras de ADN', description: 'Quién da una muestra de ADN, para qué sirve y cuáles son tus derechos.' },
  instituciones: { file: 'instituciones.html', nav: '¿Quién hace qué?', description: 'Qué hace cada institución y cómo contactarla.' },
  rechazo: { file: 'si-no-te-reciben.html', nav: 'Si no te quieren recibir', description: 'Artículos de la ley para mostrar si una autoridad no quiere recibir tu reporte.' },
};

export const GUIDE_PAGE = { file: 'que-hago.html', nav: '¿Qué hago ahora?' };

export const PHASE_TITLES = {
  ahora: 'Ahora mismo',
  'primeros-dias': 'En los primeros días',
  'semanas-y-meses': 'En las semanas y meses siguientes',
};

export const T = {
  skipLink: 'Saltar al contenido',
  homeNav: 'Inicio',
  homeTitle: 'Si alguien de tu familia desapareció',
  homeLead: 'Aquí encuentras qué hacer, paso a paso. Es gratis y no guarda ningún dato tuyo.',
  homeImportant: 'Lo más importante',
  homeStates: '¿En qué estado ocurrió?',
  homeStatesMissing: 'Si tu estado todavía no está en esta guía, usa los contactos nacionales de arriba.',
  homeMore: 'Más información',
  statePageTitle: (name) => `Qué hacer en ${name}`,
  stateDescription: (name) => `Instituciones y contactos para buscar a una persona desaparecida en ${name}.`,
  stateAgencies: 'Dónde acudir',
  stateNotes: 'Qué más debes saber',
  stateSeeAlso: 'Lo que aplica en todo el país está en',
  sourcesNav: 'Fuentes',
  sourcesTitle: 'Fuentes',
  sourcesIntro: 'Todo lo que dice esta guía viene de estas leyes, protocolos y guías. Cada paso indica de dónde sale.',
  sourcesDescription: 'Leyes, protocolos y guías en los que se basa esta guía.',
  sourcesOfItem: 'Fuentes',
  published: 'Publicación',
  lastReform: 'Última reforma',
  openSource: 'Ver documento',
  aboutNav: 'Sobre esta guía',
  aboutTitle: 'Sobre esta guía',
  aboutDescription: 'Quién hace esta guía, cómo se revisa y qué datos guarda (ninguno).',
  aboutParagraphs: [
    'Esta guía es gratuita y de código abierto. Explica qué hacer en las primeras horas y días después de que una persona desaparece en México.',
    'No usamos cookies, analítica ni formularios, y no guardamos ningún dato de quien la visita. Las respuestas a las preguntas de «¿Qué hago ahora?» se quedan en tu teléfono y se borran al cerrar la página.',
    'Después de tu primera visita, la guía se guarda en tu teléfono y funciona aunque no tengas señal.',
    'Todo el contenido viene de leyes, protocolos y guías públicas. Cada paso dice de dónde sale y cuándo se verificó por última vez. No es asesoría legal: es información pública ordenada para que sepas qué pedir.',
    'Esta guía es informativa y no sustituye la asesoría legal.',
  ],
  guideCta: 'Responde unas preguntas y te decimos qué hacer',
  guideDescription: 'Responde unas preguntas y ve los pasos que aplican a tu caso. Tus respuestas no se guardan.',
  guideNoJs: 'Estas preguntas necesitan que tu navegador tenga JavaScript activado. Mientras tanto, puedes ver todos los pasos en',
  guideStateOther: 'Otro estado',
  guideSkip: 'No sé / prefiero no responder',
  guideSubmit: 'Ver mis pasos',
  guideReset: 'Empezar de nuevo',
  guideResultsTitle: 'Tus pasos',
  guideResultsNote: 'Estos pasos dependen de tus respuestas. La guía completa está en',
  guideOtherStateNote: 'Tu estado todavía no está en esta guía. Usa los contactos nacionales.',
  quoteFrom: (source, locator) => `${source}, ${locator}`,
  printHint: 'Puedes imprimir esta página o enseñarla desde tu teléfono.',
  reviewedOn: (date) => `Fuentes verificadas el ${date}`,
  footerPrivacy: 'No usamos cookies ni analítica y no guardamos ningún dato.',
  footerNotLegal: 'Esta guía es informativa y no sustituye la asesoría legal.',
  builtOn: (date) => `Actualizado el ${date}`,

  // Preview (reviewer) build only.
  previewBanner: 'VERSIÓN DE REVISIÓN. Este contenido todavía no ha sido verificado. No lo compartas con familias.',
  status: { unreviewed: 'Sin revisar', needs_changes: 'Requiere cambios', approved: 'Aprobado', rejected: 'Rechazado' },
  verification: { primary: 'fuente primaria', secondary: 'fuente secundaria', unconfirmed: 'sin confirmar' },
  reviewNote: 'Nota para revisión',
  contactUnconfirmed: 'sin confirmar por teléfono',
  sourceNotRead: 'Fuente todavía no leída por el equipo',
  previewCounts: (s) => `${s.items} temas · ${s.byStatus.approved} aprobados · ${s.byStatus.unreviewed} sin revisar · ${s.unconfirmedContacts} contactos sin confirmar`,
};
