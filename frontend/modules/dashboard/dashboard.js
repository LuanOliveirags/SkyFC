// ============================================================
// DASHBOARD.JS — Dashboard KPIs e gráficos (Chart.js)
// ============================================================
/* global Chart */

import { CATEGORY_MAP } from '../../app/providers/firebase-config.js';
import { state } from '../../app/state/store.js';
import { formatCurrency } from '../../shared/utils/helpers.js';
import { updateRecentTransactions } from '../transactions/transactions.service.js';

// ===== DASHBOARD MODE STATE =====
let dashboardMode = 'geral';

// ===== KPI CARD CLICK → NAVIGATE + FILTER =====
export function setupKpiClickListeners() {
  document.addEventListener('click', (e) => {
    const card = e.target.closest('[data-kpi-action]');
    if (!card) return;
    const action = card.dataset.kpiAction;
    const filter = card.dataset.kpiFilter;

    // Navigate to the target tab
    if (typeof window.switchTab === 'function') {
      window.switchTab(action);
    }

    // If there's a debt filter, simulate clicking the matching filter card in debts tab
    if (action === 'debts' && filter) {
      setTimeout(() => {
        // Clear any existing filter first
        if (typeof window.clearDebtFilter === 'function') {
          window.clearDebtFilter();
        }
        // Find and click the matching debt overview card or summary-mini
        const targetCard = document.querySelector(`.debt-overview-card[data-filter="${filter}"], .summary-mini[data-filter="${filter}"]`);
        if (targetCard) {
          targetCard.click();
          targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  });
}

export function setupDashboardToggle() {
  // Toggle removido — dashboard único focado no clube
}

// ===== HIDE/SHOW VALUES TOGGLE =====
export function setupValuesToggle() {
  const btn = document.getElementById('toggleValuesBtn');
  const icon = document.getElementById('toggleValuesIcon');
  if (!btn || !icon) return;

  const hidden = localStorage.getItem('valuesHidden') === 'true';
  const dashboard = document.getElementById('dashboard');
  if (hidden) {
    dashboard.classList.add('values-hidden');
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  }

  btn.addEventListener('click', () => {
    const isHidden = dashboard.classList.toggle('values-hidden');
    icon.classList.replace(
      isHidden ? 'fa-eye' : 'fa-eye-slash',
      isHidden ? 'fa-eye-slash' : 'fa-eye'
    );
    localStorage.setItem('valuesHidden', isHidden);
  });
}

// ===== ATUALIZAR DASHBOARD =====
export function updateDashboard() {
  const monthVal = document.getElementById('monthFilter').value;
  let month, year;
  if (monthVal) {
    const parts = monthVal.split('-');
    year = parseInt(parts[0]);
    month = parseInt(parts[1]) - 1;
  } else {
    const now = new Date();
    month = now.getMonth();
    year = now.getFullYear();
  }

  const monthTransactions = state.transactions.filter(t => {
    const tDate = new Date(t.date + 'T12:00:00');
    return tDate.getMonth() === month && tDate.getFullYear() === year;
  });

  const monthSalaries = state.salaries.filter(s => {
    const sDate = new Date(s.date + 'T12:00:00');
    return sDate.getMonth() === month && sDate.getFullYear() === year;
  });

  // Apenas mensalidades aprovadas (ou sem status = legado) contam no caixa
  const monthSalariesApproved = monthSalaries.filter(s =>
    s.salaryType !== 'mensalidade' || s.status === 'approved' || !s.status
  );
  const monthSalariesPending = monthSalaries.filter(s =>
    s.salaryType === 'mensalidade' && s.status === 'pending'
  );

  const monthDebts = state.debts.filter(d => d.status === 'active');

  const totalExpenses = monthTransactions.filter(t => t.type === 'saida').reduce((sum, t) => sum + t.amount, 0);
  const totalTransactionIncome = monthTransactions.filter(t => t.type === 'entrada').reduce((sum, t) => sum + t.amount, 0);
  const totalSalaryIncome = monthSalariesApproved.reduce((sum, s) => sum + s.amount, 0);
  const totalIncome = totalTransactionIncome + totalSalaryIncome;
  const totalBalance = totalIncome - totalExpenses;
  const totalDebt = monthDebts.reduce((sum, d) => sum + d.amount, 0);

  const isInstallmentType = d => (d.debtType === 'financiamento' || d.debtType === 'parcelada' || d.debtType === 'emprestimo') || (d.debtType === 'cartao' && d.cartaoMode === 'parcelado');
  const monthlyDebtsActive = monthDebts.filter(d => !isInstallmentType(d));
  const totalMonthlyDebts = monthlyDebtsActive.reduce((sum, d) => sum + d.amount, 0);

  const paidDebtsThisMonth = state.transactions.filter(t => {
    if (!t.fromDebt) return false;
    const tDate = new Date(t.date + 'T12:00:00');
    return tDate.getMonth() === month && tDate.getFullYear() === year;
  });
  const totalPaidDebts = paidDebtsThisMonth.reduce((sum, t) => sum + t.amount, 0);
  const totalMonthDeductions = monthSalariesApproved.reduce((sum, s) => sum + (s.totalDeductions || 0), 0);

  // ── Mensalidades e adimplência ──
  const mensalidadesThisMonth = monthSalariesApproved.filter(s => s.salaryType === 'mensalidade');
  const aguardandoCount       = monthSalariesPending.length;
  const totalMensalidades = mensalidadesThisMonth.reduce((sum, s) => sum + s.amount, 0);
  const playersPaid = new Set(mensalidadesThisMonth.map(s => s.person)).size;
  const totalPlayers = (state.players || state.familyMembers || []).length;
  const pendentes = totalPlayers > 0 ? totalPlayers - playersPaid : 0;

  // ── Saldos das 4 Caixas ── (apenas aprovadas)
  const CAIXAS = ['mensalidade', 'vale_churrasco', 'festivais', 'patrocinio'];
  const caixaBalances = {};
  CAIXAS.forEach(c => {
    const income = monthSalariesApproved.filter(s => s.salaryType === c).reduce((sum, s) => sum + s.amount, 0)
      + monthTransactions.filter(t => t.type === 'entrada' && t.caixa === c).reduce((sum, t) => sum + t.amount, 0);
    const expense = monthTransactions.filter(t => t.type === 'saida' && t.caixa === c).reduce((sum, t) => sum + t.amount, 0);
    caixaBalances[c] = income - expense;
  });
  const caixaIds = {
    mensalidade:    'caixaMensalidadeVal',
    vale_churrasco: 'caixaValeChurrascoVal',
    festivais:      'caixaFestivaisVal',
    patrocinio:     'caixaPatrociniosVal'
  };
  CAIXAS.forEach(c => {
    const elCaixa = document.getElementById(caixaIds[c]);
    if (elCaixa) {
      elCaixa.textContent = formatCurrency(caixaBalances[c]);
      elCaixa.className = 'caixa-value ' + (caixaBalances[c] >= 0 ? 'caixa-pos' : 'caixa-neg');
    }
  });

  const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };

  // === DASHBOARD ÚNICO (foco clube) ===
  el('totalExpenses', formatCurrency(totalExpenses));
  el('totalBalance', formatCurrency(totalBalance));
  el('totalSpent', formatCurrency(totalDebt));
  el('totalIncomeDash', formatCurrency(totalIncome));

  el('dashMonthlyDebts', formatCurrency(totalMonthlyDebts));
  el('dashMonthlyCount', `${monthlyDebtsActive.length} ativa${monthlyDebtsActive.length !== 1 ? 's' : ''}`);
  el('totalPaidDebts', formatCurrency(totalPaidDebts));
  el('totalDeductionsDash', formatCurrency(totalMonthDeductions));

  // Mensalidades
  el('dashMensalidades', formatCurrency(totalMensalidades));
  el('dashMensalidadesCount', `${mensalidadesThisMonth.length} registro${mensalidadesThisMonth.length !== 1 ? 's' : ''}`);

  // Adimplência
  if (totalPlayers > 0) {
    el('dashAdimplencia', `${playersPaid}/${totalPlayers}`);
    el('dashAdimplenciaLabel', playersPaid === totalPlayers ? '✅ todos pagaram' : `${pendentes} pendente${pendentes !== 1 ? 's' : ''}`);
  } else {
    el('dashAdimplencia', '—');
    el('dashAdimplenciaLabel', 'sem jogadores');
  }

  updateCharts(monthTransactions, monthDebts);
  updateRecentTransactions(monthTransactions);

  // ── Balance label ──
  const balanceLabel = document.querySelector('.balance-label');
  if (balanceLabel) balanceLabel.textContent = 'Caixa do Clube';

  // ── Sky FC Banner stats ──
  const elP    = document.getElementById('skyfc-players-count');
  const elA    = document.getElementById('skyfc-adimplentes-count');
  const elPend = document.getElementById('skyfc-pendentes-count');
  const elAg   = document.getElementById('skyfc-aguardando-count');
  const elAgStat = document.getElementById('skyfc-aguardando-stat');
  if (elP)    elP.textContent    = totalPlayers || '—';
  if (elA)    elA.textContent    = playersPaid;
  if (elPend) elPend.textContent = pendentes;
  if (elAg)   elAg.textContent   = aguardandoCount;
  if (elAgStat) elAgStat.style.display = aguardandoCount > 0 ? '' : 'none';

  // ── Health badge ──
  const badge = document.getElementById('skyfcHealthBadge');
  const badgeText = document.getElementById('skyfcHealthText');
  if (badge && badgeText) {
    const ratio = totalIncome > 0 ? (totalExpenses / totalIncome) : 0;
    badge.classList.remove('healthy', 'warning', 'danger');
    if (totalBalance >= 0 && ratio < 0.75) {
      badge.classList.add('healthy');
      badgeText.textContent = 'Saudável';
    } else if (totalBalance >= 0 && ratio < 1) {
      badge.classList.add('warning');
      badgeText.textContent = 'Atenção';
    } else {
      badge.classList.add('danger');
      badgeText.textContent = 'Crítico';
    }
  }

  // Dynamic balance pulse
  const balanceCard = document.querySelector('.balance-card');
  if (balanceCard) {
    balanceCard.classList.remove('positive-pulse', 'negative-pulse');
    if (totalBalance > 0) balanceCard.classList.add('positive-pulse');
    else if (totalBalance < 0) balanceCard.classList.add('negative-pulse');
  }

  // Value flash on balance update
  const balanceEl = document.getElementById('totalBalance');
  if (balanceEl) {
    balanceEl.classList.remove('value-updated');
    void balanceEl.offsetWidth; // force reflow
    balanceEl.classList.add('value-updated');
  }
}

// ===== ATUALIZAR GRÁFICOS =====
export function updateCharts(transactions, debts) {
  Object.values(state.charts).forEach(chart => { if (chart) chart.destroy(); });
  state.charts = {};
  state.charts.sparkline = createBalanceSparkline(transactions);
  state.charts.category = createCategoryChart(transactions);
  state.charts.responsible = createResponsibleChart(transactions);
  state.charts.debtType = createDebtTypeChart(debts);
}

// ===== SPARKLINE =====
function createBalanceSparkline(transactions) {
  const ctx = document.getElementById('monthlyChart');
  if (!ctx) return null;

  const monthVal = document.getElementById('monthFilter').value;
  let month, year;
  if (monthVal) { const p = monthVal.split('-'); year = parseInt(p[0]); month = parseInt(p[1]) - 1; }
  else { const n = new Date(); month = n.getMonth(); year = n.getFullYear(); }
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dailyNet = Array(daysInMonth).fill(0);
  transactions.forEach(t => {
    const d = new Date(t.date + 'T12:00:00');
    if (d.getMonth() === month && d.getFullYear() === year) {
      dailyNet[d.getDate() - 1] += t.type === 'entrada' ? t.amount : -t.amount;
    }
  });

  let cum = 0;
  const cumData = dailyNet.map(v => { cum += v; return cum; });
  const labels = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  if (!cumData.some(v => v !== 0)) { ctx.style.display = 'none'; return null; }
  ctx.style.display = '';

  const isVR = dashboardMode === 'vr';
  const sparkColor = isVR ? '#689F38' : 'rgba(255,255,255,0.85)';
  const sparkBg = isVR ? 'rgba(139,195,74,0.10)' : 'rgba(255,255,255,0.10)';

  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: cumData, borderColor: sparkColor, backgroundColor: sparkBg, tension: 0.42, fill: true, pointRadius: 0, borderWidth: 2.5 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: { duration: 800, easing: 'easeInOutQuart' }
    }
  });
}

