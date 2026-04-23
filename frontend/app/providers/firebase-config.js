// ============================================================
// CONFIG.JS — Configurações do Sky FC
// ============================================================

export const firebaseConfig = {
  apiKey: "AIzaSyD9F_5bcZjq6PWL4TvCZixW4LeGo9UjTDk",
  authDomain: "skyfc-4b39a.firebaseapp.com",
  projectId: "skyfc-4b39a",
  storageBucket: "skyfc-4b39a.firebasestorage.app",
  messagingSenderId: "38272053110",
  appId: "1:38272053110:web:e54cfe5286c11a60315457",
  measurementId: "G-2G83P2E9ZL"
};

// ID principal do time — usado como documento padrão em /teams/
export const TEAM_ID = 'skyfc-main';

// ===== FIREBASE CLOUD MESSAGING =====
// FCM_VAPID_KEY → Firebase Console → Configurações → Cloud Messaging
//                 → Web Push certificates → Gerar par de chaves → Chave pública
export const FCM_VAPID_KEY = 'YOUR_VAPID_KEY_HERE'; // começa com "BK..." ou "BA..."
export const FCM_SERVER_KEY = 'YOUR_SERVER_KEY_HERE'; // Firebase Console → Cloud Messaging → Chave do servidor

// ===== PERFIS DE USUÁRIO =====
export const ROLES = {
  SUPERADMIN: 'superadmin',  // Apenas o dev (Luan Gs)
  ADMIN:      'admin',
  COMISSAO:   'comissao',
  JOGADOR:    'jogador'
};

export const ROLE_LABELS = {
  superadmin: 'Super Admin',
  admin:      'Administrador',
  comissao:   'Comissão Técnica',
  jogador:    'Jogador'
};

// ===== CATEGORIAS FINANCEIRAS DO TIME =====
export const CATEGORY_MAP = {
  uniformes:    { icon: '🎽', label: 'Uniformes e Materiais', css: 'cat-uniformes'   },
  taxas:        { icon: '🏆', label: 'Taxas e Inscrições',    css: 'cat-taxas'       },
  transporte:   { icon: '🚌', label: 'Transporte',            css: 'cat-transporte'  },
  alimentacao:  { icon: '🥤', label: 'Alimentação',           css: 'cat-alimentacao' },
  saude:        { icon: '💊', label: 'Saúde e Apoio',         css: 'cat-saude'       },
  divulgacao:   { icon: '📣', label: 'Divulgação e Admin',    css: 'cat-divulgacao'  },
  manutencao:   { icon: '🔧', label: 'Manutenção do Time',    css: 'cat-manutencao'  },
  outros:       { icon: '📁', label: 'Outros',                css: 'cat-outros'      }
};

// ===== TIPOS DE EVENTO =====
export const EVENT_TYPES = {
  treino:  { icon: '⚽', label: 'Treino',  css: 'event-treino'  },
  jogo:    { icon: '🏆', label: 'Jogo',    css: 'event-jogo'    },
  reuniao: { icon: '📋', label: 'Reunião', css: 'event-reuniao' },
  outro:   { icon: '📅', label: 'Outro',   css: 'event-outro'   }
};

// ===== POSIÇÕES DOS JOGADORES =====
export const POSITIONS = [
  'Goleiro', 'Lateral Direito', 'Lateral Esquerdo',
  'Zagueiro', 'Volante', 'Meia', 'Atacante', 'Ponta'
];

// ===== COMPAT — não utilizados no Sky FC, mantidos para evitar erros de import =====
export const BANK_IMG = {};
export const CREDITOR_IMG = {};
