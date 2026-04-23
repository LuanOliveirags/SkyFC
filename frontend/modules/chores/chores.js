// ============================================================
// CHORES.JS — Tarefas do time Sky FC
// ============================================================

import { esc } from '../../shared/utils/helpers.js';
import { state, isAdmin, isComissao, getTeamId } from '../../app/state/store.js';
import { db } from '../../app/providers/firebase-provider.js';

// ===== PRÉ-JOGO: tarefas padrão por dia da semana =====
const PRE_GAME_DEFAULT = {
  0: ['Inflar as bolas', 'Separar os coletes', 'Montar os cones', 'Preparar as garrafas de água'],
  1: ['Verificar estado dos equipamentos', 'Planejar o próximo treino'],
  2: ['Inflar as bolas', 'Montar os cones', 'Separar os coletes', 'Preparar a água'],
  3: ['Preparar o campo', 'Separar os coletes', 'Inflar as bolas'],
  4: ['Inflar as bolas', 'Montar os cones', 'Separar os coletes', 'Preparar a água'],
  5: ['Preparar uniformes', 'Verificar as bolas', 'Confirmar presença dos jogadores'],
  6: ['Inflar as bolas', 'Separar os coletes', 'Montar os cones', 'Preparar as garrafas de água'],
};

// ===== PÓS-JOGO: tarefas fixas — responsável muda no rodízio =====
const POST_GAME_DEFAULT = [
  'Lavar os coletes',
  'Guardar as bolas',
  'Recolher e guardar os cones',
  'Limpar os equipamentos',
  'Organizar o almoxarifado',
];

let choresEditMode = false;
let choresCurrentDay = new Date().getDay();
let _players = [];

// ===== STORAGE — PRÉ-JOGO =====
function getPreGameData() {
  const c = localStorage.getItem('skyfc_prejogo_custom');
  if (c) try { return JSON.parse(c); } catch(e) {}
  return JSON.parse(JSON.stringify(PRE_GAME_DEFAULT));
}
function savePreGameData(d) { localStorage.setItem('skyfc_prejogo_custom', JSON.stringify(d)); }

function getPreDoneKey(day) {
  return `skyfc_prejogo_done_${day}_${new Date().toISOString().slice(0, 10)}`;
}
function getPreDone(day) {
  return JSON.parse(localStorage.getItem(getPreDoneKey(day)) || '{}');
}
function savePreDone(day, data) {
  localStorage.setItem(getPreDoneKey(day), JSON.stringify(data));
}

// ===== STORAGE — PÓS-JOGO TAREFAS =====
function getPostGameTasks() {
  const c = localStorage.getItem('skyfc_posjogo_tasks');
  if (c) try { return JSON.parse(c); } catch(e) {}
  return [...POST_GAME_DEFAULT];
}

// ===== STORAGE — RODÍZIO =====
function getRotation() {
  const r = localStorage.getItem('skyfc_rotation');
  if (r) try { return JSON.parse(r); } catch(e) {}
  return { order: [], doneThisCycle: [], postDone: {} };
}
function saveRotation(r) { localStorage.setItem('skyfc_rotation', JSON.stringify(r)); }

function syncRotationWithPlayers(players) {
  const rot = getRotation();
  if (!rot.doneThisCycle) rot.doneThisCycle = [];
  if (!rot.postDone) rot.postDone = {};
  players.forEach(p => { if (!rot.order.includes(p.uid)) rot.order.push(p.uid); });
  rot.order = rot.order.filter(uid => players.some(p => p.uid === uid));
  rot.doneThisCycle = rot.doneThisCycle.filter(d => rot.order.includes(d.uid));
  saveRotation(rot);
  return rot;
}

function getCurrentResponsibleUid(rot) {
  if (!rot.order.length) return null;
  const doneSoFar = new Set((rot.doneThisCycle || []).map(d => d.uid));
  return rot.order.find(uid => !doneSoFar.has(uid)) || null;
}

