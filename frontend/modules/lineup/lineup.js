// ============================================================
// LINEUP.JS — Escalação tática do Sky FC
// ============================================================

import { state, isComissao } from '../../app/state/store.js';
import { db } from '../../app/providers/firebase-provider.js';
import { esc } from '../../shared/utils/helpers.js';

const FS_COLLECTION = 'lineups';

// ===== FORMAÇÕES =====
// Cada formação é um array de linhas (de baixo=GK para cima=Atacantes).
// Cada linha é um array de { id, label } com o rótulo em pt-BR.
const FORMATIONS = {
  '4-4-2': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'rb',  label: 'LD'  }, { id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'lb',  label: 'LE'  }],
    [{ id: 'rm',  label: 'ALD' }, { id: 'cm1', label: 'VOL' }, { id: 'cm2', label: 'VOL' }, { id: 'lm',  label: 'ALE' }],
    [{ id: 'st1', label: 'ATA' }, { id: 'st2', label: 'ATA' }]
  ],
  '4-3-3': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'rb',  label: 'LD'  }, { id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'lb',  label: 'LE'  }],
    [{ id: 'cm1', label: 'VOL' }, { id: 'cm2', label: 'MEI' }, { id: 'cm3', label: 'VOL' }],
    [{ id: 'rw',  label: 'PNT' }, { id: 'st',  label: 'ATA' }, { id: 'lw',  label: 'PNT' }]
  ],
  '4-2-3-1': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'rb',  label: 'LD'  }, { id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'lb',  label: 'LE'  }],
    [{ id: 'dm1', label: 'VOL' }, { id: 'dm2', label: 'VOL' }],
    [{ id: 'rw',  label: 'ALD' }, { id: 'am',  label: 'MEI' }, { id: 'lw',  label: 'ALE' }],
    [{ id: 'st',  label: 'ATA' }]
  ],
  '3-5-2': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'cb3', label: 'ZAG' }],
    [{ id: 'rm',  label: 'ALD' }, { id: 'cm1', label: 'VOL' }, { id: 'cm2', label: 'MEI' }, { id: 'cm3', label: 'VOL' }, { id: 'lm', label: 'ALE' }],
    [{ id: 'st1', label: 'ATA' }, { id: 'st2', label: 'ATA' }]
  ],
  '3-4-3': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'cb3', label: 'ZAG' }],
    [{ id: 'rm',  label: 'ALD' }, { id: 'cm1', label: 'VOL' }, { id: 'cm2', label: 'VOL' }, { id: 'lm',  label: 'ALE' }],
    [{ id: 'rw',  label: 'PNT' }, { id: 'st',  label: 'ATA' }, { id: 'lw',  label: 'PNT' }]
  ],
  '5-3-2': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'rb',  label: 'LD'  }, { id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'cb3', label: 'ZAG' }, { id: 'lb', label: 'LE' }],
    [{ id: 'cm1', label: 'VOL' }, { id: 'cm2', label: 'MEI' }, { id: 'cm3', label: 'VOL' }],
    [{ id: 'st1', label: 'ATA' }, { id: 'st2', label: 'ATA' }]
  ],
  '4-1-4-1': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'rb',  label: 'LD'  }, { id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'lb',  label: 'LE'  }],
    [{ id: 'dm',  label: 'VOL' }],
    [{ id: 'rm',  label: 'ALD' }, { id: 'cm1', label: 'MEI' }, { id: 'cm2', label: 'MEI' }, { id: 'lm',  label: 'ALE' }],
    [{ id: 'st',  label: 'ATA' }]
  ],
  '4-4-1-1': [
    [{ id: 'gk',  label: 'GOL' }],
    [{ id: 'rb',  label: 'LD'  }, { id: 'cb1', label: 'ZAG' }, { id: 'cb2', label: 'ZAG' }, { id: 'lb',  label: 'LE'  }],
    [{ id: 'rm',  label: 'ALD' }, { id: 'cm1', label: 'VOL' }, { id: 'cm2', label: 'VOL' }, { id: 'lm',  label: 'ALE' }],
    [{ id: 'ss',  label: 'MEI' }],
    [{ id: 'st',  label: 'ATA' }]
  ]
};

