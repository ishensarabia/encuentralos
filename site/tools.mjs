// Text and data for the two tools that run on the family's phone: the search flyer and the
// documents for authorities. Nothing typed into them is stored or sent anywhere.

export const FICHA_PAGE = {
  file: 'ficha.html',
  script: 'ficha.js',
  nav: 'Crear una ficha de búsqueda',
  title: 'Crear una ficha de búsqueda',
  description: 'Haz una imagen con la foto y los datos de tu familiar para compartirla en redes y WhatsApp. Se hace en tu teléfono: nada se sube.',
};

export const ESCRITOS_PAGE = {
  file: 'escritos.html',
  script: 'escritos.js',
  nav: 'Escritos para la autoridad',
  title: 'Escritos para la autoridad',
  description: 'Arma un escrito con los artículos de la ley que obligan a la autoridad a actuar. Se hace en tu teléfono: nada se sube.',
};

// Articles of the Ley General en Materia de Desaparición (text in docs/source-texts/lgmdfp.txt).
// Every `text` must appear there word for word: the build and the tests check it, because
// families hand these quotes to officials.
export const FUNDAMENTOS = {
  busqueda_inmediata: {
    art: 'art. 89',
    text: 'Cuando la Comisión Nacional de Búsqueda o la Comisión Local de Búsqueda correspondiente tenga Noticia o Reporte de una Persona Desaparecida o No Localizada, iniciará la búsqueda de inmediato e informará sin dilación a la fiscalía competente.',
  },
  acciones_inmediatas: {
    art: 'art. 86, segundo párrafo',
    text: 'Las autoridades que reciban la Denuncia, el Reporte o Noticia deberán implementar, inmediatamente, las acciones de búsqueda que les correspondan, de conformidad con lo dispuesto en el protocolo correspondiente.',
  },
  sin_espera: {
    art: 'art. 80, último párrafo',
    text: 'Ningún protocolo establecerá plazos de espera para iniciar la investigación.',
  },
  carpeta: {
    art: 'art. 80, cuarto párrafo',
    text: 'La autoridad que reciba una Noticia, Reporte o denuncia deberá informar inmediatamente a la Fiscalía Especializada competente, la que iniciará sin dilación alguna la investigación y asignará el número de carpeta correspondiente.',
  },
  omision: {
    art: 'art. 80, cuarto párrafo',
    text: 'La omisión de iniciar la investigación correspondiente y/o de iniciar el reporte de desaparición pertinente, se sancionará de acuerdo con las disposiciones de esta Ley.',
  },
  transmision: {
    art: 'art. 86, tercer párrafo',
    text: 'El incumplimiento por parte de la autoridad obligada a la transmisión inmediata será sancionado de conformidad con la legislación en materia de responsabilidades administrativas.',
  },
  constancia_folio: {
    art: 'art. 81, último párrafo',
    text: 'En el caso de la fracción III, quien reciba el Reporte deberá entregar a la persona que lo realizó constancia por escrito en el que constará el folio único de búsqueda.',
  },
  nombre_cargo: {
    art: 'art. 85, último párrafo',
    text: 'La autoridad que recabe la información, documentos y elementos a que se refiere el presente artículo deberá asentar su nombre, cargo y dependencia gubernamental a la que se encuentre adscrito al momento de recibir el Reporte o Denuncia. La autoridad estará obligada a entregar una copia del Reporte o Denuncia a la persona que haya acudido a realizarla.',
  },
  sin_curp: {
    art: 'art. 85, fracción I Bis',
    text: 'No podrá condicionarse el procedimiento de búsqueda a la presentación de este requisito',
  },
  ninas_ninos: {
    art: 'art. 7',
    text: 'Las niñas, niños y adolescentes respecto de los cuales haya Noticia, Reporte o Denuncia que han desaparecido en cualquier circunstancia, se iniciará carpeta de investigación en todos los casos y se emprenderá la búsqueda especializada de manera inmediata y diferenciada, de conformidad con el protocolo especializado en búsqueda de personas menores de 18 años de edad que corresponda.',
  },
  medidas_ayuda: {
    art: 'art. 139',
    text: 'Los Familiares, a partir del momento en que tengan conocimiento de la desaparición, y lo hagan del conocimiento de la autoridad competente, pueden solicitar y tienen derecho a recibir de inmediato y sin restricción alguna, las medidas de ayuda, asistencia y atención previstas en los Títulos Segundo, Tercero y Cuarto de la Ley General de Víctimas.',
  },
  ser_informados: {
    art: 'art. 138, fracción I',
    text: 'Participar dando acompañamiento y ser informados de manera oportuna de aquellas acciones de búsqueda que las autoridades competentes realicen tendientes a la localización de la Persona Desaparecida;',
  },
  proponer_diligencias: {
    art: 'art. 138, fracción II',
    text: 'Proponer diligencias que deban ser llevadas a cabo por la autoridad competente en los programas y acciones de búsqueda',
  },
  acceso_expediente: {
    art: 'art. 138, fracción III',
    text: 'Acceder, directamente o mediante sus representantes, a los expedientes que sean abiertos en materia de búsqueda o investigación;',
  },
  copia_gratuita: {
    art: 'art. 138, fracción IV',
    text: 'Obtener copia simple gratuita de las diligencias que integren los expedientes de búsqueda;',
  },
};