function getPlayerName(uid) {
  const p = _players.find(x => x.uid === uid);
  return p?.displayName || p?.fullName || p?.email?.split('@')[0] || uid;
}

function confirmPostGame() {
  const rot = syncRotationWithPlayers(_players);
  if (!rot.order.length) return;
  const currentUid = getCurrentResponsibleUid(rot);
  if (!currentUid) return;
  const name = getPlayerName(currentUid);
  rot.doneThisCycle.push({ uid: currentUid, name, date: new Date().toISOString().slice(0, 10) });
  rot.postDone = {};
  if (rot.doneThisCycle.length >= rot.order.length) {
    rot.doneThisCycle = []; // ciclo completo — reinicia
  }
  saveRotation(rot);
  renderChoresTab(choresCurrentDay);
}

async function loadPlayers() {
  if (state.players && state.players.length) { _players = state.players; return; }
  try {
    const teamId = getTeamId();
    if (!db || !teamId) return;
    const snap = await db.collection('users').where('teamId', '==', teamId).get();
    _players = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    state.players = _players;
  } catch(e) {
    console.warn('Erro ao carregar jogadores:', e);
  }
}

export function openChoresTab() {
  choresCurrentDay = new Date().getDay();
  initChoresDayScroller();
  renderChoresTab(choresCurrentDay);
  loadPlayers().then(() => renderChoresTab(choresCurrentDay));
}

function initChoresDayScroller() {
  const scroller = document.getElementById('choresDayScroller');
  if (!scroller) return;
  const days = ['DOM','SEG','TER','QUA','QUI','SEX','SÁB'];
  const today = new Date();
  const currentDow = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDow);

  scroller.innerHTML = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dayNum = d.getDate();
    const dow = d.getDay();
    const isToday = dow === currentDow && d.toDateString() === today.toDateString();
    const isSelected = dow === choresCurrentDay;

    const btn = document.createElement('button');
    btn.className = 'cds-day' + (isToday ? ' today' : '') + (isSelected ? ' active' : '');
    btn.dataset.day = dow;
    btn.innerHTML = `<span class="cds-label">${days[dow]}</span><span class="cds-num">${dayNum}</span>`;
    btn.addEventListener('click', () => {
      choresCurrentDay = dow;
      document.querySelectorAll('.cds-day').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderChoresTab(dow);
    });
    scroller.appendChild(btn);
  }
}

function renderChoresTab(dayIndex) {
  // Pré-Jogo
  const preData = getPreGameData();
  const preTasks = preData[dayIndex] || [];
  const preDone = getPreDone(dayIndex);
  const preList = document.getElementById('choresLuanList');
  if (preList) preList.innerHTML = preTasks.map((t, i) =>
    buildTaskItem(t, i, 'pre', dayIndex, preDone)
  ).join('');

  // Pós-Jogo
  const rot = syncRotationWithPlayers(_players);
  const postDone = rot.postDone || {};
  const postTasks = getPostGameTasks();
  const postList = document.getElementById('choresBiancaList');
  if (postList) postList.innerHTML = postTasks.map((t, i) =>
    buildTaskItem(t, i, 'post', dayIndex, postDone)
  ).join('');

  renderResponsibleSection(rot);
  updateChoresDashboard(preTasks, preDone, postTasks, postDone);
  updateEditMode();
}

