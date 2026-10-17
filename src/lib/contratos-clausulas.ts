/**
 * Arma el texto de cada tipo de contrato a partir de los datos cargados (a pedido de Mariano, sin
 * el cartel de "revisar con un abogado": los redacta la propia inmobiliaria). Nunca se citan
 * artículos de ley puntuales ni se fijan plazos/topes que la normativa dejó librados al acuerdo de
 * partes (la locación urbana se desreguló a fines de 2023): todo lo negociable queda como dato
 * cargado, no fijo. Para arrendamientos rurales (Finca) se deja explícito el régimen legal distinto
 * (Ley 13.246) que corresponde tener en cuenta al fijar plazos y forma de pago.
 */

export type TipoOperacion = "alquiler" | "compraventa" | "comodato";
export type TipoInmueble = "Casa" | "Departamento" | "PH" | "Finca" | "Oficina" | "Local" | "Lote";
export type Regimen = "urbano" | "rural";

export type Parte = { nombre: string; dni: string; rol: string };

export type DatosContrato = {
  operacion: TipoOperacion;
  inmuebleTipo: TipoInmueble;
  regimen: Regimen;
  direccion: string;
  codigoPropiedad?: string | null;
  parteA: Parte; // Locador / Vendedor / Comodante
  parteB: Parte; // Locatario / Comprador / Comodatario
  destino: string;
  monto: number | null;
  moneda: "USD" | "ARS";
  deposito: number | null;
  plazoMeses: number | null;
  fechaInicio: string | null;
  fechaFin: string | null;
  ajusteTipo: string;
  ajusteFrecuenciaMeses: number | null;
  senia: number | null;
  plazoEscrituracionDias: number | null;
  clausulasParticulares: string;
  lugarFirma: string;
};

export type Clausula = { titulo: string; texto: string };

