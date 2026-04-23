// ============================================================
// AUTH.JS — Autenticação Firebase Auth para o Sky FC
// ============================================================
/* global firebase */

import { ROLE_LABELS } from './firebase-config.js';
import { state, isAdmin, isComissao, isSuperAdmin } from '../state/store.js';
import { esc, showAlert, generateId } from '../../shared/utils/helpers.js';
import { db, auth, firebaseReady, storage as fbStorage, saveDataToStorage, loadDataFromStorage, cleanupFirebaseListeners, allowRefresh } from './firebase-provider.js';

// ===== FLAG =====
let _checkingLogin = false;

// ===== HASH DE SENHA (mantido para compatibilidade) =====
export async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== NO-OP: substituído pelo Firebase Auth =====
export async function createDefaultAdmin() {
  // O primeiro usuário admin deve ser criado via Firebase Console
  // (Authentication → Add User) e depois vinculado ao Firestore.
  console.log('ℹ️ Firebase Auth ativo — autenticação gerenciada pelo Firebase.');
}

// ===== LOGIN =====
// Aceita e-mail ou login (username). Se não contiver @, busca o e-mail no Firestore.
export async function loginUser(emailOrLogin, password) {
  if (!auth) throw new Error('Firebase Auth não disponível.');
  let email = emailOrLogin.trim();
  if (!email.includes('@')) {
    const snap = await db.collection('users')
      .where('login', '==', email.toLowerCase())
      .limit(1)
      .get();
    if (snap.empty) {
      const err = new Error('Usuário não encontrado.');
      err.code = 'auth/user-not-found';
      throw err;
    }
    email = snap.docs[0].data().email;
  }
  await auth.signInWithEmailAndPassword(email, password);
  return true;
}

// ===== LOGOUT =====
export function logout() {
  if (confirm('Tem certeza que deseja sair?')) {
    _logoutInternal();
  }
}

async function _logoutInternal() {
  try {
    cleanupFirebaseListeners();
    if (auth) await auth.signOut();
    state.isLoggedIn = false;
    state.user = null;
    state.currentUser = null;
    state.currentTeam = null;
    state.currentFamily = null;
    state.players = [];
    state.familyMembers = [];
    state.transactions = [];
    state.debts = [];
    state.salaries = [];
    state.memberships = [];
    state.events = [];
    localStorage.removeItem('user');
    document.getElementById('appContainer')?.classList.remove('active');
    document.getElementById('loginContainer')?.classList.add('active');
    document.getElementById('loginForm')?.reset();
    document.getElementById('loginError')?.classList.remove('show');
  } catch (error) {
    console.error('Erro ao sair:', error);
  }
}

// ===== REGISTRAR NOVO USUÁRIO =====
export async function registerUser(fullName, email, login, password, teamId, role = 'jogador') {
  if (!auth || !firebaseReady) throw new Error('Firebase não disponível.');
  if (!teamId) throw new Error('É necessário selecionar um time.');

  const emailCheck = await db.collection('users').where('email', '==', email).get();
  if (!emailCheck.empty) throw new Error('Esse e-mail já está cadastrado.');

  const loginCheck = await db.collection('users').where('login', '==', login.toLowerCase()).get();
  if (!loginCheck.empty) throw new Error('Esse login já está em uso.');

  const safeRole = ['admin', 'comissao', 'jogador'].includes(role) ? role : 'jogador';

  const credential = await auth.createUserWithEmailAndPassword(email, password);
  const uid = credential.user.uid;
  await credential.user.updateProfile({ displayName: fullName });

  const user = {
    id: uid,
    fullName,
    email,
    login: login || email,
    role: safeRole,
    teamId,
    createdAt: new Date().toISOString(),
    isActive: true
  };
  await db.collection('users').doc(uid).set(user);
  return user;
}