function buildTaskItem(task, index, type, dayIndex, done) {
  const isDone = done[index] || false;
  const editBtns = choresEditMode && type === 'pre' ? `
    <div class="chore-edit-actions">
      <button class="chore-edit-btn" data-action="edit" data-person="${type}" data-index="${index}" data-day="${dayIndex}"><i class="fa-solid fa-pen"></i></button>
      <button class="chore-edit-btn danger" data-action="delete" data-person="${type}" data-index="${index}" data-day="${dayIndex}"><i class="fa-solid fa-trash"></i></button>
    </div>` : '';
  return `<li class="chore-task-item ${isDone ? 'done' : ''}" data-key="${type}_${index}" data-day="${dayIndex}" data-type="${type}">
    <div class="cti-left">
      <span class="cti-check"><i class="fa-solid ${isDone ? 'fa-circle-check' : 'fa-circle'}"></i></span>
      <span class="cti-text">${esc(task)}</span>
    </div>
    ${editBtns}
  </li>`;
}

function renderResponsibleSection(rot) {
  const card = document.getElementById('choresResponsibleCard');
  if (!card) return;

  if (!rot.order.length) {
    card.innerHTML = `<p class="rotation-empty">Nenhum jogador cadastrado ainda.<br><small>Os jogadores aparecem aqui após o primeiro login.</small></p>`;
    return;
  }

  const doneSoFar = new Set((rot.doneThisCycle || []).map(d => d.uid));
  const currentUid = getCurrentResponsibleUid(rot);
  const currentName = currentUid ? getPlayerName(currentUid) : '—';
  const canAdvance = isAdmin() || isComissao();

  const rotListHTML = rot.order.map(uid => {
    const isDone = doneSoFar.has(uid);
    const isCurrent = uid === currentUid;
    const doneEntry = (rot.doneThisCycle || []).find(d => d.uid === uid);
    const name = getPlayerName(uid);
    let cls, icon, extra = '';
    if (isDone) {
      cls = 'rl-done'; icon = 'fa-circle-check';
      if (doneEntry?.date) extra = `<span class="rl-date">${doneEntry.date}</span>`;
    } else if (isCurrent) {
      cls = 'rl-current'; icon = 'fa-circle-arrow-right';
      extra = '<span class="rl-badge">Vez dele</span>';
    } else {
      cls = 'rl-pending'; icon = 'fa-clock';
    }
    return `<li class="rotation-item ${cls}">
      <i class="fa-solid ${icon} ri-icon"></i>
      <span class="ri-name">${esc(name)}</span>
      ${extra}
    </li>`;
  }).join('');

  card.innerHTML = `
    <div class="responsible-card">
      <div class="rc-avatar"><i class="fa-solid fa-shirt"></i></div>
      <div class="rc-info">
        <span class="rc-label">Responsável pelo Pós-Jogo</span>
        <span class="rc-name">${esc(currentName)}</span>
      </div>
      ${canAdvance && currentUid ? `<button class="rc-confirm-btn" id="choresConfirmBtn">
        <i class="fa-solid fa-circle-check"></i><span>Confirmar</span>
      </button>` : ''}
    </div>
    <div class="rotation-section">
      <p class="rotation-section-title"><i class="fa-solid fa-rotate"></i> Rodízio</p>
      <ul class="rotation-list">${rotListHTML}</ul>
    </div>
  `;

  document.getElementById('choresConfirmBtn')?.addEventListener('click', () => {
    if (confirm(`Confirmar que ${currentName} concluiu o pós-jogo?`)) confirmPostGame();
  });
}

function updateChoresDashboard(preTasks, preDone, postTasks, postDone) {
  const preDoneCount = preTasks.filter((_, i) => preDone[i]).length;
  const postDoneCount = postTasks.filter((_, i) => postDone[i]).length;
  const total = preTasks.length + postTasks.length;
  const done = preDoneCount + postDoneCount;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const ring = document.getElementById('choresRingFill');
  if (ring) {
    const c = 2 * Math.PI * 52;
    ring.style.strokeDasharray = c;
    ring.style.strokeDashoffset = c - (pct / 100) * c;
  }
  const el = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  el('choresRingPct', pct + '%');
  el('choresLuanCount', `${preDoneCount}/${preTasks.length}`);
  el('choresBiancaCount', `${postDoneCount}/${postTasks.length}`);
  el('choresTotalDone', done);
  el('choresTotalPending', total - done);
  el('choresLuanBadge', `${preDoneCount}/${preTasks.length}`);
  el('choresBiancaBadge', `${postDoneCount}/${postTasks.length}`);
}