// Form fields. `required` fields that are left empty show as [COMPLETA: …] in the document.
export const CAMPOS = {
  ciudad: { label: 'Ciudad desde donde escribes', hint: 'Ejemplo: Guadalajara, Jalisco', required: true },
  destinatario: { label: 'A quién va dirigido', hint: 'Ejemplo: Comisión de Búsqueda de Personas del Estado de Jalisco', required: true },
  nombre: { label: 'Tu nombre completo', required: true },
  parentesco: { label: 'Tu parentesco con la persona', hint: 'Ejemplo: madre, hermano, pareja' },
  telefono: { label: 'Tu teléfono', type: 'tel', required: true },
  correo: { label: 'Tu correo (si tienes)', type: 'email' },
  domicilio: { label: 'Dirección para recibir avisos', hint: 'Puede ser la de otra persona de confianza o de una organización.' },
  nombre_pd: { label: 'Nombre completo de la persona desaparecida', required: true },
  edad: { label: 'Edad', type: 'number', required: true },
  sexo: { label: 'Sexo o género', hint: 'Como lo diría su familia' },
  curp: { label: 'CURP (si la tienes)', hint: 'Si no la tienes, déjalo vacío: no pueden condicionar la búsqueda a la CURP.' },
  senas: { label: 'Estatura, complexión, cabello y señas particulares', long: true, hint: 'Tatuajes, cicatrices, lunares, lentes, prótesis…' },
  vestimenta: { label: 'Cómo iba vestida', long: true },
  fecha_hechos: { label: 'Fecha en que se le vio por última vez', type: 'date', required: true },
  lugar_hechos: { label: 'Lugar donde se le vio por última vez', required: true },
  hechos: { label: 'Qué pasó, con tus palabras', long: true, required: true, hint: 'Cuándo supiste, con quién estaba, a dónde iba, qué te dijeron.' },
  involucrados: { label: 'Personas que podrían estar involucradas (si sabes)', long: true, hint: 'Nombres, apodos, descripción, vehículo.' },
  otros: { label: 'Otros datos que ayuden a buscarla', long: true, hint: 'Teléfono y redes de la persona, enfermedades o medicinas, hábitos.' },
  autoridad: { label: 'Autoridad que no te recibió el reporte', hint: 'Ejemplo: Agencia del Ministerio Público de …', required: true },
  fecha_rechazo: { label: 'Fecha en que fuiste', type: 'date', required: true },
  servidor: { label: 'Nombre o descripción de quien te atendió', hint: 'Si no sabes su nombre: cómo era, qué escritorio o ventanilla.' },
  motivo: { label: 'Qué te dijeron para no recibirlo', long: true, required: true, hint: 'Ejemplo: que debía esperar 72 horas, que faltaban documentos, que no era su competencia.' },
  folio: { label: 'Folio único de búsqueda (si ya tienes)' },
  carpeta: { label: 'Número de carpeta de investigación (si ya tienes)' },
  diligencias: { label: 'Qué otras acciones propones (opcional)', long: true, hint: 'Ejemplo: revisar cámaras de la calle, pedir los registros de su teléfono, buscar en hospitales.' },
};

export const ESCRITOS = {
  reporte: {
    title: 'Reporte de desaparición y solicitud de búsqueda inmediata',
    when: 'Para presentar o enviar a la Comisión de Búsqueda (nacional o de tu estado) o a la Fiscalía cuando ya sabes que tu familiar no aparece.',
    fields: ['ciudad', 'destinatario', 'nombre', 'parentesco', 'telefono', 'correo', 'domicilio', 'nombre_pd', 'edad', 'sexo', 'curp', 'senas', 'vestimenta', 'fecha_hechos', 'lugar_hechos', 'hechos', 'involucrados', 'otros'],
  },
  rechazo: {
    title: 'Constancia de que no quisieron recibir el reporte',
    when: 'Para entregar a la autoridad (o al superior de quien te atendió) cuando te pidieron esperar, volver otro día o traer documentos antes de recibir tu reporte.',
    fields: ['ciudad', 'destinatario', 'nombre', 'telefono', 'correo', 'domicilio', 'nombre_pd', 'edad', 'fecha_hechos', 'autoridad', 'fecha_rechazo', 'servidor', 'motivo', 'folio'],
  },
  avance: {
    title: 'Solicitud de información y copia del expediente de búsqueda',
    when: 'Para pedir que te informen qué se ha hecho para buscar a tu familiar y que te den copia gratuita de las diligencias.',
    fields: ['ciudad', 'destinatario', 'nombre', 'parentesco', 'telefono', 'correo', 'domicilio', 'nombre_pd', 'folio', 'carpeta', 'diligencias'],
  },
};