// ===== TROCAR SENHA =====
export async function changeUserPassword(userId, oldPassword, newPassword) {
  if (!auth?.currentUser) throw new Error('Não autenticado.');
  const credential = firebase.auth.EmailAuthProvider.credential(
    auth.currentUser.email, oldPassword
  );
  await auth.currentUser.reauthenticateWithCredential(credential);
  await auth.currentUser.updatePassword(newPassword);
  return true;
}

// ===== SALVAR TELEFONE =====
export async function savePhoneNumber(rawPhone) {
  if (!firebaseReady || !state.currentUser) throw new Error('Não autenticado.');
  const normalized = rawPhone.replace(/\D/g, '');
  if (normalized.length < 10 || normalized.length > 11) {
    throw new Error('Número inválido. Use o formato (DDD) + número.');
  }
  const existing = await db.collection('users').where('phone', '==', normalized).limit(1).get();
  if (!existing.empty && existing.docs[0].id !== state.currentUser.id) {
    throw new Error('Este número já está cadastrado para outro usuário.');
  }
  await db.collection('users').doc(state.currentUser.id).update({ phone: normalized });
  state.currentUser.phone = normalized;
  return normalized;
}

// ===== SALVAR RECADO =====
export async function saveRecado(text) {
  if (!firebaseReady || !state.currentUser) throw new Error('Não autenticado.');
  const trimmed = text.trim().slice(0, 120);
  await db.collection('users').doc(state.currentUser.id).update({ recado: trimmed });
  state.currentUser.recado = trimmed;
  return trimmed;
}

// ===== CARREGAR TIME =====
export async function loadFamily() {
  if (!firebaseReady || !state.currentUser?.teamId) {
    state.currentTeam = null;
    state.currentFamily = null;
    state.players = [];
    state.familyMembers = [];
    return;
  }
  try {
    const doc = await db.collection('teams').doc(state.currentUser.teamId).get();
    const team = doc.exists ? doc.data() : null;
    state.currentTeam = team;
    state.currentFamily = team; // alias para compatibilidade
    await loadFamilyMembers();
    console.log(`✅ Time carregado: ${team?.name || 'Sky FC'} — ${state.players.length} membro(s)`);
  } catch (e) {
    console.error('Erro ao carregar time:', e);
    state.currentTeam = null;
    state.currentFamily = null;
    state.players = [];
    state.familyMembers = [];
  }
}

export async function loadFamilyMembers() {
  state.players = [];
  state.familyMembers = [];
  const teamId = state.currentUser?.teamId;
  if (!teamId || !firebaseReady) return;
  try {
    const snap = await db.collection('users').where('teamId', '==', teamId).get();
    const members = snap.docs.map(d => d.data());
    state.players = members;
    state.familyMembers = members; // alias
  } catch (e) {
    console.error('Erro ao carregar membros:', e);
  }
}

// ===== POPULAR SELECTS DE MEMBROS =====
export function populateMemberSelects() {
  const members = state.players || [];
  const selects = [
    { el: document.getElementById('tranResponsible'), placeholder: 'Selecione...', addAmbos: true },
    { el: document.getElementById('debtResponsible'), placeholder: null, addAmbos: true },
    { el: document.getElementById('salaryPerson'), placeholder: null, addAmbos: false, prefix: '' }
  ];
  selects.forEach(({ el, placeholder, addAmbos, prefix }) => {
    if (!el) return;
    const prev = el.value;
    el.innerHTML = '';
    if (placeholder) el.innerHTML += `<option value="">${placeholder}</option>`;
    members.forEach(m => { el.innerHTML += `<option value="${esc(m.fullName)}">${(prefix || '')}${esc(m.fullName)}</option>`; });
    if (addAmbos) el.innerHTML += `<option value="Todos">Todos</option>`;
    if (prev && [...el.options].some(o => o.value === prev)) el.value = prev;
  });
}

