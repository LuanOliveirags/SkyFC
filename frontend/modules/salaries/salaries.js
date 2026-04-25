// ============================================================
// SALARIES.JS — Receitas do time (Mensalidades + Patrocínios)
// ============================================================

import { state, getTeamId, isFinanceiro } from '../../app/state/store.js';
import { generateId, esc, formatCurrency, formatDate, showAlert, emptyState } from '../../shared/utils/helpers.js';
import { saveDataToStorage, saveToFirebase, deleteFromFirebase } from '../../app/providers/firebase-provider.js';
import { updateDashboard } from '../dashboard/dashboard.js';

// ===== TIPO DE RECEITA (Caixas do Clube) =====
const TYPE_CONFIG = {
  mensalidade:    { icon: '💳', label: 'Mensalidade',    css: 'cat-entrada'        },
  vale_churrasco: { icon: '🍖', label: 'Vale Churrasco', css: 'cat-vale-churrasco'  },
  festivais:      { icon: '🎉', label: 'Festivais',      css: 'cat-festivais'       },
  patrocinio:     { icon: '🏅', label: 'Patrocínio',     css: 'cat-patrocinio'      },
  // legado
  outro:          { icon: '💵', label: 'Outro',          css: 'cat-outro'           }
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
    createdBy: state.currentUser?.id || '',
    createdByName: state.currentUser?.fullName || '',
    additions: [],
    deductions: [],
    totalAdditions: 0,
    totalDeductions: 0,
    // Mensalidades precisam de aprovação do financeiro, exceto quando ele mesmo registra
    status: (type === 'mensalidade' && !isFinanceiro()) ? 'pending' : 'approved',
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
  const entry = state.salaries.find(s => s.id === id);
  if (!entry) return;

  const role = state.currentUser?.role;
  const uid  = state.currentUser?.id;
  const isAdmin = role === 'superadmin' || role === 'admin';
  const isOwner = entry.createdBy && entry.createdBy === uid;

  if (!isAdmin && !isOwner) {
    showAlert('Apenas o responsável ou um administrador pode excluir esta receita.', 'warning');
    return;
  }

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
    const labelMap = {
      patrocinio:     'Patrocinador',
      vale_churrasco: 'Organização / Origem',
      festivais:      'Festival / Evento',
      outro:          'Origem'
    };
    const placeholderMap = {
      patrocinio:     'Ex: Nike, Prefeitura...',
      vale_churrasco: 'Ex: Churrasco de Julho...',
      festivais:      'Ex: Festival de Verao...',
      outro:          'Ex: Rifa, Evento...'
    };
    if (label) label.textContent = labelMap[type] || 'Origem';
    if (sponsorInput) sponsorInput.placeholder = placeholderMap[type] || 'Ex: Rifa...';
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
  updateMensalidadeBadge();
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

  const mensalidades    = monthEntries.filter(s => s.salaryType === 'mensalidade' && (s.status === 'approved' || !s.status));
  const valeChurrasco   = monthEntries.filter(s => s.salaryType === 'vale_churrasco');
  const festivais       = monthEntries.filter(s => s.salaryType === 'festivais');
  const patrocinios     = monthEntries.filter(s => s.salaryType === 'patrocinio');
  const totalMens       = mensalidades.reduce((s, e)  => s + (e.amount || 0), 0);
  const totalVale       = valeChurrasco.reduce((s, e) => s + (e.amount || 0), 0);
  const totalFest       = festivais.reduce((s, e)     => s + (e.amount || 0), 0);
  const totalPat        = patrocinios.reduce((s, e)   => s + (e.amount || 0), 0);
  const total           = totalMens + totalVale + totalFest + totalPat;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('sumMensalidades',       formatCurrency(totalMens));
  set('sumMensalidadesCount',  `${mensalidades.length} recebida${mensalidades.length !== 1 ? 's' : ''}`);
  set('sumValeChurrasco',      formatCurrency(totalVale));
  set('sumValeChurrascoCount', `${valeChurrasco.length} entrada${valeChurrasco.length !== 1 ? 's' : ''}`);
  set('sumFestivais',          formatCurrency(totalFest));
  set('sumFestivaisCount',     `${festivais.length} entrada${festivais.length !== 1 ? 's' : ''}`);
  set('sumPatrocinios',        formatCurrency(totalPat));
  set('sumPatrociniosCount',   `${patrocinios.length} entrada${patrocinios.length !== 1 ? 's' : ''}`);
  set('sumTotal',              formatCurrency(total));
  set('sumOtherCount', '');
}

