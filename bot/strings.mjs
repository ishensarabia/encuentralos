// Everything the bot says that is not in content/. Like site/strings.mjs, this is one file
// so the reviewing organization can read all of the bot's own wording in one pass.
// WhatsApp limits (enforced by tests): list row title 24 characters, row description 72,
// button title 20, list button 20, footer 60.

export const B = {
  // Put in front of every message when the bot runs in "preview" mode, so unreviewed
  // content is never mistaken for verified information.
  previewMarker: '[SIN REVISAR · SOLO PRUEBAS]',

  privacyFooter: 'WhatsApp y Meta pueden ver este chat',
  menuButton: 'Ver opciones',
  listButton: 'Ver temas',
  moreRow: 'Ver más temas',
  menuRow: 'Volver al menú',
  moreDescription: (page, pages) => `Página ${page} de ${pages}`,

  greeting: (keyPoints, siteUrl) => [
    'Hola. Soy una guía automática para familias de personas desaparecidas en México. No soy una persona ni una autoridad, y no sustituyo la asesoría legal.',
    '*Tu privacidad:* WhatsApp y Meta pueden ver los mensajes de esta conversación. Yo no guardo tu número ni lo que escribes: solo cuento cuántas veces se usa cada tema.'
      + (siteUrl ? ` También puedes leer esta guía sin WhatsApp en ${siteUrl}` : ''),
    'Si hay peligro ahora, llama al 911.',
    ['*Lo más importante:*', ...keyPoints.map((t) => `• ${t}`)].join('\n'),
  ],
  menuBody: '¿Qué necesitas? Elige una opción, o escribe el nombre de tu estado.',

  statePickerBody: '¿En qué estado ocurrió? También puedes escribir su nombre.',
  otherStateRow: { title: 'Otro estado', description: 'Todavía no está en esta guía' },
  stateTitle: (name) => `*Qué hacer en ${name}*`,
  stateNotesTitle: '*Qué más debes saber*',
  otherState: (name) => (name
    ? `Todavía no tenemos la guía de ${name}. Los pasos de esta guía aplican en todo el país. Puedes reportar con la Comisión Nacional de Búsqueda:`
    : 'Todavía no tenemos la guía de tu estado. Los pasos de esta guía aplican en todo el país. Puedes reportar con la Comisión Nacional de Búsqueda:'),
  ambiguousState: 'Hay más de un lugar posible. Elige tu estado:',

  checklistPickerBody: '*Qué hacer, paso a paso*\nElige según cuánto tiempo ha pasado.',
  phaseButtons: { ahora: 'Ahora mismo', 'primeros-dias': 'Primeros días', 'semanas-y-meses': 'Semanas y meses' },
  phaseIntros: {
    ahora: 'Lo que puedes hacer desde este momento.',
    'primeros-dias': 'Lo que sigue en los primeros días.',
    'semanas-y-meses': 'Lo que hay que saber si pasan las semanas y los meses.',
  },
  // The site's intro for this section says "esta página"; here it says "estos mensajes".
  introOverrides: {
    rechazo: 'Si una autoridad no quiere recibir tu reporte, esto dice la ley. Puedes mostrarle estos mensajes: las citas son textuales.',
  },

  next: 'Siguiente',
  list: 'Ver lista',
  menu: 'Menú',
  followUp: '¿Qué quieres hacer ahora?',
  stateButtons: { checklist: 'Paso a paso', rechazo: 'Si no me reciben' },

  about: [
    '*Sobre esta guía*',
    'Es gratuita y de código abierto. Explica qué hacer en las primeras horas y días después de que una persona desaparece en México.',
    'Todo viene de leyes, protocolos y guías públicas, y cada paso dice de dónde sale. Una organización de apoyo a familias revisa el contenido antes de publicarlo.',
    '*Tus datos:* no guardo tu número ni tus mensajes; solo cuento cuántas veces se usa cada tema. Pero WhatsApp y Meta sí pueden ver esta conversación.',
    'Es una guía informativa y no sustituye la asesoría legal.',
  ],

  fallback: 'No entendí tu mensaje: solo respondo con información fija. Escribe el nombre de tu estado, o elige una opción.',
  unsupported: 'Por ahora solo entiendo mensajes de texto y los botones. Escribe el nombre de tu estado, o elige una opción.',
};

// Main menu, in order. `key` decides whether the entry exists: a section or state with no
// approved content is left out (so a public bot never shows an empty topic).
export const MENU = [
  { key: 'checklist', id: 'c:checklist', title: 'Qué hacer ahora', description: 'Pasos, según cuánto tiempo ha pasado' },
  { key: 'state', id: 'st', title: 'Mi estado', description: 'Dónde acudir en el estado donde ocurrió' },
  { key: 'rechazo', id: 'c:rechazo', title: 'Si no me reciben', description: 'Lo que dice la ley, para mostrarlo' },
  { key: 'documentos', id: 'c:documentos', title: 'Qué información reunir', description: 'Datos y documentos que ayudan a buscar' },
  { key: 'adn', id: 'c:adn', title: 'Muestras de ADN', description: 'Cómo funcionan y cuáles son tus derechos' },
  { key: 'instituciones', id: 'c:instituciones', title: '¿Quién hace qué?', description: 'Instituciones y cómo contactarlas' },
  { key: 'about', id: 'about', title: 'Sobre esta guía', description: 'Qué datos guarda (ninguno) y cómo se revisa' },
];

// Words that bring back the greeting or the menu. Only whole words, and only after a
// state name has been looked for: "necesito ayuda, desapareció en Jalisco" is a state.
export const GREETING_WORDS = ['hola', 'buenas', 'buenos', 'buen', 'inicio', 'empezar', 'comenzar', 'hi', 'hello'];
export const MENU_WORDS = ['menu', 'opciones', 'ayuda', 'volver', 'regresar', 'atras'];