const dinero = (v: number | null, m: "USD" | "ARS") => (v == null ? "a definir" : `${m === "USD" ? "USD" : "$"} ${Math.round(v).toLocaleString("es-AR")}`);
const fecha = (iso: string | null) => (iso ? new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" }) : "a definir");
/** "el 24 de septiembre de 2026" o, sin fecha cargada, una frase gramaticalmente correcta igual. */
const elDia = (iso: string | null) => (iso ? `el ${fecha(iso)}` : "en la fecha que las partes acuerden");
const oO = (r: "A" | "B", d: DatosContrato) => (r === "A" ? d.parteA : d.parteB);

/** Título del documento según operación y régimen. */
export function tituloContrato(d: Pick<DatosContrato, "operacion" | "regimen">) {
  if (d.operacion === "compraventa") return "Boleto de compraventa";
  if (d.operacion === "comodato") return "Contrato de comodato";
  return d.regimen === "rural" ? "Contrato de arrendamiento rural" : "Contrato de locación";
}

function clausulaPartes(d: DatosContrato): Clausula {
  const p = (r: "A" | "B") => { const x = oO(r, d); return `${x.nombre}${x.dni ? `, DNI/CUIT ${x.dni}` : ""}, en adelante "EL ${x.rol.toUpperCase()}"`; };
  return { titulo: "Partes", texto: `Entre ${p("A")}, por una parte, y ${p("B")}, por la otra, celebran el presente contrato sujeto a las cláusulas que se detallan a continuación y, en lo no previsto expresamente, a lo dispuesto por el Código Civil y Comercial de la Nación y demás normativa vigente y aplicable en la Provincia de Mendoza.` };
}

function clausulaObjeto(d: DatosContrato): Clausula {
  const rolA = d.parteA.rol.toUpperCase();
  const verbo = d.operacion === "compraventa" ? "vende y transfiere a" : d.operacion === "comodato" ? "entrega en préstamo de uso gratuito a" : "da en locación a";
  return {
    titulo: "Objeto",
    texto: `EL ${rolA} ${verbo} EL ${d.parteB.rol.toUpperCase()} el inmueble tipo ${d.inmuebleTipo.toLowerCase()} ubicado en ${d.direccion}, Provincia de Mendoza${d.codigoPropiedad ? ` (identificado internamente como ${d.codigoPropiedad})` : ""}, que la otra parte declara conocer y recibir en el estado en que se encuentra, con todo lo edificado, plantado y adherido al suelo, y sin más limitaciones que las que resulten del presente.`,
  };
}

function clausulaDestino(d: DatosContrato): Clausula {
  return { titulo: "Destino", texto: `El inmueble se destinará exclusivamente ${d.destino ? `a ${d.destino}` : "al uso acordado entre las partes"}. No podrá dársele un destino distinto sin autorización previa y por escrito de EL ${d.parteA.rol.toUpperCase()}.` };
}

function clausulaRegimenRural(): Clausula {
  return {
    titulo: "Régimen legal aplicable",
    texto:
      "Por tratarse de un inmueble rural con destino a explotación agropecuaria, el presente arrendamiento se rige por la Ley Nacional 13.246 de Arrendamientos y Aparcerías Rurales y sus modificatorias, en todo lo relativo a plazos mínimos, forma de pago y demás condiciones propias del régimen rural, distintas de las que aplican a las locaciones urbanas. En lo no previsto en dicha ley, se aplican supletoriamente el Código Civil y Comercial de la Nación y las cláusulas del presente contrato.",
  };
}

function clausulaPlazoAlquiler(d: DatosContrato): Clausula {
  const plazo = d.plazoMeses ? `${d.plazoMeses} meses` : "a definir";
  return { titulo: "Plazo", texto: `El presente contrato tendrá una vigencia de ${plazo}, con inicio ${elDia(d.fechaInicio)} y finalización ${elDia(d.fechaFin)}, pudiendo renovarse o prorrogarse únicamente por acuerdo escrito entre las partes.` };
}

function clausulaPrecioAlquiler(d: DatosContrato): Clausula {
  return { titulo: "Precio y forma de pago", texto: `El canon locativo se fija en ${dinero(d.monto, d.moneda)} mensuales, pagaderos por adelantado dentro de los primeros días de cada mes, mediante el medio de pago que las partes acuerden y dejen documentado.` };
}

function clausulaAjuste(d: DatosContrato): Clausula {
  if (!d.ajusteTipo || d.ajusteTipo === "Sin ajuste pactado") return { titulo: "Actualización del canon", texto: "Las partes podrán acordar actualizaciones del canon locativo mediante addenda por escrito firmada por ambas, respetando en todo momento la normativa vigente en materia de locaciones." };
  const frecuencia = d.ajusteFrecuenciaMeses ? `cada ${d.ajusteFrecuenciaMeses} meses` : "con la periodicidad que las partes acuerden";
  return { titulo: "Actualización del canon", texto: `El canon locativo se actualizará ${frecuencia} conforme el mecanismo acordado por las partes (${d.ajusteTipo}), de acuerdo con la normativa vigente en materia de locaciones al momento de cada actualización.` };
}

function clausulaDeposito(d: DatosContrato): Clausula {
  if (!d.deposito) return { titulo: "Depósito en garantía", texto: "No se pacta depósito en garantía en el presente contrato, salvo acuerdo posterior por escrito entre las partes." };
  return { titulo: "Depósito en garantía", texto: `EL ${d.parteB.rol.toUpperCase()} entrega en este acto la suma de ${dinero(d.deposito, d.moneda)} en concepto de depósito en garantía, que será restituida al finalizar la locación previa verificación del estado del inmueble y del cumplimiento de las obligaciones asumidas, con las deducciones que pudieran corresponder.` };
}

function clausulaObligacionesLocacion(d: DatosContrato): Clausula {
  return {
    titulo: "Obligaciones de las partes",
    texto: `EL ${d.parteB.rol.toUpperCase()} se obliga a: usar el inmueble conforme al destino pactado; mantenerlo en buen estado de conservación; abonar en término los servicios que estén a su cargo; no subarrendar ni ceder el contrato sin autorización previa y por escrito; permitir el acceso para inspecciones razonables previamente coordinadas; y restituirlo al finalizar el contrato en las mismas condiciones en que lo recibió, salvo el deterioro propio del uso normal. EL ${d.parteA.rol.toUpperCase()} se obliga a: garantizar el uso pacífico del inmueble durante la vigencia del contrato; mantenerlo en condiciones de uso conforme al destino pactado; y responder por las reparaciones que no sean atribuibles a EL ${d.parteB.rol.toUpperCase()}.`,
  };
}

function clausulaRescision(): Clausula {
  return { titulo: "Rescisión y mora", texto: "El incumplimiento de cualquiera de las obligaciones asumidas por una de las partes habilitará a la otra a intimar su cumplimiento y, de persistir el incumplimiento, a rescindir el presente contrato, sin perjuicio de las acciones legales que correspondan. La mora se producirá de pleno derecho por el solo vencimiento de los plazos pactados, sin necesidad de interpelación previa." };
}

function clausulaPrecioCompraventa(d: DatosContrato): Clausula {
  const senia = d.senia ? `, de los cuales EL ${d.parteB.rol.toUpperCase()} entrega en este acto la suma de ${dinero(d.senia, d.moneda)} en concepto de seña y a cuenta de precio` : "";
  return { titulo: "Precio y forma de pago", texto: `El precio total de la operación se fija en ${dinero(d.monto, d.moneda)}${senia}. El saldo se abonará en la forma, plazo y lugar que las partes acuerden y dejen documentado, contra la escrituración o entrega de posesión, según se pacte.` };
}

function clausulaEscrituracion(d: DatosContrato): Clausula {
  const plazo = d.plazoEscrituracionDias ? `dentro de los ${d.plazoEscrituracionDias} días` : "en el plazo que las partes acuerden";
  return { titulo: "Escrituración y entrega", texto: `Las partes se comprometen a otorgar la escritura traslativa de dominio ${plazo} corridos desde la firma del presente, ante el escribano que de común acuerdo designen, siendo los gastos de escrituración a cargo de la parte que las partes determinen. EL ${d.parteA.rol.toUpperCase()} declara que el inmueble se transmite libre de ocupantes, gravámenes, embargos e inhibiciones, y se compromete a mantenerlo en ese estado hasta la escrituración.` };
}

function clausulaIncumplimientoCompraventa(): Clausula {
  return { titulo: "Incumplimiento", texto: "El incumplimiento de las obligaciones asumidas por cualquiera de las partes habilitará a la otra a exigir su cumplimiento o a rescindir la operación, con la pérdida o restitución de la seña que corresponda según de quién provenga el incumplimiento, y sin perjuicio de las acciones legales pertinentes." };
}

function clausulaGratuidadComodato(d: DatosContrato): Clausula {
  return { titulo: "Gratuidad", texto: `EL ${d.parteA.rol.toUpperCase()} entrega el inmueble en carácter de préstamo de uso gratuito, sin que EL ${d.parteB.rol.toUpperCase()} deba abonar contraprestación alguna por su uso, sin perjuicio de los gastos y expensas ordinarias que se pacten a su cargo.` };
}

function clausulaPlazoComodato(d: DatosContrato): Clausula {
  const plazo = d.plazoMeses ? `${d.plazoMeses} meses` : "a definir";
  return { titulo: "Plazo y restitución", texto: `El presente comodato tendrá una vigencia de ${plazo}, con inicio ${elDia(d.fechaInicio)}, debiendo EL ${d.parteB.rol.toUpperCase()} restituir el inmueble al finalizar dicho plazo o cuando EL ${d.parteA.rol.toUpperCase()} lo requiera conforme lo pactado, en las mismas condiciones en que lo recibió, salvo el deterioro propio del uso normal.` };
}

function clausulaObligacionesComodato(d: DatosContrato): Clausula {
  return { titulo: "Obligaciones del comodatario", texto: `EL ${d.parteB.rol.toUpperCase()} se obliga a conservar el inmueble en buen estado, afrontar los gastos ordinarios de uso y mantenimiento, no subprestarlo ni cederlo a terceros sin autorización previa y por escrito, y restituirlo en el plazo pactado.` };
}

function clausulaJurisdiccion(d: DatosContrato): Clausula {
  return { titulo: "Jurisdicción", texto: `Para cualquier controversia derivada del presente contrato, las partes se someten a la jurisdicción de los tribunales ordinarios con competencia en ${d.lugarFirma || "Mendoza"}, renunciando a cualquier otro fuero o jurisdicción que pudiera corresponderles.` };
}

function clausulaParticulares(d: DatosContrato): Clausula | null {
  if (!d.clausulasParticulares.trim()) return null;
  return { titulo: "Cláusulas particulares", texto: d.clausulasParticulares.trim() };
}

/** Arma la lista de cláusulas según el tipo de operación y régimen. */
export function armarClausulas(d: DatosContrato): Clausula[] {
  const cs: (Clausula | null)[] = [clausulaPartes(d), clausulaObjeto(d)];
  if (d.regimen === "rural" && d.operacion === "alquiler") cs.push(clausulaRegimenRural());
  cs.push(clausulaDestino(d));

  if (d.operacion === "alquiler") {
    cs.push(clausulaPlazoAlquiler(d), clausulaPrecioAlquiler(d), clausulaAjuste(d), clausulaDeposito(d), clausulaObligacionesLocacion(d), clausulaRescision());
  } else if (d.operacion === "compraventa") {
    cs.push(clausulaPrecioCompraventa(d), clausulaEscrituracion(d), clausulaIncumplimientoCompraventa());
  } else {
    cs.push(clausulaGratuidadComodato(d), clausulaPlazoComodato(d), clausulaObligacionesComodato(d));
  }

  cs.push(clausulaJurisdiccion(d), clausulaParticulares(d));
  return cs.filter((c): c is Clausula => c !== null);
}
