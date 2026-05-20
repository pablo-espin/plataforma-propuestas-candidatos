/**
 * config.js
 * Configura la URL del Google Sheet y las constantes globales.
 */

const CONFIG = {
  SHEET_ID: '1joLt-JrQuf4HLfSubQYa0Jjd10DG7fk47DC0niaL2Jw',

  // URLs para cada pestaña
  get SHEETS() {
    const base = `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=`;
    return {
      candidatos:           base + 'candidatos',
      propuestas:           base + 'propuestas',
      expertos:             base + 'expertos',
      comentarios_expertos: base + 'comentarios_expertos',
      red_flags:            base + 'red_flags',
      resumen_sectores:     base + 'resumen_sectores',
      sectores:             base + 'sectores',
    };
  },

  // Temas válidos y sus íconos/colores
  TEMAS: {
    'Seguridad':       { icon: '<img src="img/icon-seguridad.svg" alt="">', color: '#e74c3c' },
    'Institucional':   { icon: '<img src="img/icon-institucional.svg" alt="">', color: '#2F6FCC', hidden: true },
    'Tierras y Agro':  { icon: '<img src="img/icon-tierras.svg" alt="">', color: '#27ae60' },
    'Energía':         { icon: '<img src="img/icon-energia.svg" alt="">', color: '#f39c12' },
    'Salud':           { icon: '<img src="img/icon-salud.svg" alt="">', color: '#8e44ad' },
  },

  // Colores del semáforo
  SEMAFORO: {
    amarillo: { color: '#f39c12', bg: '#fef9e7', label: 'Alerta',                    icon: '<img src="img/logo-fede.svg" alt="FEDe">' },
    rojo:     { color: '#e74c3c', bg: '#fdecea', label: 'Amenaza',                   icon: '<img src="img/logo-fede.svg" alt="FEDe">' },
    accion:   { color: '#2F6FCC', bg: '#eef4fc', label: 'Acción de la Fundación',    icon: '<img src="img/logo-fede.svg" alt="FEDe">' },
  },

  // Paleta de FEDe
  COLORS: {
    blue:   '#2F6FCC',
    orange: '#E8460A',
    yellow: '#F5C800',
    green:  '#3EB489',
    dark:   '#1a1a1a',
    gray:   '#F2F2F2',
  },
};