// ===== CARDS DE MEMBROS =====
export function renderPersonIncomeCards() {
  const container = document.querySelector('.person-cards-grid');
  if (!container) return;
  const members = state.players || [];
  const gradients = [
    'linear-gradient(135deg, #1a3a5c, #2d6a9f)',
    'linear-gradient(135deg, #0d4a2e, #1a8a5a)',
    'linear-gradient(135deg, #3d1a5c, #7b3fa0)',
    'linear-gradient(135deg, #5c3a1a, #a06b30)'
  ];
  container.innerHTML = members.slice(0, 4).map((m, i) => `
    <div class="person-card" style="background:${gradients[i % gradients.length]}">
      <div class="person-card-name">${esc(m.fullName)}</div>
      <div class="person-card-role">${esc(ROLE_LABELS[m.role] || 'Membro')}</div>
    </div>
  `).join('');
}

export function renderCardDebtCards() {
  // Implementado na Phase 2 (módulo de dívidas do time)
}

// ===== CRIAR TIME =====
export async function createFamily(name) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  const id = `team-${Date.now()}`;
  const team = { id, name, createdAt: new Date().toISOString() };
  await db.collection('teams').doc(id).set(team);
  return team;
}

// ===== LISTAR TIMES =====
export async function loadFamiliesList() {
  if (!firebaseReady) return [];
  try {
    const snap = await db.collection('teams').get();
    return snap.docs.map(d => d.data());
  } catch (e) {
    console.error('Erro ao carregar times:', e);
    return [];
  }
}

export async function deleteFamily(teamId) {
  if (!firebaseReady) throw new Error('Firebase não disponível.');
  const usersSnap = await db.collection('users').where('teamId', '==', teamId).get();
  if (!usersSnap.empty) throw new Error('Não é possível excluir um time com usuários cadastrados.');
  await db.collection('teams').doc(teamId).delete();
}

export async function populateFamilySelects() {
  const teams = await loadFamiliesList();
  const selects = [document.getElementById('newUserFamily'), document.getElementById('editUserFamily')];
  selects.forEach(sel => {
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">Selecione um time...</option>';
    teams.forEach(t => { sel.innerHTML += `<option value="${esc(t.id)}">${esc(t.name)}</option>`; });
    if (currentVal) sel.value = currentVal;
  });
}

