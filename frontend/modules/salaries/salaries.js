// ============================================================
// SALARIES.JS — Receitas do time (Mensalidades + Patrocínios)
// ============================================================

import { state, getTeamId } from '../../app/state/store.js';
import { generateId, esc, formatCurrency, formatDate, showAlert, emptyState } from '../../shared/utils/helpers.js';
import { saveDataToStorage, saveToFirebase, deleteFromFirebase } from '../../app/providers/firebase-provider.js';
import { updateDashboard } from '../dashboard/dashboard.js';

// ===== TIPO DE RECEITA =====
const TYPE_CONFIG = {
  mensalidade: { icon: '💳', label: 'Mensalidade',  css: 'cat-entrada'   },
  patrocinio:  { icon: '🏅', label: 'Patrocínio',   css: 'cat-patrocinio' },
  outro:       { icon: '💵', label: 'Outro',         css: 'cat-outro'     }
};

// ===== ADICIONAR RECEITA =====
export function addSalary(e) {
  e.preventDefault();

  const type   = document.getElementById('salaryType')?.value || 'mensalidade';
  const amount = type === 'mensalidade' ? 25 : parseFloat(document.getElementById('salaryAmount').value);
  const date   = document.getElementById('salaryDate').value;

  // Origem da receita
  let person;
  if (type === 'mensalidade') {
    person = document.getElementById('salaryPerson').value;
    if (!person) { showAlert('Selecione o jogador.', 'warning'); return; }
  } else {
    person = document.getElementById('sponsorName').value.trim();
    if (!person) { showAlert('Informe o patrocinador/origem.', 'warning'); return; }
  }

  if (!amount || amount <= 0 || !date) { showAlert('Preencha valor e data.', 'warning'); return; }

  const teamId = getTeamId();
  if (!teamId) { showAlert('Erro: time não identificado.', 'danger'); return; }

  const entry = {
    id: generateId(),
    person,
    salaryType: type,
    amount,
    grossAmount: amount,
    date,
    description: '',
    teamId,
    familyId: teamId,
    createdAt: new Date().toISOString(),
    additions: [],
    deductions: [],
    totalAdditions: 0,
    totalDeductions: 0
  };

  state.salaries.push(entry);
  saveDataToStorage();
  saveToFirebase('salaries', entry);
  showAlert('Receita registrada!', 'success');

  e.target.reset();
  // Reset tipo para mensalidade
  _setType('mensalidade');
  document.getElementById('salaryModal').classList.remove('active');
  updateSalaryDisplay();
  updateDashboard();
}

// ===== DELETAR =====
export function deleteSalary(id) {
  if (confirm('Deseja excluir esta receita?')) {
    state.salaries = state.salaries.filter(s => s.id !== id);
    saveDataToStorage();
    deleteFromFirebase('salaries', id);
    updateSalaryDisplay();
    updateDashboard();
    showAlert('Receita excluída.', 'success');
  }
}

