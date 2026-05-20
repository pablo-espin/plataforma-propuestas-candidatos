/**
 * data.js
 * Maneja datos desde Google Sheets.
 * Todos los datos se cachean en memoria para evitar requests repetidos.
 */

const Data = (() => {

  // Cache en memoria
  let _cache = {
    candidatos:           null,
    propuestas:           null,
    expertos:             null,
    comentarios_expertos: null,
    red_flags:            null,
    resumen_sectores:     null,
    sectores:             null,
  };

  /**
   * Parsea el CSV que devuelve Google Sheets.
   * Maneja comillas, comas dentro de campos y líneas vacías.
   */
  function parseCSV(text) {
    const lines = splitCSVRows(text.trim());
    if (lines.length < 2) return [];

    // Buscar la fila de encabezados: la primera fila que contenga la columna "id"
    let headerIndex = 0;
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
      const row = parseCSVRow(lines[i]).map(h => h.trim().toLowerCase());
      if (row.includes('id') || row.some(h => h.startsWith('id '))) {
        headerIndex = i;
        break;
      }
    }

    const headers = parseCSVRow(lines[headerIndex])
      .map(h => h.trim().toLowerCase().replace(/\s+/g, '_').replace(/\*/g, ''));

    return lines.slice(headerIndex + 1)
      .map(line => parseCSVRow(line))
      .filter(row => row.some(cell => cell.trim() !== ''))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = (row[i] || '').trim();
        });
        return obj;
      })
      // Ignorar filas donde id esté vacío (filas de notas, separadores, etc.)
      .filter(obj => obj.id && obj.id !== '');
  }

  // Splits CSV text into rows, keeping newlines inside quoted fields intact.
  function splitCSVRows(text) {
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; current += ch; }
      } else if (ch === '\r') {
        if (!inQuotes) { if (text[i + 1] === '\n') i++; rows.push(current); current = ''; }
        else { current += ch; }
      } else if (ch === '\n') {
        if (!inQuotes) { rows.push(current); current = ''; }
        else { current += ch; }
      } else {
        current += ch;
      }
    }
    if (current) rows.push(current);
    return rows;
  }

  function parseCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  /**
   * Fetch genérico con cache. Devuelve array de objetos.
   */
  async function fetchSheet(nombre) {
    if (_cache[nombre]) return _cache[nombre];

    try {
      const url = CONFIG.SHEETS[nombre];
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const data = parseCSV(text);
      _cache[nombre] = data;
      return data;
    } catch (err) {
      console.error(`Error cargando pestaña "${nombre}":`, err);
      return [];
    }
  }

  /**
   * Carga todas las pestañas en paralelo.
   */
  async function fetchAll() {
    const [candidatos, propuestas, expertos, comentarios, redflags, resumenes, sectores] = await Promise.all([
      fetchSheet('candidatos'),
      fetchSheet('propuestas'),
      fetchSheet('expertos'),
      fetchSheet('comentarios_expertos'),
      fetchSheet('red_flags'),
      fetchSheet('resumen_sectores'),
      fetchSheet('sectores'),
    ]);
    return { candidatos, propuestas, expertos, comentarios, redflags, resumenes, sectores };
  }

  function buildSectorData(sectorNombre, { resumenes, sectores }) {
    const filas = (resumenes || []).filter(r => r.sector === sectorNombre);
    const porCandidato = {};
    filas.forEach(r => { porCandidato[r.candidato_id] = r; });
    const sectorInfo = (sectores || []).find(s => s.sector === sectorNombre) || {};
    return { porCandidato, youtubeUrl: sectorInfo.youtube_url || '' };
  }

  /**
   * Filtra y estructura los datos para un candidato específico.
   * Retorna propuestas agrupadas por tema, con expertos y alertas integradas.
   */
  function buildCandidatoData(candidatoId, { propuestas, expertos, comentarios, redflags }) {
    // Propuestas visibles de este candidato
    const misPropuestas = propuestas.filter(p =>
      p.candidato_id === candidatoId &&
      p.visible.toLowerCase() === 'si'
    );

    // Agrupar por tema
    const porTema = {};
    misPropuestas.forEach(p => {
      if (!porTema[p.tema]) porTema[p.tema] = [];

      // Buscar comentarios de expertos
      const experts = comentarios
        .filter(c => c.propuesta_id === p.id)
        .reduce((acc, c) => {
          const exp = expertos.find(e => e.id === c.experto_id);
          if (exp) acc.push({
            nombre:     exp.nombre,
            rol:        exp.rol,
            color:      exp.color_hex || CONFIG.COLORS.blue,
            comentario: c.comentario,
          });
          return acc;
        }, []);

      // Construir objeto de alerta
      const tieneAlerta = !!p.semaforo || !!p.alerta_explicacion;
      const alerta = tieneAlerta ? {
        nivel:        p.semaforo || 'accion',         // controla el indicador de fila y los filtros
        nivelBurbuja: p.semaforo_burbuja || 'accion', // controla la burbuja y el modal
        explicacion:  p.alerta_explicacion,
      } : null;

      porTema[p.tema].push({
        id:           p.id,
        titulo:       p.titulo,
        descripcion:  p.descripcion,
        subtema:      p.subtema,
        fuente:       p.fuente,
        actualizacion: p.fecha_actualizacion,
        alerta,
        experts,
      });
    });

    // Red flags visibles de este candidato
    const misRedFlags = redflags.filter(r =>
      r.candidato_id === candidatoId &&
      r.visible.toLowerCase() === 'si'
    );

    return { porTema, redflags: misRedFlags };
  }

  /**
   * Devuelve solo los candidatos visibles.
   */
  function getCandidatosVisibles(candidatos) {
    return candidatos.filter(c => c.visible.toLowerCase() === 'si');
  }

  // API pública
  return {
    fetchAll,
    fetchSheet,
    buildCandidatoData,
    buildSectorData,
    getCandidatosVisibles,
  };

})();