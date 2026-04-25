// ============================================================
// STATE.JS — Estado global do Sky FC
// ============================================================

export const state = {
  isLoggedIn: false,
  user: null,
  currentUser: null,       // perfil do Firestore (uid = Firebase Auth UID)
  currentTeam: null,       // dados do time (/teams/{teamId})
  players: [],             // usuários do time
  currentMonth: new Date(),
  transactions: [],        // movimentações financeiras
  debts: [],               // dívidas e contas a pagar
  memberships: [],         // mensalidades dos jogadores
  events: [],              // treinos / jogos
  // Backward compat — mantidos para módulos ainda não refatorados
  salaries: [],
  familyMembers: [],
  currentFamily: null,
  syncStatus: 'online',
  charts: {},
  selectedDay: null
};

// ===== ROLES =====

export function isSuperAdmin() {
  return state.currentUser?.role === 'superadmin';
}

export function isAdmin() {
  const role = state.currentUser?.role;
  return role === 'admin' || role === 'superadmin';
}

export function isFinanceiro() {
  const role = state.currentUser?.role;
  return role === 'financeiro' || role === 'superadmin';
}

export function isComissao() {
  const role = state.currentUser?.role;
  return role === 'comissao' || role === 'financeiro' || role === 'admin' || role === 'superadmin';
}

export function isJogador() {
  return state.currentUser?.role === 'jogador';
}

// ===== TEAM ID =====

export function getTeamId() {
  return state.currentUser?.teamId ?? null;
}

// Alias para compatibilidade
export function getFamilyId() { return getTeamId(); }

// ===== STORAGE KEY =====

export function getTeamStorageKey() {
  const tid = getTeamId();
  return tid ? `skyfc_data_${tid}` : null;
}

// Alias para compatibilidade
export function getFamilyStorageKey() { return getTeamStorageKey(); }