// ===== TIPO TOGGLE =====
function _setType(type) {
  document.querySelectorAll('.salary-type-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.salary-type-btn[data-type="${type}"]`);
  if (btn) btn.classList.add('active');
  const hiddenInput = document.getElementById('salaryType');
  if (hiddenInput) hiddenInput.value = type;

  const playerGroup  = document.getElementById('playerGroup');
  const sponsorGroup = document.getElementById('sponsorGroup');
  const personHidden  = document.getElementById('salaryPerson');
  const personDisplay = document.getElementById('salaryPersonDisplay');
  const sponsorInput = document.getElementById('sponsorName');

  const amountInput = document.getElementById('salaryAmount');

  if (type === 'mensalidade') {
    if (playerGroup)  playerGroup.style.display  = '';
    if (sponsorGroup) sponsorGroup.style.display = 'none';
    if (sponsorInput) sponsorInput.required = false;
    // Preenche com o nome do usuário logado
    const name = state.currentUser?.fullName || '';
    if (personHidden)  personHidden.value  = name;
    if (personDisplay) personDisplay.value = name;
    if (amountInput) {
      amountInput.value    = '25';
      amountInput.readOnly = true;
      amountInput.style.opacity = '0.7';
      amountInput.style.cursor  = 'not-allowed';
    }
  } else {
    if (playerGroup)  playerGroup.style.display  = 'none';
    if (sponsorGroup) sponsorGroup.style.display = '';
    if (sponsorInput) sponsorInput.required = false;
    const label = document.querySelector('label[for="sponsorName"]');
    if (label) label.textContent = type === 'patrocinio' ? 'Patrocinador' : 'Origem';
    const placeholder = type === 'patrocinio' ? 'Ex: Nike, Prefeitura...' : 'Ex: Rifa, Evento...';
    if (sponsorInput) sponsorInput.placeholder = placeholder;
    if (amountInput) {
      if (amountInput.value === '25') amountInput.value = '';
      amountInput.readOnly = false;
      amountInput.style.opacity = '';
      amountInput.style.cursor  = '';
    }
  }
}

// ===== POPULAR CAMPO DE JOGADOR =====
function _populatePlayerSelect() {
  const name = state.currentUser?.fullName || '';
  const hidden  = document.getElementById('salaryPerson');
  const display = document.getElementById('salaryPersonDisplay');
  if (hidden)  hidden.value  = name;
  if (display) display.value = name;
}

// ===== SETUP LISTENERS =====
export function setupDeductionListeners() {
  document.querySelectorAll('.salary-type-btn').forEach(btn => {
    btn.addEventListener('click', () => _setType(btn.dataset.type));
  });
}

// ===== FILTRO MÊS =====
export function populateSalaryMonthFilter() {
  const select = document.getElementById('salaryMonthFilter');
  if (!select) return;
  const months = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  const monthsSet = new Set();
  state.salaries.forEach(s => {
    if (!s.date) return;
    const d = new Date(s.date + 'T12:00:00');
    monthsSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  });
  const now = new Date();
  const curKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  monthsSet.add(curKey);
  const sorted = Array.from(monthsSet).sort().reverse();
  const prev = select.value;
  select.innerHTML = sorted.map(key => {
    const [y, m] = key.split('-');
    return `<option value="${key}">${months[parseInt(m)-1]} ${y}</option>`;
  }).join('');
  select.value = (prev && sorted.includes(prev)) ? prev : curKey;
}

// ===== ATUALIZAR DISPLAY =====
export function updateSalaryDisplay() {
  _populatePlayerSelect();
  populateSalaryMonthFilter();
  _updateSummaryCards();
  updateSalaryHistory();
}

function _getFilteredMonthYear() {
  const val = document.getElementById('salaryMonthFilter')?.value;
  if (val) {
    const [y, m] = val.split('-');
    return { year: parseInt(y), month: parseInt(m) - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function _updateSummaryCards() {
  const { year, month } = _getFilteredMonthYear();
  const monthEntries = state.salaries.filter(s => {
    if (!s.date) return false;
    const d = new Date(s.date + 'T12:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  const mensalidades = monthEntries.filter(s => s.salaryType === 'mensalidade');
  const patrocinios  = monthEntries.filter(s => s.salaryType === 'patrocinio');
  const outros       = monthEntries.filter(s => s.salaryType === 'outro');
  const totalMens    = mensalidades.reduce((s, e) => s + (e.amount || 0), 0);
  const totalPat     = patrocinios.reduce((s, e)  => s + (e.amount || 0), 0);
  const totalOutros  = outros.reduce((s, e)       => s + (e.amount || 0), 0);
  const total        = totalMens + totalPat + totalOutros;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sumMensalidades',      formatCurrency(totalMens));
  set('sumMensalidadesCount', `${mensalidades.length} recebida${mensalidades.length !== 1 ? 's' : ''}`);
  set('sumPatrocinios',      formatCurrency(totalPat));
  set('sumPatrociniosCount', `${patrocinios.length} entrada${patrocinios.length !== 1 ? 's' : ''}`);
  set('sumTotal',            formatCurrency(total));
  set('sumOtherCount', outros.length ? `+ ${outros.length} outro${outros.length !== 1 ? 's' : ''}` : '');
}

// ===== HISTÓRICO =====
export function updateSalaryHistory() {
  const container = document.getElementById('salaryHistoryList');
  if (!container) return;
  const filterVal = document.getElementById('salaryMonthFilter')?.value;
  let filtered = state.salaries;
  if (filterVal) filtered = filtered.filter(s => s.date?.startsWith(filterVal));
  if (!filtered.length) { container.innerHTML = emptyState('Nenhuma receita neste mês'); return; }

  const sorted = filtered.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  container.innerHTML = sorted.map(s => {
    const cfg = TYPE_CONFIG[s.salaryType] || TYPE_CONFIG.outro;
    const defaultDesc = s.salaryType === 'mensalidade'
      ? `Mensalidade — ${esc(s.person)}`
      : s.salaryType === 'patrocinio'
        ? `Patrocínio — ${esc(s.person)}`
        : esc(s.person) || 'Receita';
    return `
    <div class="transaction-item">
      <div class="trans-icon-wrap ${cfg.css}">${cfg.icon}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(s.description) || defaultDesc}</div>
        <div class="trans-meta">
          <span>${formatDate(s.date)}</span><span>·</span>
          <span class="sal-type-badge sal-type-${s.salaryType}">${cfg.label}</span>
          ${s.person ? `<span>·</span><span>${esc(s.person)}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="trans-amount entrada">+${formatCurrency(s.amount)}</div>
        <button onclick="deleteSalary('${s.id}')" class="btn-delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

// ===== ALIAS / COMPAT =====
export function updateSalaryHistory_alias() { updateSalaryHistory(); }

// ===== GLOBALS =====
window.deleteSalary = deleteSalary;
