/**
 * app.js
 * Lógica de navegación, estado de la app y event handlers.
 * Es el punto de entrada principal — se carga de último.
 */

const App = (() => {

  // Estado global de la aplicación
  const state = {
    allData: null,
    candidatos: [],
    currentCandidatoId: null,
    comparaCandidatoId: null,
    propuestaMap: {},
    activeSubtemas: new Set(),
    activeAlerts:   new Set(),
  };

  /* ─────────────────────────────────────────
     INIT
  ───────────────────────────────────────── */

  function initDotGrid() {
    const grid = document.getElementById('dot-grid');
    if (!grid) return;
    const header = grid.closest('.home-header');
    const STEP = 34;

    function build() {
      const w = header.offsetWidth;
      const h = header.offsetHeight;
      const cols = Math.ceil(w / STEP) + 1;
      const rows = Math.ceil(h / STEP) + 1;
      const total = cols * rows;

      grid.style.gridTemplateColumns = `repeat(${cols}, ${STEP}px)`;
      grid.style.gridTemplateRows    = `repeat(${rows}, ${STEP}px)`;

      if (grid.children.length === total) return;
      grid.innerHTML = '';
      const frag = document.createDocumentFragment();
      for (let i = 0; i < total; i++) {
        const d = document.createElement('div');
        d.className = 'dot';
        frag.appendChild(d);
      }
      grid.appendChild(frag);
    }

    build();
    window.addEventListener('resize', build);

    // Toggle fill on each hover entry — state persists until hovered again
    grid.addEventListener('mouseover', e => {
      const dot = e.target.closest('.dot');
      if (!dot) return;
      if (!dot.contains(e.relatedTarget)) {
        dot.classList.toggle('dot-toggled');
      }
    });
  }

  async function init() {
    initDotGrid();
    Render.showLoading();
    Render.hideError();

    try {
      const data = await Data.fetchAll();
      state.allData = data;
      state.candidatos = Data.getCandidatosVisibles(data.candidatos);

      if (state.candidatos.length === 0) {
        Render.showError('No se encontraron candidatos. Verifica que la Google Sheet esté publicada y que el ID en config.js sea correcto.');
        Render.hideLoading();
        return;
      }

      Render.home(state.candidatos);
      setupHomeEvents();
      setupModalEvents();
      setupKeyboard();
      setupFilterEvents();

    } catch (err) {
      console.error('Error al inicializar la app:', err);
      Render.showError('Error al cargar los datos. Verifica la conexión con Google Sheets.');
    } finally {
      Render.hideLoading();
    }
  }

  /* ─────────────────────────────────────────
     NAVEGACIÓN
  ───────────────────────────────────────── */

  function goHome() {
    state.currentCandidatoId = null;
    state.comparaCandidatoId = null;
    state.propuestaMap = {};
    state.activeSubtemas.clear();
    state.activeAlerts.clear();

    showPage('page-home');
    Render.compareBanner(null, null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function showCandidato(id) {
    state.currentCandidatoId = id;
    state.comparaCandidatoId = null;

    const candidato = state.candidatos.find(c => c.id === id);
    if (!candidato) return;

    // Construir datos del candidato y poblar mapa de propuestas
    const candidatoData = Data.buildCandidatoData(id, state.allData);
    buildPropuestaMap(candidatoData);

    // Renderizar
    Render.breadcrumb(candidato);
    Render.perfilHeader(candidato);
    Render.compareSelect(state.candidatos, id);
    Render.propuestas(
      candidatoData, candidato.nombre, candidato.color_hex,
      null, null, null
    );
    Render.otrosCandidatos(state.candidatos, id);
    Render.redFlags(candidatoData.redflags);
    Render.compareBanner(null, null);

    // Mostrar página
    showPage('page-profile');
    document.getElementById('clear-compare-btn').style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Event listeners de propuestas (alertas y expertos)
    setupProposalEvents();
    refreshFilters();
  }

  async function doCompare() {
    const sel = document.getElementById('compare-select');
    const comparaId = sel.value;
    if (!comparaId) return;

    state.comparaCandidatoId = comparaId;

    const candidato1 = state.candidatos.find(c => c.id === state.currentCandidatoId);
    const candidato2 = state.candidatos.find(c => c.id === comparaId);

    const data1 = Data.buildCandidatoData(state.currentCandidatoId, state.allData);
    const data2 = Data.buildCandidatoData(comparaId, state.allData);

    // Ampliar el mapa con propuestas del candidato comparado
    buildPropuestaMap(data2);

    Render.propuestas(
      data1, candidato1.nombre, candidato1.color_hex,
      data2, candidato2.nombre, candidato2.color_hex
    );
    Render.compareBanner(candidato1.nombre, candidato2.nombre);

    document.getElementById('clear-compare-btn').style.display = 'inline-block';
    setupProposalEvents();
    refreshFilters();

    document.getElementById('proposals-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearCompare() {
    state.comparaCandidatoId = null;
    state.propuestaMap = {};

    const candidato = state.candidatos.find(c => c.id === state.currentCandidatoId);
    const data = Data.buildCandidatoData(state.currentCandidatoId, state.allData);
    buildPropuestaMap(data);

    Render.propuestas(data, candidato.nombre, candidato.color_hex, null, null, null);
    Render.compareBanner(null, null);

    document.getElementById('clear-compare-btn').style.display = 'none';
    setupProposalEvents();
    refreshFilters();
  }

  /* ─────────────────────────────────────────
     MAPA DE PROPUESTAS (para modales)
  ───────────────────────────────────────── */

  function buildPropuestaMap(candidatoData) {
    Object.values(candidatoData.porTema).forEach(items => {
      items.forEach(p => {
        state.propuestaMap[p.id] = p;
      });
    });
  }

  /* ─────────────────────────────────────────
     EVENT LISTENERS
  ───────────────────────────────────────── */

  function setupHomeEvents() {
    document.getElementById('candidates-grid').addEventListener('click', e => {
      const card = e.target.closest('.candidate-card');
      if (card) showCandidato(card.dataset.id);
    });

    document.getElementById('candidates-grid').addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        const card = e.target.closest('.candidate-card');
        if (card) showCandidato(card.dataset.id);
      }
    });
  }

  function setupProposalEvents() {
    const container = document.getElementById('proposals-container');

    // Remover listeners anteriores clonando el nodo
    const newContainer = container.cloneNode(true);
    container.parentNode.replaceChild(newContainer, container);

    // Re-activar acordeones
    newContainer.querySelectorAll('.sector-header').forEach(header => {
      header.addEventListener('click', () => {
        const block = header.closest('.sector-block');
        const isOpen = block.classList.toggle('open');
        header.setAttribute('aria-expanded', isOpen);
      });
    });

    // Botones de alerta y experto
    newContainer.addEventListener('click', e => {
      // Cerrar burbuja (alerta o experto)
      const closeBtn = e.target.closest('.ecb-close');
      if (closeBtn) {
        const commentId = closeBtn.dataset.commentId;
        const bubble = document.getElementById(commentId);
        if (!bubble) return;
        bubble.setAttribute('hidden', '');
        const panel = bubble.closest('.proposal-comments-panel');
        if (panel && !panel.querySelector('.expert-comment-bubble:not([hidden]), .alerta-comment-bubble:not([hidden])')) {
          panel.classList.remove('open');
        }
        const triggerBtn = newContainer.querySelector(`[data-comment-id="${commentId}"]`);
        if (triggerBtn) triggerBtn.classList.remove('active');
        return;
      }

      const btn = e.target.closest('[data-type]');
      if (!btn) return;

      const commentId = btn.dataset.commentId;
      if (!commentId) return;

      const bubble = document.getElementById(commentId);
      if (!bubble) return;
      const panel = bubble.closest('.proposal-comments-panel');

      if (bubble.hasAttribute('hidden')) {
        bubble.removeAttribute('hidden');
        btn.classList.add('active');
        if (panel) panel.classList.add('open');
      } else {
        bubble.setAttribute('hidden', '');
        btn.classList.remove('active');
        if (panel && !panel.querySelector('.expert-comment-bubble:not([hidden]), .alerta-comment-bubble:not([hidden])')) {
          panel.classList.remove('open');
        }
      }
    });
  }

  function collectFilterOptions() {
    const subtemas    = new Set();
    const alertLevels = new Set();
    document.querySelectorAll('#proposals-container .proposal-row').forEach(row => {
      if (row.dataset.subtema) subtemas.add(row.dataset.subtema);
      if (row.dataset.alerta)  alertLevels.add(row.dataset.alerta);
    });
    return { subtemas: [...subtemas].sort(), alertLevels: [...alertLevels] };
  }

  function refreshFilters() {
    const { subtemas, alertLevels } = collectFilterOptions();
    Render.filterBar(subtemas, alertLevels, state.activeSubtemas, state.activeAlerts);
    Render.applyFilters(state.activeSubtemas, state.activeAlerts);
  }

  function setupFilterEvents() {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    bar.addEventListener('click', e => {
      const clearBtn = e.target.closest('#filter-clear');
      if (clearBtn) {
        state.activeSubtemas.clear();
        state.activeAlerts.clear();
        bar.querySelectorAll('.filter-tag.active').forEach(t => t.classList.remove('active'));
        clearBtn.style.display = 'none';
        Render.applyFilters(state.activeSubtemas, state.activeAlerts);
        return;
      }

      const tag = e.target.closest('.filter-tag');
      if (!tag) return;

      const type  = tag.dataset.filterType;
      const value = tag.dataset.value;
      const set   = type === 'subtema' ? state.activeSubtemas : state.activeAlerts;

      if (set.has(value)) {
        set.delete(value);
        tag.classList.remove('active');
      } else {
        set.add(value);
        tag.classList.add('active');
      }

      const hasActive = state.activeSubtemas.size > 0 || state.activeAlerts.size > 0;
      const clear     = document.getElementById('filter-clear');
      if (clear) clear.style.display = hasActive ? 'inline-flex' : 'none';

      Render.applyFilters(state.activeSubtemas, state.activeAlerts);
    });
  }

  function setupModalEvents() {
    const overlay = document.getElementById('modal-overlay');

    document.getElementById('modal-close').addEventListener('click', Render.closeModal);

    overlay.addEventListener('click', e => {
      if (e.target === overlay) Render.closeModal();
    });
  }

  function setupKeyboard() {
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') Render.closeModal();
    });
  }

  /* ─────────────────────────────────────────
     HELPERS DE PÁGINA
  ───────────────────────────────────────── */

  function showMetodologia() {
    showPage('page-metodologia');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }

  /* ─────────────────────────────────────────
     API PÚBLICA
     (usada desde atributos onclick en el HTML)
  ───────────────────────────────────────── */

  return {
    init,
    goHome,
    showCandidato,
    showMetodologia,
    doCompare,
    clearCompare,
  };

})();

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', App.init);