// ===== ESTADO LOCAL =====
let _currentFormation = '4-4-2';
let _assignments = {};        // { posId: playerName }
let _customPositions = {};    // { posId: { top, left } } — posições arrastadas livremente
let _activePos = null;        // posição sendo editada no picker
let _players = [];            // lista de jogadores do Firestore
let _savedLineups = [];       // escalações salvas (rascunhos) — só editor
let _canEdit = false;         // true somente para comissão técnica (isComissao())

const LS_KEY_ACTIVE  = 'skyfc_lineup_active';
const LS_KEY_SAVED   = 'skyfc_lineup_saved';

// ===== FIRESTORE: carregar/publicar escalação do time =====
async function loadPublishedLineup() {
  const teamId = state.currentUser?.teamId;
  if (!db || !teamId) return null;
  try {
    const doc = await db.collection(FS_COLLECTION).doc(teamId).get();
    return doc.exists ? doc.data() : null;
  } catch { return null; }
}

async function publishToFirestore() {
  const teamId = state.currentUser?.teamId;
  if (!db || !teamId) return;
  const matchInfo = document.getElementById('lineupMatchInfo')?.value.trim() || '';
  const entry = {
    formation: _currentFormation,
    players: { ..._assignments },
    customPositions: { ..._customPositions },
    matchInfo,
    savedBy: state.currentUser?.uid || '',
    savedByName: state.currentUser?.fullName || state.currentUser?.name || 'Treinador',
    savedAt: new Date().toISOString()
  };
  await db.collection(FS_COLLECTION).doc(teamId).set(entry);
  return entry;
}

// ===== CONTROLE DE PERMISSÃO DA UI =====
function applyRoleUI() {
  const saveBtn    = document.getElementById('lineupSaveBtn');
  const matchInput = document.getElementById('lineupMatchInfo');
  const formBar    = document.querySelector('.lineup-formation-bar');
  const savedSec   = document.getElementById('lineupSavedSection');
  const section    = document.getElementById('lineup');

  if (_canEdit) {
    if (saveBtn)    { saveBtn.style.display = ''; }
    if (matchInput) { matchInput.removeAttribute('readonly'); }
    if (formBar)    { formBar.style.display = ''; }
    section?.classList.remove('lineup-readonly');
    if (savedSec) savedSec.style.display = _savedLineups.length ? 'flex' : 'none';
  } else {
    if (saveBtn)    { saveBtn.style.display = 'none'; }
    if (matchInput) { matchInput.setAttribute('readonly', ''); }
    if (formBar)    { formBar.style.display = 'none'; }
    section?.classList.add('lineup-readonly');
    if (savedSec) savedSec.style.display = 'none';
  }
}

function showPublishedInfo(entry) {
  const bar = document.getElementById('lineupPublishedInfo');
  const txt = document.getElementById('lineupPublishedText');
  if (!bar || !txt) return;
  if (entry) {
    const date = entry.savedAt
      ? new Date(entry.savedAt).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
      : '—';
    txt.textContent = `Publicado por ${entry.savedByName || 'Treinador'} em ${date}`;
    bar.style.display = 'flex';
  } else {
    bar.style.display = 'none';
  }
}

// ===== HELPERS (rascunho local — somente editor) =====
function loadFromStorage() {
  try {
    const active = JSON.parse(localStorage.getItem(LS_KEY_ACTIVE) || '{}');
    _currentFormation = active.formation || '4-4-2';
    _assignments = active.players || {};
    _customPositions = active.customPositions || {};
    const matchInput = document.getElementById('lineupMatchInfo');
    if (matchInput) matchInput.value = active.matchInfo || '';
  } catch { _assignments = {}; _customPositions = {}; }

  try {
    _savedLineups = JSON.parse(localStorage.getItem(LS_KEY_SAVED) || '[]');
  } catch { _savedLineups = []; }
}

function saveActive() {
  const matchInfo = document.getElementById('lineupMatchInfo')?.value.trim() || '';
  localStorage.setItem(LS_KEY_ACTIVE, JSON.stringify({
    formation: _currentFormation,
    players: _assignments,
    customPositions: _customPositions,
    matchInfo,
    updatedAt: new Date().toISOString()
  }));
}

function persistSaved() {
  localStorage.setItem(LS_KEY_SAVED, JSON.stringify(_savedLineups));
}

