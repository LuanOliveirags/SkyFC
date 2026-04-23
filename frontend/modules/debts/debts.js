// ============================================================
// DEBTS.JS — CRUD, UI, filtros e alertas de dívidas
// ============================================================

import { CATEGORY_MAP, BANK_IMG, CREDITOR_IMG } from '../../app/providers/firebase-config.js';
import { state, getFamilyId } from '../../app/state/store.js';
import { generateId, esc, formatCurrency, formatDate, toDateStr, showAlert, emptyState } from '../../shared/utils/helpers.js';
import { saveDataToStorage, saveToFirebase, deleteFromFirebase, updateInFirebase } from '../../app/providers/firebase-provider.js';
import { updateDashboard } from '../dashboard/dashboard.js';
import { updateTransactionHistory } from '../transactions/transactions.service.js';

// ===== ESTADO DO FILTRO =====
let currentDebtFilter = null;
let _debtFilterDelegated = false;

// ===== ADICIONAR DÍVIDA =====
export function addDebt(e) {
  e.preventDefault();

  const familyId = getFamilyId();
  if (!familyId) { showAlert('Erro: time não identificado. Faça login novamente.', 'danger'); return; }

  const editId = document.getElementById('editDebtId').value;
  const debtType = document.getElementById('debtType').value;
  const totalAmount = parseFloat(document.getElementById('debtAmount').value);
  const installments = parseInt(document.getElementById('debtInstallments').value) || 1;
  const paidInstallments = parseInt(document.getElementById('debtPaidInstallments').value) || 0;
  const manualInstValue = parseFloat(document.getElementById('debtInstallmentValue').value) || (totalAmount / installments);

  // Simplificado: apenas parcelada usa installments
  const usesInstallments = debtType === 'parcelada';

  const creditor = document.getElementById('debtCreditor').value;
  const dueDate = document.getElementById('debtDueDate').value;
  const responsible = document.getElementById('debtResponsible').value;
  const category = document.getElementById('debtCategory').value || '';
  const description = document.getElementById('debtDescription').value;

  if (!creditor || !totalAmount || !dueDate || !category) {
    alert('Por favor, preencha todos os campos obrigatórios!');
    return;
  }

  if (editId) {
    const debt = state.debts.find(d => d.id === editId);
    if (!debt) return;

    debt.creditor = creditor;
    debt.amount = totalAmount;
    debt.dueDate = dueDate;
    debt.responsible = responsible;
    debt.category = category;
    debt.description = description;
    debt.debtType = debtType;
    debt.installments = usesInstallments ? installments : 1;
    debt.paidInstallments = usesInstallments ? paidInstallments : 0;
    debt.installmentValue = usesInstallments ? manualInstValue : totalAmount;

    saveDataToStorage();
    updateInFirebase('debts', editId, {
      creditor: debt.creditor, amount: debt.amount, dueDate: debt.dueDate,
      responsible: debt.responsible, category: debt.category, description: debt.description,
      debtType: debt.debtType, installments: debt.installments,
      paidInstallments: debt.paidInstallments, installmentValue: debt.installmentValue
    });
    showAlert('Despesa atualizada com sucesso!', 'success');
  } else {
    const debt = {
      id: generateId(), creditor, amount: totalAmount, dueDate, responsible, category, description,
      debtType,
      installments: usesInstallments ? installments : 1,
      paidInstallments: usesInstallments ? paidInstallments : 0,
      installmentValue: usesInstallments ? manualInstValue : totalAmount,
      status: 'active', paidAt: null, familyId, createdAt: new Date().toISOString()
    };
    state.debts.push(debt);
    saveDataToStorage();
    saveToFirebase('debts', debt);
    showAlert('Despesa registrada com sucesso!', 'success');
  }

  resetDebtModal();
  document.getElementById('debtModal').classList.remove('active');
  updateDebtsList();
  updateDashboard();
}