// ===== GRÁFICO POR CATEGORIA =====
function createCategoryChart(transactions) {
  const ctx = document.getElementById('categoryChart');
  if (!ctx) return null;
  const categories = {};
  transactions.filter(t => t.type === 'saida').forEach(t => { categories[t.category] = (categories[t.category] || 0) + t.amount; });
  if (Object.keys(categories).length === 0) return null;
  const COLORS = ['#3D6A8E', '#4CC9F0', '#C9A84C', '#4361EE', '#06D6A0', '#F8961E', '#4895EF', '#9CA3AF'];
  return new Chart(ctx, {
    type: 'doughnut',
    data: { labels: Object.keys(categories).map(k => CATEGORY_MAP[k]?.label || k), datasets: [{ data: Object.values(categories), backgroundColor: COLORS, borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } } }, cutout: '60%', animation: { duration: 800 } }
  });
}

// ===== GRÁFICO POR RESPONSÁVEL =====
function createResponsibleChart(transactions) {
  const ctx = document.getElementById('responsibleChart');
  if (!ctx) return null;
  const responsible = {};
  transactions.forEach(t => {
    if (!responsible[t.responsible]) responsible[t.responsible] = { entrada: 0, saida: 0 };
    responsible[t.responsible][t.type] += t.amount;
  });
  if (Object.keys(responsible).length === 0) return null;
  return new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(responsible),
      datasets: [
        { label: 'Receitas', data: Object.values(responsible).map(r => r.entrada), backgroundColor: '#4CC9F0', borderRadius: 6 },
        { label: 'Despesas', data: Object.values(responsible).map(r => r.saida), backgroundColor: '#3D6A8E', borderRadius: 6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } } },
      scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 } } }, x: { grid: { display: false }, ticks: { font: { size: 11 } } } },
      animation: { duration: 800 }
    }
  });
}