// ===== CARREGAR JOGADORES DO FIRESTORE =====
async function loadPlayers() {
  if (_players.length > 0) return;
  if (!db || !state.currentUser?.teamId) return;
  try {
    const snap = await db.collection('users')
      .where('teamId', '==', state.currentUser.teamId)
      .get();
    _players = snap.docs.map(d => ({ ...d.data(), uid: d.id }))
      .filter(p => p.isActive !== false)
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
  } catch { _players = []; }
}

// ===== CALCULAR POSIÇÕES NO CAMPO =====
function computePositions(formation) {
  const rows = FORMATIONS[formation];
  const numRows = rows.length;
  const result = [];

  rows.forEach((row, rowIdx) => {
    // rowIdx 0 = GK = parte inferior do campo (top% alto)
    // rowIdx numRows-1 = Atacantes = parte superior (top% baixo)
    const topPct = numRows === 1 ? 50
      : 91 - (rowIdx / (numRows - 1)) * 82;

    row.forEach((pos, colIdx) => {
      const colCount = row.length;
      const leftPct = colCount === 1 ? 50
        : 8 + (colIdx / (colCount - 1)) * 84;
      result.push({ ...pos, top: topPct, left: leftPct });
    });
  });
  return result;
}

// ===== RENDERIZAR FORMAÇÕES (chips) =====
function renderFormationChips() {
  const container = document.getElementById('lineupFormations');
  if (!container) return;
  container.innerHTML = Object.keys(FORMATIONS).map(f => `
    <button class="lf-chip ${f === _currentFormation ? 'active' : ''}" data-formation="${f}">${f}</button>
  `).join('');
  if (!_canEdit) return;  // leitores não interagem com chips
  container.querySelectorAll('.lf-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      _currentFormation = btn.dataset.formation;
      _customPositions = {};  // reset posições livres ao trocar formação
      const newPosIds = computePositions(_currentFormation).map(p => p.id);
      Object.keys(_assignments).forEach(k => {
        if (!newPosIds.includes(k)) delete _assignments[k];
      });
      renderFormationChips();
      renderField();
      saveActive();
    });
  });
}

// ===== RENDERIZAR CAMPO =====
function renderField() {
  const container = document.getElementById('lineupPositions');
  if (!container) return;
  const positions = computePositions(_currentFormation);

  container.innerHTML = positions.map(pos => {
    const cp = _customPositions[pos.id];
    const top  = cp ? cp.top  : pos.top;
    const left = cp ? cp.left : pos.left;
    const name = _assignments[pos.id] || '';
    const filled = !!name;
    const isGk = pos.id === 'gk';
    const displayName = name.length > 8 ? name.slice(0, 8) + '…' : name;
    return `
      <div class="lp-slot ${filled ? 'lp-filled' : ''} ${isGk ? 'lp-gk' : ''}"
           style="top:${top.toFixed(1)}%;left:${left.toFixed(1)}%"
           data-pos-id="${pos.id}" data-pos-label="${pos.label}" title="${pos.label}${name ? ': '+name : ''}">
        <div class="lp-circle">
          ${filled
            ? `<span class="lp-pos-label">${esc(pos.label)}</span>`
            : `<i class="fa-solid fa-plus lp-icon"></i><span class="lp-pos-label">${esc(pos.label)}</span>`}
        </div>
        ${filled ? `<span class="lp-name-tag">${esc(displayName)}</span>` : ''}
      </div>`;
  }).join('');

  if (!_canEdit) return;  // jogadores só visualizam

  const field = document.getElementById('lineupField');

  container.querySelectorAll('.lp-slot').forEach(slot => {
    const posId = slot.dataset.posId;
    let isDragging = false;
    let dragMoved  = false;
    let startX, startY;
    let pressTimer;

    slot.addEventListener('pointerdown', e => {
      e.stopPropagation();
      isDragging = false;
      dragMoved  = false;
      startX = e.clientX;
      startY = e.clientY;
      slot.setPointerCapture(e.pointerId);

      // Long press para limpar jogador
      pressTimer = setTimeout(() => {
        if (!dragMoved && _assignments[posId]) {
          delete _assignments[posId];
          renderField();
          saveActive();
        }
      }, 600);
    });

    slot.addEventListener('pointermove', e => {
      if (!e.buttons) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 8) {
        isDragging = true;
        dragMoved  = true;
        clearTimeout(pressTimer);
        slot.classList.add('lp-dragging');
      }

      if (isDragging) {
        const fieldRect = field.getBoundingClientRect();
        const newLeft = ((e.clientX - fieldRect.left) / fieldRect.width)  * 100;
        const newTop  = ((e.clientY - fieldRect.top)  / fieldRect.height) * 100;
        slot.style.left = Math.max(4, Math.min(96, newLeft)).toFixed(1) + '%';
        slot.style.top  = Math.max(4, Math.min(96, newTop)).toFixed(1)  + '%';
      }
    });

    slot.addEventListener('pointerup', e => {
      clearTimeout(pressTimer);
      slot.classList.remove('lp-dragging');
      if (isDragging) {
        const fieldRect = field.getBoundingClientRect();
        _customPositions[posId] = {
          left: Math.max(4, Math.min(96, ((e.clientX - fieldRect.left) / fieldRect.width)  * 100)),
          top:  Math.max(4, Math.min(96, ((e.clientY - fieldRect.top)  / fieldRect.height) * 100))
        };
        saveActive();
        isDragging = false;
      }
    });

    slot.addEventListener('pointercancel', () => {
      clearTimeout(pressTimer);
      slot.classList.remove('lp-dragging');
      isDragging = false;
    });

    // Tap para abrir picker — só se não arrastou
    slot.addEventListener('click', () => {
      if (dragMoved) { dragMoved = false; return; }
      openPicker(posId, slot.dataset.posLabel);
    });
  });
}

