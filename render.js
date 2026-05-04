/**
 * render.js
 * Todas las funciones que construyen y actualizan el DOM.
 * No contiene lógica de navegación ni de fetch — solo renderizado.
 */

const Render = (() => {

  /* ─────────────────────────────────────────
     HOME — grid de candidatos
  ───────────────────────────────────────── */

  function home(candidatos) {
    const grid = document.getElementById('candidates-grid');
    grid.innerHTML = candidatos.map(c => candidatoCard(c)).join('');
  }

  function candidatoCard(c) {
    const color = c.color_hex || CONFIG.COLORS.blue;
    const isLight = isLightColor(color);
    const textColor = isLight ? '#222' : '#fff';
    const photoInner = c.foto_url
      ? `<img src="${c.foto_url}" alt="${c.nombre}" class="card-photo-img">`
      : `<span class="card-initials">${getIniciales(c.nombre)}</span>`;

    return `
      <article class="candidate-card" data-id="${c.id}" role="button" tabindex="0"
               aria-label="Ver propuestas de ${c.nombre}">
        <div class="card-accent" style="background:${color}"></div>
        <div class="card-content">
          <div class="card-left">
            <div class="card-photo" style="background:${color};color:${textColor};">
              ${photoInner}
            </div>
          </div>
          <div class="card-right">
            <h3 class="card-name">${c.nombre}</h3>
            <p class="card-party">${c.partido}</p>
            <p class="card-bio">${c.biografia}</p>
          </div>
        </div>
        <button class="card-cta" tabindex="-1">Ver propuestas</button>
      </article>`;
  }

  /* ─────────────────────────────────────────
     PERFIL — header del candidato
  ───────────────────────────────────────── */

  function perfilHeader(candidato) {
    const color = candidato.color_hex || CONFIG.COLORS.blue;
    const isLight = isLightColor(color);
    const avatarTextColor = isLight ? '#222' : '#fff';
    const tintBg = hexToRgba(color, 0.10);

    const headerEl = document.getElementById('profile-header');
    headerEl.style.background = '#f2f2f2';
    headerEl.style.color = '#1a1a1a';

    const avatarEl = document.getElementById('profile-avatar');
    avatarEl.style.cssText = `background:${color};color:${avatarTextColor};`;
    if (candidato.foto_url) {
      avatarEl.innerHTML = `<img src="${candidato.foto_url}" alt="${candidato.nombre}" class="profile-avatar-img">`;
    } else {
      avatarEl.textContent = getIniciales(candidato.nombre);
    }

    document.getElementById('profile-name').textContent = candidato.nombre;

    const logoEl = document.getElementById('profile-party-logo');
    logoEl.innerHTML = candidato.logo_partido
      ? `<img src="${candidato.logo_partido}" alt="Logo ${candidato.partido}">`
      : '';

    const partyVpEl = document.getElementById('profile-party-vp');
    partyVpEl.style.cssText = `background:${tintBg};color:#1a1a1a;`;

    const vpEl = document.getElementById('profile-vp');
    vpEl.textContent = candidato.formula_vp;

    const eduBioEl = document.getElementById('profile-edu-bio');
    eduBioEl.style.cssText = `background:${tintBg};color:#1a1a1a;`;

    document.getElementById('profile-edu').textContent = '🎓 ' + candidato.educacion;
    document.getElementById('profile-bio').textContent = candidato.biografia;
  }

  /* ─────────────────────────────────────────
     COMPARE SELECT — dropdown
  ───────────────────────────────────────── */

  function compareSelect(candidatos, currentId) {
    const sel = document.getElementById('compare-select');
    sel.innerHTML = '<option value="">— Comparar con otro candidato —</option>' +
      candidatos
        .filter(c => c.id !== currentId)
        .map(c => `<option value="${c.id}">${c.nombre}</option>`)
        .join('');
  }

  /* ─────────────────────────────────────────
     PROPUESTAS — columnas (una o dos)
  ───────────────────────────────────────── */

  function propuestas(candidatoData, candidatoNombre, candidatoColor, comparaData, comparaNombre, comparaColor) {
    const container = document.getElementById('proposals-container');
    const twoCol = !!comparaData;

    container.className = twoCol ? 'proposals-container two-col' : 'proposals-container';

    if (twoCol) {
      container.innerHTML = `
        <div class="proposals-col">
          <div class="col-label" style="border-color:${candidatoColor||CONFIG.COLORS.blue}">
            <span class="col-dot" style="background:${candidatoColor||CONFIG.COLORS.blue}"></span>
            ${candidatoNombre}
          </div>
          ${renderColumna(candidatoData)}
        </div>
        <div class="proposals-col">
          <div class="col-label" style="border-color:${comparaColor||CONFIG.COLORS.orange}">
            <span class="col-dot" style="background:${comparaColor||CONFIG.COLORS.orange}"></span>
            ${comparaNombre}
          </div>
          ${renderColumna(comparaData)}
        </div>`;
    } else {
      container.innerHTML = `<div class="proposals-col">${renderColumna(candidatoData)}</div>`;
    }

    // Activar acordeones
    container.querySelectorAll('.sector-header').forEach(header => {
      header.addEventListener('click', () => {
        const block = header.closest('.sector-block');
        block.classList.toggle('open');
      });
    });
  }

  function renderColumna(data) {
    if (!data || Object.keys(data.porTema).length === 0) {
      return '<p class="empty-state">No hay propuestas disponibles aún.</p>';
    }

    return Object.entries(data.porTema).map(([tema, items], idx) => {
      const cfg = CONFIG.TEMAS[tema] || { icon: '📋', color: '#555', bg: '#f0f0f0' };
      const isOpen = idx === 0 ? 'open' : '';

      return `
        <div class="sector-block ${isOpen}">
          <button class="sector-header" aria-expanded="${idx === 0}">
            <div class="sector-title">
              <span class="sector-icon" style="background:${cfg.bg};" aria-hidden="true">${cfg.icon}</span>
              <span>${tema}</span>
            </div>
            <span class="sector-chevron" aria-hidden="true">▾</span>
          </button>
          <div class="sector-body" role="region">
            ${items.map(p => renderPropuesta(p)).join('')}
          </div>
        </div>`;
    }).join('');
  }

  function renderPropuesta(p) {
    const alertaBtn = p.alerta ? renderAlertaBtn(p.alerta, p.id) : '';
    const expertBtns = p.experts && p.experts.length > 0
      ? p.experts.map((exp, i) => renderExpertBtn(exp, p.id, i)).join('')
      : '';
    const fuenteLink = p.fuente
      ? `<a href="${p.fuente}" target="_blank" rel="noopener" class="proposal-source" title="Ver fuente">↗ fuente</a>`
      : '';
    const subtemaTag = p.subtema
      ? `<span class="subtema-tag">${p.subtema}</span>`
      : '';
    const alertaBubble = p.alerta ? renderAlertaBubble(p.alerta, p.id) : '';
    const commentBubbles = p.experts && p.experts.length > 0
      ? p.experts.map((exp, i) => renderExpertCommentBubble(exp, p.id, i)).join('')
      : '';
    const allBubbles = alertaBubble + commentBubbles;

    const alertaClass = p.alerta  ? ` alerta-${p.alerta.nivel}` : '';
    const dataSubtema = p.subtema ? ` data-subtema="${p.subtema}"` : '';
    const dataAlerta  = p.alerta  ? ` data-alerta="${p.alerta.nivel}"` : '';
    return `
      <div class="proposal-row${alertaClass}"${dataSubtema}${dataAlerta}>
        <div class="proposal-item" data-id="${p.id}">
          <div class="proposal-main">
            <div class="proposal-text">
              <div class="proposal-meta-row">
                ${subtemaTag}
                ${fuenteLink}
              </div>
              <div class="proposal-title">${p.titulo}</div>
              <div class="proposal-desc">${p.descripcion}</div>
            </div>
            <div class="proposal-actions">
              ${alertaBtn}
              ${expertBtns}
            </div>
          </div>
        </div>
        ${allBubbles ? `<div class="proposal-comments-panel">${allBubbles}</div>` : ''}
      </div>`;
  }

  function renderAlertaBtn(alerta, propuestaId) {
    const cfg = CONFIG.SEMAFORO[alerta.nivel] || CONFIG.SEMAFORO.amarillo;
    const bubbleId = `alc-${propuestaId}`;
    return `
      <button class="alerta-btn semaforo-${alerta.nivel}"
              data-propuesta-id="${propuestaId}"
              data-type="alerta"
              data-comment-id="${bubbleId}"
              title="${cfg.label}: ${alerta.explicacion}"
              aria-label="Alerta Estado de Derecho: ${cfg.label}">
        ${cfg.icon}
      </button>`;
  }

  function renderAlertaBubble(alerta, propuestaId) {
    const cfg = CONFIG.SEMAFORO[alerta.nivel] || CONFIG.SEMAFORO.amarillo;
    const bubbleId = `alc-${propuestaId}`;
    return `
      <div class="alerta-comment-bubble semaforo-${alerta.nivel}" id="${bubbleId}" hidden>
        <div class="acb-header">
          <span class="acb-label">${cfg.label}</span>
          <button class="ecb-close" data-comment-id="${bubbleId}" aria-label="Cerrar">×</button>
        </div>
        <p class="ecb-text">${alerta.explicacion}</p>
      </div>`;
  }

  function renderExpertBtn(expert, propuestaId, index) {
    const iniciales = getIniciales(expert.nombre);
    const commentId = `ec-${propuestaId}-${index}`;
    return `
      <button class="expert-btn"
              data-propuesta-id="${propuestaId}"
              data-type="expert"
              data-comment-id="${commentId}"
              style="background:${expert.color};"
              title="Comentario de ${expert.nombre}"
              aria-label="Ver comentario de experto: ${expert.nombre}">
        ${iniciales}
      </button>`;
  }

  function renderExpertCommentBubble(expert, propuestaId, index) {
    const commentId = `ec-${propuestaId}-${index}`;
    const iniciales = getIniciales(expert.nombre);
    return `
      <div class="expert-comment-bubble" id="${commentId}" style="border-left-color:${expert.color}" hidden>
        <div class="ecb-header">
          <div class="ecb-avatar" style="background:${expert.color}">${iniciales}</div>
          <div class="ecb-meta">
            <div class="ecb-name">${expert.nombre}</div>
            <div class="ecb-role">${expert.rol}</div>
          </div>
          <button class="ecb-close" data-comment-id="${commentId}" aria-label="Cerrar comentario">×</button>
        </div>
        <blockquote class="ecb-text">${expert.comentario}</blockquote>
      </div>`;
  }

  /* ─────────────────────────────────────────
     RED FLAGS
  ───────────────────────────────────────── */

  function redFlags(flags) {
    const section = document.getElementById('red-flags-section');

    if (!flags || flags.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = 'block';
    document.getElementById('red-flags-grid').innerHTML = flags.map(rf => `
      <div class="rf-card">
        <div class="rf-video-thumb" data-url="${rf.url_video || ''}">
          <div class="rf-play-btn" aria-label="Ver video">▶</div>
        </div>
        <div class="rf-card-body">
          <span class="rf-badge">${rf.badge}</span>
          <h4 class="rf-card-title">${rf.titulo}</h4>
          <p class="rf-card-meta">${rf.meta}</p>
        </div>
      </div>`).join('');

    // Click en video
    section.querySelectorAll('.rf-video-thumb').forEach(thumb => {
      thumb.addEventListener('click', () => {
        const url = thumb.dataset.url;
        if (url) window.open(url, '_blank', 'noopener');
      });
    });
  }

  /* ─────────────────────────────────────────
     MODALES
  ───────────────────────────────────────── */

  function modalAlerta(alerta) {
    const cfg = CONFIG.SEMAFORO[alerta.nivel] || CONFIG.SEMAFORO.amarillo;
    document.getElementById('modal-icon').textContent = cfg.icon;
    document.getElementById('modal-icon').style.color = cfg.color;
    document.getElementById('modal-title').textContent = cfg.label + ' — Estado de Derecho';
    document.getElementById('modal-title').style.color = cfg.color;
    document.getElementById('modal-body-content').innerHTML = `
      <p class="modal-text">${alerta.explicacion}</p>`;
    document.getElementById('modal-footer').innerHTML = '';
    openModal();
  }

  function modalExperto(expert) {
    const iniciales = getIniciales(expert.nombre);
    document.getElementById('modal-icon').textContent = '';
    document.getElementById('modal-icon').style.color = 'inherit';
    document.getElementById('modal-title').style.color = 'inherit';
    document.getElementById('modal-title').textContent = expert.nombre;
    document.getElementById('modal-body-content').innerHTML = `
      <p class="modal-expert-role">${expert.rol}</p>
      <blockquote class="modal-quote">${expert.comentario}</blockquote>`;
    document.getElementById('modal-footer').innerHTML = `
      <div class="modal-expert-avatar" style="background:${expert.color}">${iniciales}</div>`;
    openModal();
  }

  function openModal() {
    document.getElementById('modal-overlay').classList.add('open');
    document.getElementById('modal-overlay').setAttribute('aria-hidden', 'false');
    document.getElementById('modal-close').focus();
  }

  function closeModal() {
    document.getElementById('modal-overlay').classList.remove('open');
    document.getElementById('modal-overlay').setAttribute('aria-hidden', 'true');
  }

  /* ─────────────────────────────────────────
     LOADING / ERROR
  ───────────────────────────────────────── */

  function showLoading() {
    document.getElementById('loading-screen').style.display = 'flex';
  }

  function hideLoading() {
    document.getElementById('loading-screen').style.display = 'none';
  }

  function showError(msg) {
    const el = document.getElementById('error-banner');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function hideError() {
    document.getElementById('error-banner').style.display = 'none';
  }

  /* ─────────────────────────────────────────
     COMPARE BANNER
  ───────────────────────────────────────── */

  function compareBanner(nombre1, nombre2) {
    const banner = document.getElementById('compare-banner');
    if (nombre1 && nombre2) {
      banner.textContent = `Comparando: ${nombre1}  vs  ${nombre2}`;
      banner.classList.add('visible');
    } else {
      banner.classList.remove('visible');
    }
  }

  /* ─────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────── */

  function getIniciales(nombre) {
    return nombre.split(' ')
      .filter(w => w.length > 2)
      .map(w => w[0].toUpperCase())
      .slice(0, 2)
      .join('');
  }

  function isLightColor(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0,2), 16);
    const g = parseInt(c.substr(2,2), 16);
    const b = parseInt(c.substr(4,2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 150;
  }

  function hexToRgba(hex, alpha) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0,2), 16);
    const g = parseInt(c.substr(2,2), 16);
    const b = parseInt(c.substr(4,2), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  /* ─────────────────────────────────────────
     FILTROS
  ───────────────────────────────────────── */

  function filterBar(subtemas, alertLevels, activeSubtemas, activeAlerts) {
    const bar = document.getElementById('filter-bar');
    if (!bar) return;

    if (subtemas.length === 0 && alertLevels.length === 0) {
      bar.style.display = 'none';
      return;
    }

    const alertLabels = { amarillo: 'Alerta', rojo: 'Amenaza' };

    const subtemasGroup = subtemas.length > 0 ? `
      <div class="filter-group">
        <span class="filter-label">Subtemas</span>
        <div class="filter-tags">
          ${subtemas.map(s => `
            <button class="filter-tag${activeSubtemas.has(s) ? ' active' : ''}"
                    data-filter-type="subtema" data-value="${s}">${s}</button>
          `).join('')}
        </div>
      </div>` : '';

    const alertsGroup = alertLevels.length > 0 ? `
      <div class="filter-group">
        <span class="filter-label">Estado de Derecho</span>
        <div class="filter-tags">
          ${alertLevels.map(level => `
            <button class="filter-tag filter-alert-${level}${activeAlerts.has(level) ? ' active' : ''}"
                    data-filter-type="alert" data-value="${level}">${alertLabels[level] || level}</button>
          `).join('')}
        </div>
      </div>` : '';

    const hasActive = activeSubtemas.size > 0 || activeAlerts.size > 0;

    bar.style.display = 'flex';
    bar.innerHTML = `
      ${subtemasGroup}
      ${alertsGroup}
      <button class="filter-clear" id="filter-clear"
              style="display:${hasActive ? 'inline-flex' : 'none'}">✕ Limpiar filtros</button>`;
  }

  function applyFilters(activeSubtemas, activeAlerts) {
    const hasSubtema = activeSubtemas.size > 0;
    const hasAlert   = activeAlerts.size > 0;

    document.querySelectorAll('#proposals-container .proposal-row').forEach(row => {
      let show = true;
      if (hasSubtema && !activeSubtemas.has(row.dataset.subtema || '')) show = false;
      if (show && hasAlert && !activeAlerts.has(row.dataset.alerta || ''))  show = false;
      row.classList.toggle('proposal-filtered-out', !show);
    });

    document.querySelectorAll('#proposals-container .sector-block').forEach(block => {
      const body = block.querySelector('.sector-body');
      if (!body) return;
      const hasVisible = body.querySelectorAll('.proposal-row:not(.proposal-filtered-out)').length > 0;
      block.style.display = hasVisible ? '' : 'none';
    });
  }

  // API pública
  return {
    home,
    perfilHeader,
    compareSelect,
    propuestas,
    redFlags,
    filterBar,
    applyFilters,
    modalAlerta,
    modalExperto,
    closeModal,
    showLoading,
    hideLoading,
    showError,
    hideError,
    compareBanner,
  };

})();
