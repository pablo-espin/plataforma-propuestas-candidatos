/**
 * app.js
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
    currentSector:            null,
    sectorData:               null,
    currentSectorCandidatoId: null,
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
      Render.sectorCards();
      Render.footer(state.candidatos);
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
    state.currentSector = null;
    state.sectorData = null;
    state.currentSectorCandidatoId = null;

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
    Render.expertosPanel(candidatoData);
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
    setupExpertsPanelEvents();
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
     SECTORES
  ───────────────────────────────────────── */

  async function showSector(sectorNombre) {
    const temaCfg = CONFIG.TEMAS[sectorNombre];
    if (temaCfg && temaCfg.hidden) return;
    state.currentSector = sectorNombre;
    const sectorData = Data.buildSectorData(sectorNombre, state.allData);
    state.sectorData = sectorData;
    const cfg = CONFIG.TEMAS[sectorNombre] || {};

    document.getElementById('sector-breadcrumb-name').textContent = sectorNombre;

    const hero = document.getElementById('sector-hero');
    hero.style.setProperty('--sector-color', cfg.color || '#ccc');
    document.getElementById('sector-hero-icon').innerHTML = cfg.icon || '';
    document.getElementById('sector-hero-title').textContent = `Propuestas en ${sectorNombre}`;

    const videoEl = document.getElementById('sector-video');
    if (sectorData.youtubeUrl) {
      const videoId = extractYouTubeId(sectorData.youtubeUrl);
      videoEl.innerHTML = videoId
        ? `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0"
                   allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                   allowfullscreen style="width:100%;height:100%;display:block;border:none"></iframe>`
        : '<span>Video disponible próximamente</span>';
    } else {
      videoEl.innerHTML = '<span>Video disponible próximamente</span>';
    }

    Render.sectorCandidateSidebar(state.candidatos);
    Render.otrosSectores(sectorNombre);

    if (state.candidatos.length > 0) {
      showSectorCandidate(state.candidatos[0].id);
    }

    showPage('page-sector');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showSectorCandidate(candidatoId) {
    state.currentSectorCandidatoId = candidatoId;
    const candidato = state.candidatos.find(c => c.id === candidatoId);
    if (!candidato) return;

    document.querySelectorAll('.sector-candidate-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.id === candidatoId);
    });

    const resumen = state.sectorData ? state.sectorData.porCandidato[candidatoId] : null;
    const infoEl = document.getElementById('sector-candidate-info');
    infoEl.innerHTML = Render.sectorCandidateInfoHTML(candidato, resumen);
    infoEl.style.borderLeftColor = candidato.color_hex || CONFIG.COLORS.blue;
  }

  function toggleChipInfo(btn) {
    const popup = btn.nextElementSibling;
    const isHidden = popup.hasAttribute('hidden');
    document.querySelectorAll('.chip-info-popup').forEach(p => p.setAttribute('hidden', ''));
    if (isHidden) popup.removeAttribute('hidden');
  }

  function extractYouTubeId(url) {
    const m = url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : null;
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

  function setupExpertsPanelEvents() {
    const list = document.getElementById('expertos-panel-list');
    if (!list) return;

    // Close any open tooltip when clicking outside
    document.addEventListener('click', e => {
      if (!e.target.closest('.ep-expert')) {
        list.querySelectorAll('.ep-expert.tooltip-open').forEach(el => {
          el.classList.remove('tooltip-open');
          el.querySelector('.ep-tooltip').hidden = true;
        });
      }
    }, { capture: true, once: false });

    list.querySelectorAll('.ep-expert').forEach(el => {
      el.querySelector('.ep-avatar').addEventListener('click', e => {
        e.stopPropagation();
        const isOpen = el.classList.contains('tooltip-open');
        // Close all
        list.querySelectorAll('.ep-expert.tooltip-open').forEach(other => {
          other.classList.remove('tooltip-open');
          other.querySelector('.ep-tooltip').hidden = true;
        });
        if (!isOpen) {
          el.classList.add('tooltip-open');
          const tip = el.querySelector('.ep-tooltip');
          tip.style.left = '';
          tip.hidden = false;
          const viewportWidth = document.documentElement.clientWidth;
          const overflow = tip.getBoundingClientRect().right - viewportWidth + 8;
          if (overflow > 0) tip.style.left = `-${overflow}px`;
        }
      });
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

    document.addEventListener('click', () => {
      document.querySelectorAll('.chip-info-popup:not([hidden])').forEach(p => {
        p.setAttribute('hidden', '');
      });
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
    showSector,
    showSectorCandidate,
    toggleChipInfo,
  };

})();

// Arrancar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', App.init);