// ===== PLAYER PICKER =====
function openPicker(posId, posLabel) {
  _activePos = posId;
  const overlay = document.getElementById('lineupPickerOverlay');
  const labelEl = document.getElementById('lineupPickerLabel');
  const searchInput = document.getElementById('lineupPickerSearch');
  if (labelEl) labelEl.textContent = `${posLabel} — Escolher jogador`;
  if (searchInput) searchInput.value = '';
  renderPickerList('');
  overlay?.classList.add('active');
  searchInput?.focus();
}

function closePicker() {
  _activePos = null;
  document.getElementById('lineupPickerOverlay')?.classList.remove('active');
  document.getElementById('lineupCustomName').value = '';
  document.getElementById('lineupPickerSearch').value = '';
}

function renderPickerList(filter) {
  const list = document.getElementById('lineupPickerList');
  if (!list) return;

  const usedNames = new Set(Object.entries(_assignments)
    .filter(([k]) => k !== _activePos)
    .map(([, v]) => v));

  const q = filter.toLowerCase().trim();
  const visible = _players.filter(p => {
    const name = p.fullName || p.name || '';
    return !q || name.toLowerCase().includes(q);
  });

  if (visible.length === 0 && _players.length > 0) {
    list.innerHTML = `<p class="lpp-empty">Nenhum jogador encontrado</p>`;
    return;
  }
  if (_players.length === 0) {
    list.innerHTML = `<p class="lpp-empty">Carregando jogadores...</p>`;
    return;
  }

  list.innerHTML = visible.map(p => {
    const name = p.fullName || p.name || '—';
    const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const used = usedNames.has(name);
    const isSelected = _assignments[_activePos] === name;
    return `
      <div class="lpp-item ${used ? 'used' : ''}" data-name="${esc(name)}">
        <div class="lpp-avatar">${esc(initials)}</div>
        <div class="lpp-info">
          <div class="lpp-name">${esc(name)}</div>
          <div class="lpp-role">${esc(p.role || 'Jogador')}</div>
        </div>
        ${isSelected ? '<i class="fa-solid fa-check lpp-check"></i>' : ''}
      </div>`;
  }).join('');

  list.querySelectorAll('.lpp-item').forEach(item => {
    item.addEventListener('click', () => assignPlayer(item.dataset.name));
  });
}

function assignPlayer(name) {
  if (!_activePos) return;
  _assignments[_activePos] = name;
  closePicker();
  renderField();
  saveActive();
}