// ===== RESETAR MODAL =====
export function resetDebtModal() {
  document.getElementById('debtForm').reset();
  document.getElementById('editDebtId').value = '';
  document.getElementById('debtType').value = 'unica';
  document.getElementById('installmentFields').style.display = 'none';
  document.getElementById('creditorTextGroup').style.display = 'block';
  document.getElementById('debtCreditor').setAttribute('required', '');
  document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
  document.querySelector('.debt-type-toggle[data-value="unica"]')?.classList.add('active');
  document.getElementById('debtAmountLabel').textContent = 'Valor (R$)';
  document.getElementById('debtModalTitle').innerHTML = '<i class="fa-solid fa-money-bill-wave"></i> Nova Despesa';
  document.getElementById('debtSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Registrar';
}

// ===== EDITAR DÍVIDA =====
export function editDebt(id) {
  const debt = state.debts.find(d => d.id === id);
  if (!debt) return;

  document.getElementById('editDebtId').value = debt.id;
  document.getElementById('debtAmount').value = debt.amount;
  document.getElementById('debtDueDate').value = debt.dueDate;
  document.getElementById('debtResponsible').value = debt.responsible;
  document.getElementById('debtCategory').value = debt.category || '';
  document.getElementById('debtDescription').value = debt.description || '';
  document.getElementById('debtCreditor').value = debt.creditor;

  const debtType = debt.debtType || 'unica';
  document.getElementById('debtType').value = debtType;
  document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
  const activeBtn = document.querySelector(`.debt-type-toggle[data-value="${debtType}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  const usesInstallments = debtType === 'parcelada';
  document.getElementById('installmentFields').style.display = usesInstallments ? 'block' : 'none';
  
  if (usesInstallments) {
    document.getElementById('debtInstallments').value = debt.installments || '';
    document.getElementById('debtInstallmentValue').value = debt.installmentValue || '';
    document.getElementById('debtPaidInstallments').value = debt.paidInstallments || 0;
    const remaining = debt.amount - ((debt.installmentValue || 0) * (debt.paidInstallments || 0));
    document.getElementById('debtRemainingValue').value = remaining.toFixed(2);
    document.getElementById('debtAmountLabel').textContent = 'Valor Total (R$)';
  } else if (debtType === 'recorrente') {
    document.getElementById('debtAmountLabel').textContent = 'Valor Mensal (R$)';
  } else {
    document.getElementById('debtAmountLabel').textContent = 'Valor (R$)';
  }

  document.getElementById('debtModalTitle').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Despesa';
  document.getElementById('debtSubmitBtn').innerHTML = '<i class="fa-solid fa-check"></i> Salvar';
  document.getElementById('debtModal').classList.add('active');
}

// ===== SETUP TOGGLES DE TIPO =====
export function setupDebtTypeListeners() {
  document.querySelectorAll('.debt-type-toggle').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.debt-type-toggle').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const val = this.dataset.value;
      document.getElementById('debtType').value = val;
      const installFields = document.getElementById('installmentFields');
      
      // Mostrar campos de parcelamento apenas para tipo "parcelada"
      installFields.style.display = val === 'parcelada' ? 'block' : 'none';
      
      const amountLabel = document.getElementById('debtAmountLabel');
      if (val === 'parcelada') {
        amountLabel.textContent = 'Valor Total (R$)';
      } else if (val === 'recorrente') {
        amountLabel.textContent = 'Valor Mensal (R$)';
      } else {
        amountLabel.textContent = 'Valor (R$)';
      }
    });
  });

  const amountInput = document.getElementById('debtAmount');
  const installmentsInput = document.getElementById('debtInstallments');
  const paidInput = document.getElementById('debtPaidInstallments');
  const instValueInput = document.getElementById('debtInstallmentValue');

  function updateInstallmentCalc() {
    const total = parseFloat(amountInput.value) || 0;
    const inst = parseInt(installmentsInput.value) || 1;
    const instValue = total / inst;
    instValueInput.value = instValue.toFixed(2);
    updateRemainingCalc();
  }

  function updateRemainingCalc() {
    const paid = parseInt(paidInput.value) || 0;
    const instValue = parseFloat(instValueInput.value) || 0;
    const total = parseFloat(amountInput.value) || 0;
    const remaining = total - (instValue * paid);
    document.getElementById('debtRemainingValue').value = remaining.toFixed(2);
  }

  if (amountInput) amountInput.addEventListener('input', updateInstallmentCalc);
  if (installmentsInput) installmentsInput.addEventListener('input', updateInstallmentCalc);
  if (instValueInput) instValueInput.addEventListener('input', updateRemainingCalc);
  if (paidInput) paidInput.addEventListener('input', updateRemainingCalc);
}

// ===== DELETAR DÍVIDA =====
export function deleteDebt(id) {
  if (confirm('Deseja deletar esta despesa?')) {
    state.debts = state.debts.filter(d => d.id !== id);
    saveDataToStorage();
    deleteFromFirebase('debts', id);
    updateDebtsList();
    showAlert('Despesa deletada com sucesso!', 'success');
  }
}

// ===== PAGAR DÍVIDA =====
export function payDebt(id) {
  const debt = state.debts.find(d => d.id === id);
  if (!debt) return;

  const isParcelada = debt.debtType === 'parcelada' && debt.installments > 1;
  const isRecorrente = debt.debtType === 'recorrente';

  if (isParcelada) {
    const paidSoFar = (debt.paidInstallments || 0);
    const remaining = debt.installments - paidSoFar;
    if (remaining <= 0) { showAlert('Todas as parcelas já foram pagas!', 'info'); return; }
    const installmentValue = debt.installmentValue || (debt.amount / debt.installments);
    const parcNum = paidSoFar + 1;
    if (!confirm(`Pagar parcela ${parcNum}/${debt.installments} de ${formatCurrency(installmentValue)}?`)) return;

    debt.paidInstallments = parcNum;
    const transaction = {
      id: generateId(), type: 'saida', amount: installmentValue,
      category: debt.category || 'outros', responsible: debt.responsible,
      date: toDateStr(new Date()),
      description: `${debt.creditor} - Parcela ${parcNum}/${debt.installments}`,
      fromDebt: debt.id, createdAt: new Date().toISOString()
    };
    state.transactions.push(transaction);
    saveToFirebase('transactions', transaction);

    if (parcNum >= debt.installments) {
      debt.status = 'paid'; debt.paidAt = new Date().toISOString();
      showAlert(`Todas as ${debt.installments} parcelas pagas! Despesa quitada!`, 'success');
    } else {
      const nextDue = new Date(debt.dueDate + 'T12:00:00');
      nextDue.setMonth(nextDue.getMonth() + 1);
      debt.dueDate = toDateStr(nextDue);
      showAlert(`Parcela ${parcNum}/${debt.installments} paga! Próximo vencimento: ${formatDate(debt.dueDate)}`, 'success');
    }
    updateInFirebase('debts', id, { paidInstallments: debt.paidInstallments, status: debt.status, dueDate: debt.dueDate, paidAt: debt.paidAt });

  } else if (isRecorrente) {
    if (!confirm(`Pagar despesa mensal de ${formatCurrency(debt.amount)}?`)) return;
    const transaction = {
      id: generateId(), type: 'saida', amount: debt.amount,
      category: debt.category || 'outros', responsible: debt.responsible,
      date: toDateStr(new Date()),
      description: `${debt.creditor} - Mensal`,
      fromDebt: debt.id, createdAt: new Date().toISOString()
    };
    state.transactions.push(transaction);
    saveToFirebase('transactions', transaction);
    const nextDue = new Date(debt.dueDate + 'T12:00:00');
    nextDue.setMonth(nextDue.getMonth() + 1);
    debt.dueDate = toDateStr(nextDue);
    updateInFirebase('debts', id, { dueDate: debt.dueDate });
    showAlert(`${debt.creditor} pago! Próximo vencimento: ${formatDate(debt.dueDate)}`, 'success');

  } else {
    if (!confirm(`Marcar despesa de ${formatCurrency(debt.amount)} como paga?`)) return;
    debt.status = 'paid'; debt.paidAt = new Date().toISOString();
    const transaction = {
      id: generateId(), type: 'saida', amount: debt.amount,
      category: debt.category || 'outros', responsible: debt.responsible,
      date: toDateStr(new Date()),
      description: `Despesa paga: ${debt.creditor}`,
      fromDebt: debt.id, createdAt: new Date().toISOString()
    };
    state.transactions.push(transaction);
    saveToFirebase('transactions', transaction);
    updateInFirebase('debts', id, { status: 'paid', paidAt: debt.paidAt });
    showAlert('Despesa marcada como paga e registrada!', 'success');
  }

  saveDataToStorage();
  updateDebtsList();
  updateDashboard();
  updateTransactionHistory();
}

// ===== ATUALIZAR LISTA =====
export function updateDebtsList() {
  const container = document.getElementById('debtsList');
  const activeDebts = state.debts.filter(d => d.status === 'active');

  // Simplificado para 3 tipos: unica, recorrente, parcelada
  const unicaDebts = activeDebts.filter(d => d.debtType === 'unica' || !d.debtType);
  const recorrenteDebts = activeDebts.filter(d => d.debtType === 'recorrente');
  const parceladaDebts = activeDebts.filter(d => d.debtType === 'parcelada');

  const totalUnicas = unicaDebts.reduce((sum, d) => sum + d.amount, 0);
  const totalRecorrentes = recorrenteDebts.reduce((sum, d) => sum + d.amount, 0);
  const totalParceladas = parceladaDebts.reduce((sum, d) => sum + (d.installmentValue || d.amount), 0);
  const totalParceladaRemaining = parceladaDebts.reduce((sum, d) => {
    const instVal = d.installmentValue || (d.amount / (d.installments || 1));
    return sum + (d.amount - (instVal * (d.paidInstallments || 0)));
  }, 0);
  
  const activeCount = activeDebts.length;
  const totalPaid = state.debts.filter(d => d.status === 'paid').reduce((sum, d) => sum + d.amount, 0);

  document.getElementById('totalUnicas').textContent = formatCurrency(totalUnicas);
  document.getElementById('totalRecorrentes').textContent = formatCurrency(totalRecorrentes);
  document.getElementById('totalParceladas').textContent = formatCurrency(totalParceladas);
  document.getElementById('activeDebts').textContent = activeCount;
  document.getElementById('totalPaidDebtsTab').textContent = formatCurrency(totalPaid);

  document.getElementById('unicaDebtCount').textContent = `${unicaDebts.length} despesa${unicaDebts.length !== 1 ? 's' : ''}`;
  document.getElementById('recorrenteDebtCount').textContent = `${recorrenteDebts.length} despesa${recorrenteDebts.length !== 1 ? 's' : ''}`;
  document.getElementById('parceladaDebtCount').textContent = `${parceladaDebts.length} despesa${parceladaDebts.length !== 1 ? 's' : ''}`;
  document.getElementById('parceladaRemaining').textContent = `Falta: ${formatCurrency(totalParceladaRemaining)}`;

  if (state.debts.length === 0) { container.innerHTML = emptyState('Nenhuma despesa registrada ✅'); return; }

  const sorted = state.debts.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return new Date(a.dueDate + 'T12:00:00') - new Date(b.dueDate + 'T12:00:00');
  });

  container.innerHTML = sorted.map(d => {
    const dueDate = new Date(d.dueDate + 'T12:00:00');
    const today = new Date();
    const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    let statusBadge = 'active', statusLabel = 'Ativa';
    if (d.status === 'paid') { statusBadge = 'paid'; statusLabel = 'Paga'; }
    else if (daysUntilDue < 0) { statusBadge = 'overdue'; statusLabel = 'Atrasada'; }
    else if (daysUntilDue < 7) { statusBadge = 'due-soon'; statusLabel = `${daysUntilDue}d restantes`; }

    // Simplificado para 3 tipos
    const debtType = d.debtType || 'unica';
    const isParcelada = debtType === 'parcelada' && d.installments > 1;
    const isRecorrente = debtType === 'recorrente';
    const paidInst = d.paidInstallments || 0;
    const instValue = d.installmentValue || (d.amount / (d.installments || 1));
    const remaining = d.amount - (instValue * paidInst);
    const catInfo = d.category ? CATEGORY_MAP[d.category] : null;

    let typeBadge = '', typeIcon = '';
    
    if (isParcelada) {
      typeBadge = 'Parcelada';
      typeIcon = '<i class="fa-solid fa-layer-group"></i>';
    } else if (isRecorrente) {
      typeBadge = 'Recorrente';
      typeIcon = '<i class="fa-solid fa-rotate"></i>';
    } else {
      typeBadge = 'Única';
      typeIcon = '<i class="fa-solid fa-receipt"></i>';
    }

    let installmentHtml = '';
    if (isParcelada) {
      const progressPct = Math.round((paidInst / d.installments) * 100);
      installmentHtml = `
        <div class="debt-installment-info">
          <div class="debt-installment-bar"><div class="debt-installment-progress" style="width:${progressPct}%"></div></div>
          <span class="debt-installment-text">${paidInst}/${d.installments} parcelas · Parcela: ${formatCurrency(instValue)}</span>
          <span class="debt-installment-remaining">Falta: ${formatCurrency(remaining)}</span>
        </div>`;
    }

    let payBtnLabel = 'Pagar';
    if (isParcelada) payBtnLabel = 'Pagar parcela';
    else if (isRecorrente) payBtnLabel = 'Pagar mês';

    return `
      <div class="debt-item ${d.status === 'paid' ? 'debt-paid' : ''} ${statusBadge === 'overdue' ? 'debt-overdue' : ''} ${isParcelada ? 'debt-parcelada' : ''} ${isRecorrente ? 'debt-recorrente' : ''}" data-debt-id="${d.id}">
        <div class="debt-item-header">
          <div class="debt-type-icon type-${debtType}">
            ${typeIcon}
          </div>
          <div class="debt-header-info">
            <span class="debt-creditor">${esc(d.creditor)}</span>
            <span class="debt-type-label">${typeBadge}</span>
          </div>
          <div class="debt-header-right">
            <span class="debt-amount-badge">${isParcelada ? formatCurrency(instValue) : formatCurrency(d.amount)}</span>
            <span class="debt-status-badge ${statusBadge}">${statusLabel}</span>
          </div>
        </div>
        ${installmentHtml}
        <div class="debt-details-grid">
          <div class="debt-detail-item"><i class="fa-solid fa-user"></i><span>${esc(d.responsible)}</span></div>
          <div class="debt-detail-item"><i class="fa-solid fa-calendar"></i><span>${formatDate(d.dueDate)}</span></div>
          ${catInfo ? `<div class="debt-detail-item"><span class="debt-detail-cat-icon">${catInfo.icon}</span><span>${catInfo.label}</span></div>` : ''}
          ${d.description ? `<div class="debt-detail-item debt-detail-full"><i class="fa-solid fa-comment"></i><span>${esc(d.description)}</span></div>` : ''}
        </div>
        <div class="debt-item-actions">
          ${d.status !== 'paid' ? `<button onclick="editDebt('${d.id}')" class="debt-action-btn debt-btn-edit" title="Editar"><i class="fa-solid fa-pen"></i></button>` : ''}
          ${d.status !== 'paid' ? `<button onclick="payDebt('${d.id}')" class="debt-action-btn debt-btn-pay"><i class="fa-solid fa-circle-check"></i> ${payBtnLabel}</button>` : ''}
          <button onclick="deleteDebt('${d.id}')" class="debt-action-btn debt-btn-delete" title="Excluir"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>`;
  }).join('');

  updateDebtAlerts();
  if (currentDebtFilter) applyDebtFilter();
}

// ===== ALERTAS DE VENCIMENTO =====
function updateDebtAlerts() {
  const container = document.getElementById('debtAlerts');
  const bellBtn = document.getElementById('debtAlertsBell');
  const badgeEl = document.getElementById('debtAlertsBadge');
  if (!container || !bellBtn || !badgeEl) return;

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const activeDebts = state.debts.filter(d => d.status === 'active');
  const alerts = [];

  activeDebts.forEach(d => {
    const dueDate = new Date(d.dueDate + 'T12:00:00'); dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      alerts.push({ type: 'overdue', icon: 'fa-circle-exclamation', label: `<strong>${esc(d.creditor)}</strong> venceu há ${Math.abs(diffDays)} dia(s) — ${formatCurrency(d.installmentValue || d.amount)}`, days: diffDays });
    } else if (diffDays === 0) {
      alerts.push({ type: 'today', icon: 'fa-bell', label: `<strong>${esc(d.creditor)}</strong> vence <strong>hoje</strong> — ${formatCurrency(d.installmentValue || d.amount)}`, days: diffDays });
    } else if (diffDays <= 7) {
      alerts.push({ type: 'soon', icon: 'fa-clock', label: `<strong>${esc(d.creditor)}</strong> vence em ${diffDays} dia(s) (${formatDate(d.dueDate)}) — ${formatCurrency(d.installmentValue || d.amount)}`, days: diffDays });
    }
  });

  alerts.sort((a, b) => a.days - b.days);
  if (alerts.length === 0) { container.innerHTML = ''; bellBtn.style.display = 'none'; return; }

  bellBtn.style.display = 'flex';
  badgeEl.textContent = alerts.length;
  bellBtn.classList.remove('has-alerts', 'has-overdue');
  bellBtn.classList.add(alerts.some(a => a.type === 'overdue') ? 'has-overdue' : 'has-alerts');

  container.innerHTML = alerts.map(a => `
    <div class="debt-alert debt-alert-${a.type}">
      <i class="fa-solid ${a.icon}"></i>
      <span>${a.label}</span>
    </div>`).join('');
}

// ===== BELL TOGGLE =====
document.addEventListener('click', (e) => {
  const bellBtn = document.getElementById('debtAlertsBell');
  const dropdown = document.getElementById('debtAlertsDropdown');
  if (!bellBtn || !dropdown) return;
  if (bellBtn.contains(e.target)) dropdown.classList.toggle('open');
  else if (!dropdown.contains(e.target)) dropdown.classList.remove('open');
});

// ===== FILTRO DE DÍVIDAS =====
export function setupDebtFilterListeners() {
  if (_debtFilterDelegated) return;
  _debtFilterDelegated = true;

  document.addEventListener('click', (e) => {
    const card = e.target.closest('.debt-overview-card[data-filter], .summary-mini[data-filter]');
    if (!card) return;
    const filter = card.dataset.filter;
    if (currentDebtFilter === filter) { clearDebtFilter(); return; }
    currentDebtFilter = filter;
    document.querySelectorAll('.debt-overview-card[data-filter], .summary-mini[data-filter]').forEach(c => c.classList.remove('filter-active'));
    card.classList.add('filter-active');
    const filterBar = document.getElementById('debtFilterBar');
    const filterLabel = document.getElementById('debtFilterLabel');
    const labels = { 'monthly': 'Mensais (Fixas + Únicas)', 'financing': 'Financiamentos', 'loan': 'Empréstimos', 'all': 'Todas Ativas', 'paid': 'Pagas' };
    (state.familyMembers || []).forEach(m => { labels[`cartao-${m.name.replace(/\s+/g, '_')}`] = `Cartão ${m.name}`; });
    filterLabel.innerHTML = `<i class="fa-solid fa-filter"></i> ${labels[filter] || filter}`;
    filterBar.classList.add('show');
    applyDebtFilter();
  });
}

export function clearDebtFilter() {
  currentDebtFilter = null;
  document.querySelectorAll('.debt-overview-card[data-filter], .summary-mini[data-filter]').forEach(c => c.classList.remove('filter-active'));
  document.getElementById('debtFilterBar').classList.remove('show');
  document.querySelectorAll('#debtsList .debt-item').forEach(el => { el.style.display = ''; });
}

function applyDebtFilter() {
  if (!currentDebtFilter) return;
  document.querySelectorAll('#debtsList .debt-item').forEach(el => {
    const debtId = el.dataset.debtId;
    if (!debtId) { el.style.display = ''; return; }
    const debt = state.debts.find(d => d.id === debtId);
    if (!debt) { el.style.display = ''; return; }

    let show = false;
    const cartaoMode = debt.cartaoMode || 'unica';
    const isFinancingType = (debt.debtType === 'financiamento' || debt.debtType === 'parcelada') || (debt.debtType === 'cartao' && cartaoMode === 'parcelado');
    const isLoanType = debt.debtType === 'emprestimo';
    const isInstType = isFinancingType || isLoanType;

    switch (currentDebtFilter) {
      case 'monthly': show = debt.status === 'active' && !isInstType; break;
      case 'financing': show = debt.status === 'active' && isFinancingType; break;
      case 'loan': show = debt.status === 'active' && isLoanType; break;
      case 'all': show = debt.status === 'active'; break;
      case 'paid': show = debt.status === 'paid'; break;
      default:
        if (currentDebtFilter.startsWith('cartao-')) {
          const memberSlug = currentDebtFilter.replace('cartao-', '');
          const memberName = (state.familyMembers || []).find(m => m.name.replace(/\s+/g, '_') === memberSlug)?.name;
          show = memberName ? (debt.status === 'active' && debt.debtType === 'cartao' && (debt.responsible === memberName || debt.responsible === 'Ambos')) : true;
        } else { show = true; }
    }
    el.style.display = show ? '' : 'none';
  });
}

// Globals para inline handlers
window.editDebt = editDebt;
window.payDebt = payDebt;
window.deleteDebt = deleteDebt;
window.clearDebtFilter = clearDebtFilter;
window._setupDebtFilterListeners = setupDebtFilterListeners;