export async function loadFamiliesListUI() {
  const container = document.getElementById('familiesListContainer');
  if (!container) return;
  container.innerHTML = '<div class="users-list-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando times...</div>';
  try {
    const teams = await loadFamiliesList();
    if (teams.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum time cadastrado.</p>';
      return;
    }
    const usersSnap = await db.collection('users').get();
    const memberCount = {};
    usersSnap.forEach(doc => {
      const tid = doc.data().teamId;
      if (tid) memberCount[tid] = (memberCount[tid] || 0) + 1;
    });
    let html = '<div class="users-list">';
    teams.forEach(t => {
      const count = memberCount[t.id] || 0;
      html += `
        <div class="user-card">
          <div class="user-card-info">
            <div class="user-card-name"><i class="fa-solid fa-shield-halved" style="margin-right:6px;"></i>${esc(t.name)}</div>
            <div class="user-card-detail">${count} membro${count !== 1 ? 's' : ''}</div>
          </div>
          <div class="user-card-actions">
            <button class="user-action-btn delete-family-btn danger" data-id="${esc(t.id)}" data-name="${esc(t.name)}" title="Excluir">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.delete-family-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const tid = btn.dataset.id;
        const tname = btn.dataset.name;
        if (!confirm(`Excluir o time "${tname}"?`)) return;
        try {
          await deleteFamily(tid);
          showAlert(`Time "${tname}" excluído.`, 'success');
          loadFamiliesListUI();
        } catch (err) { showAlert(err.message, 'danger'); }
      });
    });
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Erro ao carregar times.</p>';
  }
}

// ===== UI DO USUÁRIO =====
export function applyUserToUI() {
  const user = state.currentUser;
  if (!user) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('headerUserName', user.fullName || user.displayName || user.email);
  set('settingsUserName', user.fullName);
  set('settingsUserEmail', user.email);

  // Telefone
  const phoneEl = document.getElementById('settingsUserPhone');
  if (phoneEl) {
    const p = user.phone || '';
    if (p) {
      const norm = p.replace(/\D/g, '');
      phoneEl.textContent = norm.length === 11
        ? `(${norm.slice(0,2)}) ${norm[2]} ${norm.slice(3,7)}-${norm.slice(7)}`
        : norm.length === 10
          ? `(${norm.slice(0,2)}) ${norm.slice(2,6)}-${norm.slice(6)}`
          : p;
    } else {
      phoneEl.textContent = 'Nenhum telefone cadastrado';
    }
  }

  // Recado
  const recadoEl = document.getElementById('settingsUserRecado');
  if (recadoEl) recadoEl.textContent = user.recado || 'Nenhum recado';

  // Chat
  const chatMyName   = document.getElementById('chatMyName');
  const chatMyRecado = document.getElementById('chatMyRecado');
  if (chatMyName)   chatMyName.textContent   = user.fullName || 'Meu Perfil';
  if (chatMyRecado) chatMyRecado.textContent = user.recado   || 'Sem recado';
  const myProfileName   = document.getElementById('myProfileName');
  const myProfileRecado = document.getElementById('myProfileRecado');
  const myProfilePhone  = document.getElementById('myProfilePhone');
  if (myProfileName)   myProfileName.textContent   = user.fullName || '—';
  if (myProfileRecado) myProfileRecado.textContent = user.recado   || 'Nenhum recado';
  if (myProfilePhone) {
    const p = user.phone || '';
    const n = p.replace(/\D/g, '');
    myProfilePhone.textContent = n.length === 11
      ? `(${n.slice(0,2)}) ${n[2]} ${n.slice(3,7)}-${n.slice(7)}`
      : n.length === 10
        ? `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
        : p || 'Não cadastrado';
  }

  // Cargo/Role
  const profileRole = document.getElementById('settingsUserRole');
  if (profileRole) {
    const roleText = ROLE_LABELS[user.role] || 'Membro';
    profileRole.textContent = roleText;
    profileRole.className = isAdmin() ? 'status-pill connected' : 'status-pill';
  }

  // Nome do time
  const teamLabel = document.getElementById('settingsFamilyName');
  if (teamLabel) teamLabel.textContent = state.currentTeam?.name || 'Sky FC';

  applyAvatar(user.photoURL || null);

  // Visibilidade por role
  const adminSection = document.getElementById('adminSection');
  if (adminSection) adminSection.style.display = isAdmin() ? 'block' : 'none';
  const manageFamiliesBtn = document.getElementById('manageFamiliesBtn');
  if (manageFamiliesBtn) manageFamiliesBtn.style.display = isAdmin() ? '' : 'none';

  // Eventos visível para todos
  const choresBtn = document.getElementById('choresNavBtn');
  if (choresBtn) choresBtn.style.display = '';

  const settingsNavBtn = document.getElementById('settingsNavBtn');
  if (settingsNavBtn) settingsNavBtn.style.display = 'none';
}

export function applyAvatar(photoURL) {
  const headerImg      = document.getElementById('headerAvatar');
  const headerFallback = document.getElementById('headerAvatarFallback');
  const settingsImg    = document.getElementById('settingsAvatar');
  const chatMyImg      = document.getElementById('chatMyAvatar');
  const chatMyFallback = document.getElementById('chatMyAvatarFallback');
  const myProfImg      = document.getElementById('myProfileAvatar');
  const myProfFallback = document.getElementById('myProfileAvatarFallback');

  // Gera iniciais a partir do nome do usuário logado
  const fullName = state.currentUser?.fullName || '';
  const parts = fullName.trim().split(/\s+/);
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (parts[0]?.[0] || '?').toUpperCase();

  if (photoURL) {
    if (headerImg)      { headerImg.src = photoURL; headerImg.style.display = 'block'; }
    if (headerFallback) { headerFallback.style.display = 'none'; }
    if (settingsImg)    { settingsImg.src = photoURL; settingsImg.style.display = 'block'; }
    if (chatMyImg)      { chatMyImg.src = photoURL; chatMyImg.style.display = 'block'; if (chatMyFallback) chatMyFallback.style.display = 'none'; }
    if (myProfImg)      { myProfImg.src = photoURL; myProfImg.style.display = 'block'; if (myProfFallback) myProfFallback.style.display = 'none'; }
  } else {
    if (headerImg)      { headerImg.style.display = 'none'; }
    if (headerFallback) { headerFallback.textContent = initials; headerFallback.style.display = 'flex'; }
    if (settingsImg)    { settingsImg.style.display = 'none'; }
    if (chatMyImg)      { chatMyImg.style.display = 'none'; if (chatMyFallback) chatMyFallback.style.display = 'flex'; }
    if (myProfImg)      { myProfImg.style.display = 'none'; if (myProfFallback) myProfFallback.style.display = 'flex'; }
  }
}

export function resizeImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatar(file) {
  const dataURL = await resizeImage(file, 256);
  let photoURL = dataURL;
  if (firebaseReady && fbStorage && state.currentUser) {
    try {
      const ref = fbStorage.ref(`avatars/${state.currentUser.id}.jpg`);
      const res = await fetch(dataURL);
      const blob = await res.blob();
      await ref.put(blob, { contentType: 'image/jpeg' });
      photoURL = await ref.getDownloadURL();
      await db.collection('users').doc(state.currentUser.id).update({ photoURL });
    } catch (error) {
      console.error('Erro no upload da foto:', error);
      await db.collection('users').doc(state.currentUser.id).update({ photoURL: dataURL });
    }
  }
  state.currentUser.photoURL = photoURL;
  applyAvatar(photoURL);
  showAlert('Foto atualizada com sucesso!', 'success');
}

// ===== VERIFICAR STATUS DE LOGIN (onAuthStateChanged) =====
export function checkLoginStatus() {
  return new Promise((resolve) => {
    if (!auth) {
      console.warn('⚠️ Firebase Auth não disponível.');
      allowRefresh(true);
      resolve();
      return;
    }

    let resolved = false;

    auth.onAuthStateChanged(async (firebaseUser) => {
      if (_checkingLogin) return;
      _checkingLogin = true;

      try {
        if (firebaseUser) {
          console.log(`✅ Usuário autenticado: ${firebaseUser.email}`);
          allowRefresh(false);

          const userDoc = await db.collection('users').doc(firebaseUser.uid).get();
          if (!userDoc.exists) {
            console.warn('⚠️ Perfil não encontrado no Firestore. Deslogando.');
            await auth.signOut();
            _showLoginPage();
            allowRefresh(true);
            return;
          }

          state.currentUser = { ...userDoc.data(), id: firebaseUser.uid, uid: firebaseUser.uid };
          state.isLoggedIn = true;
          state.user = firebaseUser.email;

          await loadFamily().catch(err => console.warn('Erro ao carregar time:', err));

          _hideLoginPage();
          applyUserToUI();

          await loadDataFromStorage();
          allowRefresh(true);
          console.log('✅ Login concluído com sucesso!');
        } else {
          console.log('ℹ️ Nenhum usuário autenticado.');
          state.isLoggedIn = false;
          state.currentUser = null;
          _showLoginPage();
          allowRefresh(true);
        }
      } catch (err) {
        console.error('❌ Erro no auth state:', err);
        _showLoginPage();
        allowRefresh(true);
      } finally {
        _checkingLogin = false;
        if (!resolved) { resolved = true; resolve(); }
      }
    }, (err) => {
      console.error('Auth observer error:', err);
      _showLoginPage();
      allowRefresh(true);
      if (!resolved) { resolved = true; resolve(); }
    });
  });
}

// ===== ADMIN: LISTAR USUÁRIOS =====
export async function loadUsersList() {
  if (!firebaseReady) { showAlert('Firebase não disponível.', 'danger'); return; }
  if (!isAdmin()) return;
  const container = document.getElementById('usersListContainer');
  if (!container) return;
  container.innerHTML = '<div class="users-list-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando usuários...</div>';
  try {
    const teamId = state.currentUser?.teamId;
    const snapshot = await db.collection('users').where('teamId', '==', teamId).get();
    if (snapshot.empty) {
      container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">Nenhum usuário encontrado.</p>';
      return;
    }
    let html = '<div class="users-list">';
    snapshot.forEach(doc => {
      const u = doc.data();
      const docId = doc.id; // sempre usar o ID do documento Firestore
      const isCurrentUser = docId === state.currentUser?.uid || u.id === state.currentUser?.id;
      const roleLabel = ROLE_LABELS[u.role] || 'Membro';
      const roleClass = (u.role === 'admin' || u.role === 'superadmin') ? 'connected' : '';
      html += `
        <div class="user-card" data-user-id="${esc(docId)}">
          <div class="user-card-info">
            <div class="user-card-name">${esc(u.fullName)}</div>
            <div class="user-card-detail">${esc(u.email)}</div>
            <span class="status-pill ${roleClass}">${esc(roleLabel)}</span>
          </div>
          <div class="user-card-actions">
            <button class="user-action-btn edit-user-btn" data-id="${esc(docId)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
            ${isCurrentUser ? '' : `<button class="user-action-btn delete-user-btn danger" data-id="${esc(docId)}" data-name="${esc(u.fullName)}" title="Excluir"><i class="fa-solid fa-trash"></i></button>`}
          </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container.querySelectorAll('.edit-user-btn').forEach(btn => btn.addEventListener('click', () => openEditUser(btn.dataset.id)));
    container.querySelectorAll('.delete-user-btn').forEach(btn => btn.addEventListener('click', () => confirmDeleteUser(btn.dataset.id, btn.dataset.name)));
  } catch (err) {
    container.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Erro ao carregar usuários.</p>';
  }
}

export async function openEditUser(userId) {
  if (!firebaseReady) return;
  try {
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) { showAlert('Usuário não encontrado.', 'danger'); return; }
    const u = doc.data();
    if (!isAdmin()) { showAlert('Você não tem permissão.', 'danger'); return; }

    document.getElementById('editUserId').value = doc.id; // sempre o ID do documento Firestore
    document.getElementById('editUserFullName').value = u.fullName || '';
    document.getElementById('editUserEmail').value = u.email || '';
    document.getElementById('editUserLogin').value = u.login || u.email || '';

    const roleEl = document.getElementById('editUserRole');
    if (roleEl) {
      // Exibe opção Super Admin apenas para quem é superadmin
      const superOpt = roleEl.querySelector('option[value="superadmin"]');
      if (superOpt) superOpt.style.display = isSuperAdmin() ? '' : 'none';
      roleEl.value = u.role || 'jogador';
      // Bloqueia edição do role se o usuário alvo é superadmin e o editor não é
      roleEl.disabled = (u.role === 'superadmin' && !isSuperAdmin());
    }
    document.getElementById('editUserNewPassword').value = '';

    const phoneInput = document.getElementById('editUserPhone');
    if (phoneInput) {
      const p = u.phone || '';
      if (p) {
        const n = p.replace(/\D/g, '');
        phoneInput.value = n.length === 11
          ? `(${n.slice(0,2)}) ${n.slice(2,7)}-${n.slice(7)}`
          : n.length === 10
            ? `(${n.slice(0,2)}) ${n.slice(2,6)}-${n.slice(6)}`
            : p;
      } else {
        phoneInput.value = '';
      }
    }
    document.getElementById('editUserModal')?.classList.add('active');
  } catch (err) {
    showAlert('Erro ao carregar dados do usuário.', 'danger');
  }
}

export async function saveUserEdit(e) {
  e.preventDefault();
  if (!isAdmin()) return;
  const userId = document.getElementById('editUserId')?.value;
  const fullName = document.getElementById('editUserFullName')?.value.trim();
  const email = document.getElementById('editUserEmail')?.value.trim();
  const roleEl = document.getElementById('editUserRole');
  const role = roleEl?.disabled ? undefined : (roleEl?.value || 'jogador');
  const rawPhone = (document.getElementById('editUserPhone')?.value || '').trim();

  if (!fullName || !email) { showAlert('Preencha todos os campos obrigatórios.', 'danger'); return; }
  if (!rawPhone) { showAlert('Telefone é obrigatório.', 'danger'); return; }
  // Impede escalada de privilégio: apenas superadmin pode atribuir role superadmin
  if (role === 'superadmin' && !isSuperAdmin()) { showAlert('Sem permissão para atribuir Super Admin.', 'danger'); return; }

  const btn = document.querySelector('#editUserForm button[type="submit"]');
  if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }
  try {
    const updates = { fullName, email, updatedAt: new Date().toISOString() };
    if (role !== undefined) updates.role = role;
    updates.phone = rawPhone.replace(/\D/g, '');

    await db.collection('users').doc(userId).update(updates);
    if (userId === state.currentUser?.id) {
      Object.assign(state.currentUser, updates);
      applyUserToUI();
    }
    showAlert('Usuário atualizado com sucesso!', 'success');
    document.getElementById('editUserModal')?.classList.remove('active');
    loadUsersList();
  } catch (err) {
    showAlert(err.message || 'Erro ao atualizar.', 'danger');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-check"></i> Salvar Alterações'; }
  }
}

export async function confirmDeleteUser(userId, userName) {
  if (!isAdmin()) return;
  if (userId === state.currentUser?.id) { showAlert('Você não pode excluir sua própria conta.', 'danger'); return; }
  if (!confirm(`Excluir o usuário "${userName}"?\nEssa ação não pode ser desfeita.`)) return;
  try {
    await db.collection('users').doc(userId).delete();
    showAlert(`Usuário "${userName}" excluído.`, 'success');
    loadUsersList();
  } catch (err) { showAlert('Erro ao excluir usuário.', 'danger'); }
}

// ===== RECUPERAÇÃO DE SENHA (Firebase Auth nativo) =====
export function initResetPasswordUI() {
  const modal = document.getElementById('resetPasswordModal');
  const openBtn = document.getElementById('forgotPasswordBtn');
  const closeBtn = document.getElementById('resetModalClose');
  if (!modal || !openBtn) return;

  openBtn.addEventListener('click', () => {
    modal.classList.add('active');
    document.getElementById('resetEmail')?.focus();
  });
  closeBtn?.addEventListener('click', () => modal.classList.remove('active'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('active'); });

  const sendBtn = document.getElementById('sendResetCode');
  sendBtn?.addEventListener('click', async () => {
    const email = document.getElementById('resetEmail')?.value?.trim();
    const errorEl = document.getElementById('resetStep1Error');
    if (!email) { if (errorEl) errorEl.textContent = 'Informe seu e-mail.'; return; }
    if (!auth) { showAlert('Firebase Auth não disponível.', 'danger'); return; }

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';
    if (errorEl) errorEl.textContent = '';
    try {
      await auth.sendPasswordResetEmail(email);
      showAlert('E-mail de recuperação enviado! Verifique sua caixa de entrada.', 'success');
      modal.classList.remove('active');
    } catch (error) {
      let msg = 'Erro ao enviar e-mail de recuperação.';
      if (error.code === 'auth/user-not-found') msg = 'Nenhuma conta com este e-mail.';
      if (error.code === 'auth/invalid-email') msg = 'E-mail inválido.';
      if (errorEl) errorEl.textContent = msg;
    } finally {
      sendBtn.disabled = false;
      sendBtn.innerHTML = 'Enviar link de recuperação';
    }
  });
}

// ===== HELPERS INTERNOS =====
function _showLoginPage() {
  document.getElementById('loginContainer')?.classList.add('active');
  document.getElementById('appContainer')?.classList.remove('active');
}

function _hideLoginPage() {
  document.getElementById('loginContainer')?.classList.remove('active');
  document.getElementById('appContainer')?.classList.add('active');
}