// ===== PUBLICAR ESCALAÇÃO (comissão técnica → Firestore + rascunho local) =====
async function saveLineup() {
  if (!_canEdit) return;

  const btn = document.getElementById('lineupSaveBtn');
  if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Publicando...'; btn.disabled = true; }

  try {
    // 1. Publica no Firestore (visível a todos)
    const published = await publishToFirestore();

    // 2. Salva no rascunho local (histórico do treinador)
    const matchInfo = document.getElementById('lineupMatchInfo')?.value.trim() || '';
    const label = matchInfo || `${_currentFormation} — ${new Date().toLocaleDateString('pt-BR')}`;
    const entry = {
      id: Date.now().toString(),
      label,
      formation: _currentFormation,
      players: { ..._assignments },
      matchInfo,
      savedAt: new Date().toISOString()
    };
    _savedLineups.unshift(entry);
    if (_savedLineups.length > 10) _savedLineups.length = 10;
    persistSaved();
    renderSavedLineups();

    // 3. Atualiza banner "Publicado por"
    showPublishedInfo(published);

    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Publicado!';
      setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-upload"></i> Publicar';
        btn.disabled = false;
      }, 2000);
    }
  } catch {
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Erro';
      setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-upload"></i> Publicar';
        btn.disabled = false;
      }, 2000);
    }
  }
}

// ===== RENDERIZAR ESCALAÇÕES SALVAS =====
function renderSavedLineups() {
  const section = document.getElementById('lineupSavedSection');
  if (!section) return;

  const label = section.querySelector('.lineup-saved-label');
  const existing = [...section.querySelectorAll('.lineup-saved-btn')];
  existing.forEach(b => b.remove());

  if (_savedLineups.length === 0) {
    section.style.display = 'none';
    return;
  }
  section.style.display = 'flex';

  _savedLineups.forEach(entry => {
    const btn = document.createElement('button');
    btn.className = 'lineup-saved-btn';
    btn.textContent = entry.label;
    btn.title = `${entry.formation} — ${new Date(entry.savedAt).toLocaleString('pt-BR')}`;
    btn.addEventListener('click', () => loadSavedLineup(entry));
    section.appendChild(btn);
  });
}

function loadSavedLineup(entry) {
  _currentFormation = entry.formation;
  _assignments = { ...entry.players };
  _customPositions = { ...(entry.customPositions || {}) };
  const matchInput = document.getElementById('lineupMatchInfo');
  if (matchInput) matchInput.value = entry.matchInfo || '';
  renderFormationChips();
  renderField();
  saveActive();
}

// ===== CARREGAR A ABA (chamado pelo switchTab) =====
export async function openLineup() {
  // Determina se o usuário pode editar
  _canEdit = isComissao();

  // Carrega escalação publicada do Firestore
  const published = await loadPublishedLineup();

  if (_canEdit) {
    loadFromStorage();
    // Se sem rascunho, usa a publicada como base
    if (!Object.keys(_assignments).length && published?.players) {
      _currentFormation = published.formation || '4-4-2';
      _assignments = { ...published.players };
      _customPositions = { ...(published.customPositions || {}) };
      const matchInput = document.getElementById('lineupMatchInfo');
      if (matchInput) matchInput.value = published.matchInfo || '';
    }
    _savedLineups = JSON.parse(localStorage.getItem(LS_KEY_SAVED) || '[]');
  } else {
    if (published) {
      _currentFormation = published.formation || '4-4-2';
      _assignments = { ...published.players };
      _customPositions = { ...(published.customPositions || {}) };
      const matchInput = document.getElementById('lineupMatchInfo');
      if (matchInput) matchInput.value = published.matchInfo || '';
    } else {
      _currentFormation = '4-4-2';
      _assignments = {};
    }
  }

  applyRoleUI();
  showPublishedInfo(published);
  renderFormationChips();
  renderField();
  if (_canEdit) renderSavedLineups();

  if (_canEdit) loadPlayers().then(() => renderPickerList(''));
}

// ===== INIT (chamado pelo bootstrap, uma única vez) =====
export function initLineup() {
  // Picker: fechar ao clicar fora
  document.getElementById('lineupPickerOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('lineupPickerOverlay')) closePicker();
  });
  document.getElementById('lineupPickerClose')?.addEventListener('click', closePicker);

  // Picker: busca
  document.getElementById('lineupPickerSearch')?.addEventListener('input', e => {
    renderPickerList(e.target.value);
  });

  // Picker: nome customizado
  document.getElementById('lineupCustomConfirm')?.addEventListener('click', () => {
    const val = document.getElementById('lineupCustomName')?.value.trim();
    if (val) assignPlayer(val);
  });
  document.getElementById('lineupCustomName')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (val) assignPlayer(val);
    }
  });

  // Publicar
  document.getElementById('lineupSaveBtn')?.addEventListener('click', saveLineup);

  // Match info: salva ao digitar
  document.getElementById('lineupMatchInfo')?.addEventListener('input', saveActive);
}

