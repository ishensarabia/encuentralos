// Builds the text of the documents families give to authorities. Shared by the tests (Node)
// and the browser: scripts/build.mjs strips the `export` keywords and bundles this file into
// escritos.js, so keep it dependency-free and in plain ES5 (older Android browsers).
// Nothing here stores or sends anything: it only turns what the person typed into text.

var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// "2026-09-30" -> "30 de septiembre de 2026". Anything else is returned as typed.
export function fechaLarga(iso) {
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return parseInt(m[3], 10) + ' de ' + MONTHS[parseInt(m[2], 10) - 1] + ' de ' + m[1];
}

function clean(value) {
  return String(value === undefined || value === null ? '' : value).replace(/\r/g, '').trim();
}
function oneLine(value) {
  return clean(value).replace(/\s*\n\s*/g, ' ').replace(/\s{2,}/g, ' ');
}

export var LAW_NAME = 'Ley General en Materia de Desaparición Forzada de Personas, Desaparición Cometida por Particulares y del Sistema Nacional de Búsqueda de Personas';

// Required fields of a document that are still empty, so the page can say what is missing.
export function missingFields(def, campos, values) {
  var out = [];
  for (var i = 0; i < def.fields.length; i++) {
    var id = def.fields[i];
    if (campos[id] && campos[id].required && !oneLine(values[id])) out.push(id);
  }
  return out;
}