// ===== HISTÓRICO =====
export function updateSalaryHistory() {
  const container = document.getElementById('salaryHistoryList');
  if (!container) return;
  const filterVal = document.getElementById('salaryMonthFilter')?.value;
  let filtered = state.salaries;
  if (filterVal) filtered = filtered.filter(s => s.date?.startsWith(filterVal));
  if (!filtered.length) { container.innerHTML = emptyState('Nenhuma receita neste mês'); return; }

  const currentRole = state.currentUser?.role;
  const currentUid  = state.currentUser?.id;
  const canDelete = (entry) => {
    if (currentRole === 'superadmin' || currentRole === 'admin') return true;
    return entry.createdBy && entry.createdBy === currentUid;
  };
  const canApproveReject = isFinanceiro();

  const sorted = filtered.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  container.innerHTML = sorted.map(s => {
    const cfg = TYPE_CONFIG[s.salaryType] || TYPE_CONFIG.outro;
    const isPending = s.salaryType === 'mensalidade' && s.status === 'pending';
    const defaultDesc = s.salaryType === 'mensalidade'
      ? `Mensalidade — ${esc(s.person)}`
      : s.salaryType === 'patrocinio'
        ? `Patrocínio — ${esc(s.person)}`
        : esc(s.person) || 'Receita';
    const deleteBtn = canDelete(s)
      ? `<button onclick="deleteSalary('${s.id}')" class="btn-delete" title="Excluir"><i class="fa-solid fa-trash"></i></button>`
      : '';
    const approvalBtns = isPending && canApproveReject
      ? `<button onclick="approveSalary('${s.id}')" class="btn-approve-salary" title="Aprovar pagamento"><i class="fa-solid fa-check"></i></button>` +
        `<button onclick="rejectSalary('${s.id}')" class="btn-reject-salary" title="Rejeitar pagamento"><i class="fa-solid fa-xmark"></i></button>`
      : '';
    const pendingBadge = isPending
      ? `<span class="sal-pending-badge"><i class="fa-solid fa-clock"></i> Aguardando</span>`
      : '';
    return `
    <div class="transaction-item${isPending ? ' sal-item-pending' : ''}">
      <div class="trans-icon-wrap ${cfg.css}">${cfg.icon}</div>
      <div class="trans-info">
        <div class="trans-name">${esc(s.description) || defaultDesc}</div>
        <div class="trans-meta">
          <span>${formatDate(s.date)}</span><span>·</span>
          <span class="sal-type-badge sal-type-${s.salaryType}">${cfg.label}</span>
          ${s.person ? `<span>·</span><span>${esc(s.person)}</span>` : ''}
          ${pendingBadge}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="trans-amount ${isPending ? 'sal-amount-pending' : 'entrada'}">+${formatCurrency(s.amount)}</div>
        ${approvalBtns}
        ${deleteBtn}
      </div>
    </div>`;
  }).join('');
}

// ===== ALIAS / COMPAT =====
export function updateSalaryHistory_alias() { updateSalaryHistory(); }

// ===== APROVAÇÃO DE MENSALIDADES (apenas financeiro e superadmin) =====
export function getPendingMensalidadesCount() {
  return state.salaries.filter(s => s.salaryType === 'mensalidade' && s.status === 'pending').length;
}

export function updateMensalidadeBadge() {
  const badge = document.getElementById('mensalidadePendingBadge');
  if (!badge) return;
  if (!isFinanceiro()) { badge.style.display = 'none'; return; }
  const count = getPendingMensalidadesCount();
  badge.textContent = count > 9 ? '9+' : String(count);
  badge.style.display = count > 0 ? 'flex' : 'none';
}

export function approveSalary(id) {
  if (!isFinanceiro()) { showAlert('Sem permissão para aprovar mensalidades.', 'warning'); return; }
  const entry = state.salaries.find(s => s.id === id);
  if (!entry) return;
  entry.status = 'approved';
  entry.approvedBy = state.currentUser?.id || '';
  entry.approvedByName = state.currentUser?.fullName || '';
  entry.approvedAt = new Date().toISOString();
  saveDataToStorage();
  saveToFirebase('salaries', entry);
  showAlert('Mensalidade aprovada!', 'success');
  updateSalaryDisplay();
  updateDashboard();
}

export function rejectSalary(id) {
  if (!isFinanceiro()) { showAlert('Sem permissão para rejeitar mensalidades.', 'warning'); return; }
  if (!confirm('Rejeitar este pagamento? O registro será removido.')) return;
  state.salaries = state.salaries.filter(s => s.id !== id);
  saveDataToStorage();
  deleteFromFirebase('salaries', id);
  showAlert('Pagamento rejeitado e removido.', 'warning');
  updateSalaryDisplay();
  updateDashboard();
}

// ===== GLOBALS =====
window.deleteSalary = deleteSalary;
window.approveSalary = approveSalary;
window.rejectSalary  = rejectSalary;