function updateEditMode() {
  const addPre = document.getElementById('choresAddLuan');
  const addPost = document.getElementById('choresAddBianca');
  const toggleBtn = document.getElementById('editChoresToggle');
  if (addPre) addPre.style.display = choresEditMode ? 'flex' : 'none';
  if (addPost) addPost.style.display = 'none'; // pós-jogo é fixo
  if (toggleBtn) {
    toggleBtn.classList.toggle('active-edit', choresEditMode);
    toggleBtn.title = choresEditMode ? 'Sair da edição' : 'Editar tarefas';
  }
}

function addNewChore() {
  const input = document.getElementById('choresNewLuan');
  const text = input?.value.trim();
  if (!text) return;
  const allData = getPreGameData();
  if (!allData[choresCurrentDay]) allData[choresCurrentDay] = [];
  allData[choresCurrentDay].push(text);
  savePreGameData(allData);
  input.value = '';
  renderChoresTab(choresCurrentDay);
}

// ===== SETUP DE EVENTOS DO CHORES =====
export function setupChoresListeners() {
  document.getElementById('editChoresToggle')?.addEventListener('click', () => {
    choresEditMode = !choresEditMode;
    renderChoresTab(choresCurrentDay);
  });

  document.getElementById('chores')?.addEventListener('click', function(e) {
    const editBtn = e.target.closest('.chore-edit-btn');
    if (editBtn) {
      const action = editBtn.dataset.action;
      const person = editBtn.dataset.person;
      const index = parseInt(editBtn.dataset.index);
      const day = parseInt(editBtn.dataset.day);
      if (person !== 'pre') return;
      if (action === 'delete') {
        const allData = getPreGameData();
        if (allData[day]) allData[day].splice(index, 1);
        savePreGameData(allData);
        renderChoresTab(day);
        return;
      }
      if (action === 'edit') {
        const allData = getPreGameData();
        document.getElementById('editChoreText').value = (allData[day] || [])[index] || '';
        document.getElementById('editChorePerson').value = person;
        document.getElementById('editChoreIndex').value = index;
        document.getElementById('editChoreDay').value = day;
        document.getElementById('editChoreModal').classList.add('active');
        return;
      }
      return;
    }
    const item = e.target.closest('.chore-task-item');
    if (!item || choresEditMode) return;
    const type = item.dataset.type;
    const dayIndex = parseInt(item.dataset.day);
    const taskIndex = parseInt(item.dataset.key.split('_')[1]);
    if (type === 'pre') {
      const saved = getPreDone(dayIndex);
      saved[taskIndex] = !saved[taskIndex];
      savePreDone(dayIndex, saved);
    } else if (type === 'post') {
      const rot = getRotation();
      if (!rot.postDone) rot.postDone = {};
      rot.postDone[taskIndex] = !rot.postDone[taskIndex];
      saveRotation(rot);
    }
    renderChoresTab(dayIndex);
  });

  document.getElementById('editChoreForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const text = document.getElementById('editChoreText').value.trim();
    const person = document.getElementById('editChorePerson').value;
    const index = parseInt(document.getElementById('editChoreIndex').value);
    const day = parseInt(document.getElementById('editChoreDay').value);
    if (!text || person !== 'pre') return;
    const allData = getPreGameData();
    if (!allData[day]) allData[day] = [];
    allData[day][index] = text;
    savePreGameData(allData);
    document.getElementById('editChoreModal').classList.remove('active');
    renderChoresTab(day);
  });

  document.getElementById('choresAddLuanBtn')?.addEventListener('click', addNewChore);
  document.getElementById('choresNewLuan')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); addNewChore(); }
  });
}