// ===== GRÁFICO POR TIPO DE DÍVIDA =====
function createDebtTypeChart(debts) {
  const ctx = document.getElementById('debtTypeChart');
  if (!ctx) return null;
  const typeMap = {
    unica: { label: 'Únicas', color: '#9CA3AF' }, fixa: { label: 'Fixas', color: '#FF9F43' },
    cartao: { label: 'Cartão', color: '#8B5CF6' }, emprestimo: { label: 'Empréstimo', color: '#06D6A0' },
    financiamento: { label: 'Financiamento', color: '#4361EE' }, parcelada: { label: 'Financiamento', color: '#4361EE' }
  };
  const totals = {};
  debts.forEach(d => {
    const key = (d.debtType === 'parcelada') ? 'financiamento' : (d.debtType || 'unica');
    const val = (key === 'financiamento' || key === 'emprestimo' || (key === 'cartao' && d.cartaoMode === 'parcelado')) ? (d.installmentValue || d.amount) : d.amount;
    totals[key] = (totals[key] || 0) + val;
  });
  const keys = Object.keys(totals);
  if (keys.length === 0) return null;
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: keys.map(k => typeMap[k]?.label || k),
      datasets: [{ data: keys.map(k => totals[k]), backgroundColor: keys.map(k => typeMap[k]?.color || '#9CA3AF'), borderWidth: 0 }]
    },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14, font: { size: 11 } } },
        tooltip: { callbacks: { label: function(ctx) { const total = ctx.dataset.data.reduce((a, b) => a + b, 0); const pct = total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0; return `${ctx.label}: ${formatCurrency(ctx.raw)} (${pct}%)`; } } }
      },
      cutout: '60%', animation: { duration: 800 }
    }
  });
}