// Returns { title, text, missing: [field ids] }.
export function buildEscrito(type, values, def, campos, fund, today) {
  var missing = missingFields(def, campos, values);
  // A required field left empty is printed as a visible blank to fill in by hand.
  function v(id) {
    var value = oneLine(values[id]);
    if (value) return value;
    return campos[id] && campos[id].required ? '[COMPLETA: ' + campos[id].label.toLowerCase() + ']' : '';
  }
  function block(id) {
    var value = clean(values[id]);
    if (value) return value;
    return campos[id] && campos[id].required ? '[COMPLETA: ' + campos[id].label.toLowerCase() + ']' : '';
  }
  function date(id) {
    var value = oneLine(values[id]);
    return value ? fechaLarga(value) : v(id);
  }

  var age = parseInt(oneLine(values.edad), 10);
  var isMinor = !isNaN(age) && age < 18;
  var who = v('nombre_pd');
  var kin = oneLine(values.parentesco);
  var applicant = v('nombre') + (kin ? ', ' + kin + ' de ' + who : '');

  var out = [];
  var push = function (line) { out.push(line === undefined ? '' : line); };

  push(v('ciudad') + ', a ' + fechaLarga(today));
  push();
  push(v('destinatario').toUpperCase());
  push('P R E S E N T E');
  push();

  var law = [];       // fundamento keys shown at the end, in order, without repeats
  var useLaw = function (key) { if (law.indexOf(key) === -1) law.push(key); };
  var petitions = [];
  var facts = [];
  var subject;

  if (type === 'reporte') {
    subject = 'Reporte de desaparición y solicitud de búsqueda inmediata de ' + who;
    facts.push('Yo, ' + applicant + ', con teléfono ' + v('telefono') + (oneLine(values.correo) ? ', correo ' + oneLine(values.correo) : '') +
      (oneLine(values.domicilio) ? ' y domicilio para recibir avisos en ' + oneLine(values.domicilio) : '') +
      ', reporto la desaparición de ' + who + (oneLine(values.edad) ? ', de ' + oneLine(values.edad) + ' años de edad' : '') +
      (oneLine(values.sexo) ? ', ' + oneLine(values.sexo) : '') + '.');
    if (oneLine(values.curp)) facts.push('CURP: ' + oneLine(values.curp).toUpperCase() + '.');
    facts.push('Fue vista por última vez el ' + date('fecha_hechos') + ' en ' + v('lugar_hechos') + '.');
    facts.push('Hechos:\n' + block('hechos'));
    if (clean(values.senas)) facts.push('Descripción física y señas particulares:\n' + clean(values.senas));
    if (clean(values.vestimenta)) facts.push('Vestimenta:\n' + clean(values.vestimenta));
    if (clean(values.involucrados)) facts.push('Personas que podrían estar involucradas:\n' + clean(values.involucrados));
    if (clean(values.otros)) facts.push('Otros datos que pueden ayudar a la búsqueda:\n' + clean(values.otros));

    petitions.push('Que se inicie de inmediato la búsqueda de ' + who + ' y se informe sin dilación a la Fiscalía competente.');
    useLaw('busqueda_inmediata'); useLaw('acciones_inmediatas'); useLaw('sin_espera');
    petitions.push('Que se abra la carpeta de investigación y se me informe su número.');
    useLaw('carpeta');
    petitions.push('Que se me entregue constancia por escrito de este reporte, con el folio único de búsqueda, y copia de este escrito con el nombre, cargo y dependencia de quien lo reciba.');
    useLaw('constancia_folio'); useLaw('nombre_cargo');
    if (!oneLine(values.curp)) {
      petitions.push('Que la búsqueda no se condicione a que presente la CURP ni otro documento que no tenga a mi alcance.');
      useLaw('sin_curp');
    }
    if (isMinor) {
      petitions.push('Que, por tratarse de una persona menor de 18 años, se aplique de inmediato el protocolo de búsqueda especializada y diferenciada.');
      useLaw('ninas_ninos');
    }
    petitions.push('Que se me informe de las medidas de ayuda, asistencia y atención a las que tengo derecho como familiar.');
    useLaw('medidas_ayuda');
  } else if (type === 'rechazo') {
    subject = 'Se hace constar la negativa a recibir el reporte de desaparición de ' + who;
    facts.push('Yo, ' + v('nombre') + ', con teléfono ' + v('telefono') + (oneLine(values.correo) ? ', correo ' + oneLine(values.correo) : '') +
      (oneLine(values.domicilio) ? ' y domicilio para recibir avisos en ' + oneLine(values.domicilio) : '') +
      ', hago constar lo siguiente respecto de la desaparición de ' + who + (oneLine(values.edad) ? ', de ' + oneLine(values.edad) + ' años de edad' : '') +
      (oneLine(values.fecha_hechos) ? ', vista por última vez el ' + date('fecha_hechos') : '') + '.');
    facts.push('El ' + date('fecha_rechazo') + ' acudí a ' + v('autoridad') + ' para reportar la desaparición y solicitar que se iniciara la búsqueda' +
      (oneLine(values.servidor) ? '. Me atendió ' + oneLine(values.servidor) : '') + '.');
    facts.push('No se recibió mi reporte. Esto fue lo que se me dijo:\n' + block('motivo'));
    if (oneLine(values.folio)) facts.push('Folio único de búsqueda que ya tengo: ' + oneLine(values.folio) + '.');

    petitions.push('Que se reciba mi reporte en este momento, sin plazos de espera y sin exigirme requisitos que la ley no pide.');
    useLaw('sin_espera'); useLaw('acciones_inmediatas');
    petitions.push('Que se transmita de inmediato a la Comisión de Búsqueda y a la Fiscalía Especializada, y se me informe el número de carpeta.');
    useLaw('carpeta');
    petitions.push('Que se me entregue constancia por escrito con el folio único de búsqueda y copia de mi reporte, con el nombre, cargo y dependencia de quien lo reciba.');
    useLaw('constancia_folio'); useLaw('nombre_cargo');
    petitions.push('Que se tomen las medidas que correspondan conforme a la ley respecto de la negativa que aquí se describe.');
    useLaw('omision'); useLaw('transmision');
    if (isMinor) useLaw('ninas_ninos');
  } else if (type === 'avance') {
    subject = 'Solicitud de información y copia del expediente de búsqueda de ' + who;
    facts.push('Yo, ' + applicant + ', con teléfono ' + v('telefono') + (oneLine(values.correo) ? ', correo ' + oneLine(values.correo) : '') +
      (oneLine(values.domicilio) ? ' y domicilio para recibir avisos en ' + oneLine(values.domicilio) : '') +
      ', soy familiar de ' + who + ', persona desaparecida.');
    var refs = [];
    if (oneLine(values.folio)) refs.push('folio único de búsqueda ' + oneLine(values.folio));
    if (oneLine(values.carpeta)) refs.push('carpeta de investigación ' + oneLine(values.carpeta));
    facts.push('Mi solicitud se refiere a ' + (refs.length ? refs.join(' y ') : 'la búsqueda y la investigación de su desaparición') + '.');

    petitions.push('Que se me informe qué acciones de búsqueda se han realizado y cuáles están programadas.');
    useLaw('ser_informados');
    petitions.push('Que se me permita consultar el expediente de búsqueda y de investigación.');
    useLaw('acceso_expediente');
    petitions.push('Que se me entregue copia simple, sin costo, de las diligencias que integran el expediente de búsqueda.');
    useLaw('copia_gratuita');
    if (clean(values.diligencias)) {
      petitions.push('Que se realicen las siguientes diligencias que propongo:\n' + clean(values.diligencias).replace(/^/gm, '    '));
      useLaw('proponer_diligencias');
    }
  } else {
    throw new Error('unknown document type: ' + type);
  }

  push('ASUNTO: ' + subject + '.');
  push();
  for (var i = 0; i < facts.length; i++) { push(facts[i]); push(); }
  push('Por lo anterior, SOLICITO:');
  push();
  for (var j = 0; j < petitions.length; j++) { push((j + 1) + '. ' + petitions[j]); push(); }

  push('FUNDAMENTO');
  push(LAW_NAME + ':');
  push();
  for (var k = 0; k < law.length; k++) {
    var f = fund[law[k]];
    if (!f) throw new Error('unknown fundamento: ' + law[k]);
    push('- ' + f.art.charAt(0).toUpperCase() + f.art.slice(1) + ': «' + f.text + '»');
    push();
  }

  push('Pido que se me entregue copia de este escrito con sello o firma de recibido.');
  push();
  push('ATENTAMENTE');
  push();
  push();
  push('______________________________');
  push(v('nombre'));
  push('Teléfono: ' + v('telefono'));

  return { title: def.title, text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n', missing: missing };
}