export const TOOLS_T = {
  // Flyer
  fichaIntro: 'Llena los datos, elige la foto y descarga una imagen lista para WhatsApp, Facebook o Instagram. La foto y los datos se quedan en tu teléfono: no se suben a ningún lado.',
  fichaBefore: 'Antes de compartirla',
  fichaBeforeList: [
    'Si ya hiciste el reporte, avisa a la autoridad que vas a difundir la ficha. Pídele que te confirme si hay algún dato que no deba publicarse.',
    'No pongas tu domicilio ni el de la persona. Pon un teléfono donde puedas recibir mensajes. Si prefieres no usar el tuyo, usa el de un colectivo o de una persona de confianza.',
    'Nadie que busque a tu familiar de buena fe te va a pedir dinero por información. Si te piden dinero, no pagues y avisa a la autoridad: es una extorsión.',
    'Cuando la persona aparezca, borra o corrige las publicaciones.',
  ],
  fichaNoJs: 'Esta herramienta necesita JavaScript. Si no funciona en tu teléfono, usa la lista de datos que conviene reunir en',
  fichaFields: {
    nombre: 'Nombre',
    edad: 'Edad',
    senas: 'Señas particulares',
    vestimenta: 'Vestimenta',
    fecha: 'Fecha en que se le vio por última vez',
    lugar: 'Lugar',
    telefono: 'Teléfono para dar informes',
    extra: 'Otro dato (opcional)',
    visto: 'Visto por última vez',
    otro: 'Otro dato',
    foto: 'Foto reciente donde se le vea bien la cara',
    formato: 'Tamaño',
  },
  fichaFormats: [
    { id: 'post', label: 'Publicación para redes', w: 1080, h: 1350 },
    { id: 'story', label: 'Historia o estado de WhatsApp', w: 1080, h: 1920 },
  ],
  fichaTitleBanner: 'SE BUSCA',
  fichaFootNote: 'Si tienes información, llama o escribe al teléfono de esta ficha.',
  fichaDownload: 'Descargar imagen',
  fichaShare: 'Compartir',
  fichaMakeIt: 'Ver la ficha',
  fichaNeedName: 'Escribe al menos el nombre para ver la ficha.',
  fichaPhotoHint: 'La foto se recorta para que se vea la cara. Se quita la información oculta de la foto (ubicación, fecha, cámara) porque la imagen se vuelve a dibujar.',
  fichaPreviewLabel: 'Vista previa de la ficha',

  // Documents
  escritosIntro: 'Escribe los datos y se arma un escrito con los artículos de la Ley General que obligan a la autoridad a actuar. Impreso y con acuse de recibido, es una prueba de que lo presentaste. Todo se hace en tu teléfono: nada se sube.',
  escritosLimit: 'Es un modelo, no asesoría legal: no sabe todo lo que pasa en tu caso. Si tu caso es complicado o te siguen negando la atención, busca a una organización de familias, a la defensoría pública o a un abogado. Para pedir al juez que ordene la búsqueda (amparo), necesitas ayuda de alguien que lo presente.',
  escritosHowTo: [
    'Llévalo impreso por duplicado y pide que sellen o firmen tu copia (acuse de recibido).',
    'Si no te lo quieren recibir, tómale foto a la ventanilla y anota la hora y el nombre de quien te atendió.',
    'También puedes enviarlo por correo a la institución y guardar el comprobante.',
  ],
  escritosHowToTitle: 'Cómo usarlo',
  escritosPick: 'Elige el escrito',
  escritosMake: 'Armar el escrito',
  escritosResult: 'Tu escrito',
  escritosCopy: 'Copiar texto',
  escritosCopied: 'Copiado',
  escritosDownload: 'Descargar (.txt)',
  escritosPrint: 'Imprimir',
  escritosMissingOne: 'Falta 1 dato. Aparece entre corchetes [COMPLETA: …] para que lo llenes a mano.',
  escritosMissingMany: 'Faltan {n} datos. Aparecen entre corchetes [COMPLETA: …] para que los llenes a mano.',
  escritosBack: 'Cambiar los datos',
  escritosNoJs: 'Esta herramienta necesita JavaScript. Mientras tanto, puedes mostrar los artículos de la ley en',
};
