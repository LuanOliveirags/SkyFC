# ⚽ Sky FC — Plataforma de Gestão do Time

Aplicação web PWA (Progressive Web App) para gestão completa de um time de futebol: financeiro, jogadores, tarefas, escalação, compras e chat.

## 🎯 Funcionalidades

- 📊 **Dashboard**: KPIs financeiros, gráficos e transações recentes
- 💳 **Mensalidades / Receitas**: Registro de mensalidades dos jogadores e patrocínios
- 💸 **Transações**: Controle de entradas e saídas do time
- 🧾 **Despesas / Dívidas**: Contas a pagar, parcelamentos e status de adimplência
- 🗓️ **Escalação**: Editor tático com múltiplas formações e publicação para o time
- 🛒 **Lista de Compras**: Listas por mercado com itens, preços e checkout
- 🧹 **Tarefas**: Pré-jogo e pós-jogo com rodízio automático de responsáveis
- 💬 **Chat**: Mensagens em tempo real com notificações push (FCM)
- ⚙️ **Configurações**: Perfis de usuário, export/import e sincronização
- 📱 **PWA**: Instale como app nativo no celular ou desktop
- 🔄 **Offline**: Funciona sem conexão e sincroniza ao voltar online

## 🔐 Perfis de Acesso

| Perfil       | Permissões                                              |
|--------------|---------------------------------------------------------|
| `superadmin` | Acesso total (apenas o dev)                            |
| `admin`      | Gestão completa do time                                 |
| `comissao`   | Registrar transações, dívidas, escalação e tarefas      |
| `jogador`    | Visualização, chat e confirmação de tarefas             |

## 🚀 Como Usar

### Requisitos
- Navegador moderno com suporte a ES Modules (Chrome, Edge, Firefox, Safari)
- Conta no [Firebase](https://console.firebase.google.com) configurada

### 1. Configurar Firebase

No arquivo `frontend/app/providers/firebase-config.js`, preencha com os dados do seu projeto:

```javascript
export const firebaseConfig = {
  apiKey: "sua-api-key",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "seu-id",
  appId: "seu-app-id"
};

export const TEAM_ID = 'skyfc-main'; // ID do time no Firestore
```

### 2. Criar o Primeiro Usuário Admin

1. No Firebase Console → Authentication → Adicionar usuário
2. No Firebase Console → Firestore → Coleção `users` → Criar documento com o UID do usuário:

```json
{
  "id": "<uid do Firebase Auth>",
  "fullName": "Nome Completo",
  "email": "admin@skyfc.com",
  "login": "admin",
  "role": "admin",
  "teamId": "skyfc-main",
  "isActive": true
}
```

### 3. Abrir a Aplicação

Sirva os arquivos com qualquer servidor HTTP estático. Exemplos:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Acesse `http://localhost:8080` no navegador.

### 4. Instalar como PWA

- **Android/Desktop Chrome**: Ícone de instalação na barra de endereço
- **iOS Safari**: Compartilhar → Adicionar à Tela de Início

## 🗄️ Estrutura de Dados (Firestore)

| Coleção           | Descrição                              |
|-------------------|----------------------------------------|
| `users`           | Perfis e autenticação dos usuários     |
| `teams`           | Dados do time                          |
| `transactions`    | Entradas e saídas financeiras          |
| `debts`           | Dívidas e contas a pagar               |
| `salaries`        | Mensalidades e patrocínios             |
| `memberships`     | Controle de adimplência                |
| `events`          | Treinos e jogos                        |
| `lineups`         | Escalações publicadas                  |
| `shopping_lists`  | Listas de compras                      |
| `chores_settings` | Tarefas e rodízio por time             |
| `chat`            | Mensagens do chat                      |

## 🏗️ Estrutura do Projeto

```
├── index.html
├── manifest.json
├── service-worker.js
├── frontend/
│   ├── app/
│   │   ├── bootstrap.js          # Entry point (ES Modules)
│   │   ├── router.js             # Carregamento de páginas
│   │   ├── providers/
│   │   │   ├── firebase-config.js
│   │   │   ├── firebase-provider.js  # CRUD, sync e listeners
│   │   │   └── auth-provider.js
│   │   └── state/
│   │       └── store.js          # Estado global
│   ├── modules/
│   │   ├── dashboard/
│   │   ├── transactions/
│   │   ├── debts/
│   │   ├── salaries/
│   │   ├── lineup/
│   │   ├── chores/
│   │   ├── shopping/
│   │   ├── chat/
│   │   ├── login/
│   │   └── settings/
│   └── shared/
│       ├── components/
│       │   ├── navigation/
│       │   ├── modal/
│       │   ├── forms/
│       │   └── calendar/
│       ├── services/
│       │   └── notifications.js
│       ├── styles/
│       │   └── global/
│       └── utils/
│           └── helpers.js
└── backend/                      # API Flask (opcional)
    ├── app.py
    ├── config.py
    ├── requirements.txt
    └── docker-compose.yml
```

## 💻 Tecnologias

- **Frontend**: HTML5, CSS3, JavaScript (ES Modules), Chart.js
- **Backend as a Service**: Firebase (Auth, Firestore, Storage, Cloud Messaging)
- **PWA**: Service Worker, Web App Manifest
- **Backend opcional**: Python + Flask + SQLAlchemy (Docker)

## 🔧 Backend Python (opcional)

O backend Flask pode ser usado para lógica server-side adicional.

```bash
cd backend
pip install -r requirements.txt
python app.py
```

Ou com Docker:

```bash
cd backend
docker-compose up
```

## 📄 Licença

MIT License


Uma aplicação web moderna e responsiva para gestão completa de despesas financeiras, funcionando tanto online quanto offline com suporte a PWA (Progressive Web App).

## 🎯 Características Principais

- ✅ **Autenticação Segura**: Login com credenciais
- 📊 **Dashboard Interativo**: Gráficos e KPIs em tempo real
- ✨ **Responsivo**: Funciona perfeitamente em celulares, tablets e desktops
- 📱 **PWA**: Instale como app nativo no seu dispositivo
- 🔄 **Suporte Offline**: Funciona sem conexão com internet
- 💾 **Sincronização**: Sincronização automática com Firebase
- 📈 **Análises**: Gráficos interativos com Chart.js
- 🎨 **Dark Mode**: Suporte a modo escuro do sistema

## 🚀 Como Começar

### 1. Credenciais de Login (Padrão)
```
Usuário: root
Senha: root
```

### 2. Instalação

#### No navegador:
1. Abra `index.html` em um navegador moderno
2. A aplicação carregará automaticamente

#### Como PWA (App Nativo):
1. Acesse a aplicação no navegador
2. Clique em "Instalar App" (Chrome, Edge, Firefox)
3. Ou toque em "Compartilhar" → "Adicionar à Tela Inicial" (Mobile)

### 3. Configuração do Firebase

Para sincronizar dados com Firebase:

1. **Criar Projeto Firebase**:
   - Acesse [Firebase Console](https://console.firebase.google.com)
   - Clique "Add Project"
   - Preencha os dados do projeto

2. **Habilitar Realtime Database**:
   - Vá em "Realtime Database"
   - Clique "Create Database"
   - Escolha localização
   - Selecione "Start in test mode" (para desenvolvimento)

3. **Copiar Configuração**:
   - Vá em "Project Settings" → "Apps" → "Web"
   - Copie o objeto de configuração
   - Cole em `js/script.js` na seção `CONFIG.firebase`

```javascript
const CONFIG = {
  firebase: {
    apiKey: "sua-api-key",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "seu-messaging-id",
    appId: "seu-app-id"
  }
};
```

## 📚 Funcionalidades

### 📊 Dashboard
- Visualização de KPIs (Despesas, Saldos, Gastos)
- Gráficos interativos por categoria, responsável e evolução mensal
- Transações recentes
- Filtro por mês

### ➕ Adicionar Transação
- Registro de entradas e saídas
- Categorização (Alimentação, Transporte, Saúde, etc.)
- Atribuição de responsável
- Descrição customizável

### 📉 Controle de Dívidas
- Registro de dívidas ativas
- Status: Ativas, Atrasadas, Próximas do vencimento, Pagas
- Marcar como paga
- Organização por data de vencimento

### 💵 Financeiro (Salários)
- Registro de salários de Luan e Bianca
- Visualização de renda individual
- Cálculo de renda combinada
- Histórico anual

### ⚙️ Configurações
- Exportar dados (JSON)
- Importar dados (JSON)
- Sincronizar com Firebase
- Limpar cache
- Status de sincronização

## 🔧 Estrutura do Projeto

```
.
├── index.html              # Arquivo HTML principal
├── manifest.json           # Configuração PWA
├── service-worker.js       # Service Worker para offline
├── css/
│   ├── style.css          # Estilos globais
│   ├── app-style.css      # Estilos da aplicação
│   ├── sections.css       # Estilos das seções
│   ├── calendar-style.css # Estilos de calendário
│   ├── animations.css     # Animações
│   └── base/
│       └── responsive.css # Media queries
├── js/
│   └── script.js          # Lógica principal
├── img/                   # Ícones e imagens
└── Phyton/               # Backend Python (em desenvolvimento)
```

## 💻 Tecnologias Utilizadas

### Frontend
- **HTML5** - Estrutura
- **CSS3** - Estilos (com Grid, Flexbox, Media Queries)
- **JavaScript (ES6+)** - Lógica e interatividade
- **Chart.js** - Gráficos interativos
- **PWA** - Progressive Web App
- **Service Worker** - Suporte offline

### Backend (em desenvolvimento)
- **Python** - Servidor
- **Flask/FastAPI** - Framework web
- **SQLAlchemy** - ORM
- **Firebase Admin SDK** - Integração Firebase

### Banco de Dados
- **Firebase Realtime Database** - Armazenamento em cloud
- **LocalStorage** - Cache local

## 📱 Responsividade

A aplicação foi desenvolvida com "mobile-first" approach:

- **Mobile** (320px - 480px): Layout vertical, botões maiores
- **Tablet** (481px - 1024px): Layout adaptado, 2-3 colunas
- **Desktop** (1025px+): Layout completo, 4 colunas

Breakpoints personalizáveis em `css/base/responsive.css`

## 🔐 Segurança

### Autenticação Local
- Credentials no frontend (apenas para demo)
- Para produção, implementar backend de autenticação

### Dados
- Armazenamento em LocalStorage (navegador)
- Backup em Firebase (quando configurado)
- Exportação em JSON para backup manual

### PWA
- HTTPS recomendado para produção
- Manifest com ícones

## 📊 API Endpoints (Backend Python - em desenvolvimento)

```
GET    /api/transactions    - Listar transações
POST   /api/transactions    - Criar transação
PUT    /api/transactions/:id - Atualizar transação
DELETE /api/transactions/:id - Deletar transação

GET    /api/debts          - Listar dívidas
POST   /api/debts          - Criar dívida
PUT    /api/debts/:id      - Atualizar dívida
DELETE /api/debts/:id      - Deletar dívida

GET    /api/salaries       - Listar salários
POST   /api/salaries       - Criar salário
DELETE /api/salaries/:id   - Deletar salário
```

## 🚀 Próximas Melhorias

- [ ] Backend Python completo
- [ ] Autenticação com Firebase Auth
- [ ] Sincronização em tempo real
- [ ] Notificações push
- [ ] Relatórios PDF
- [ ] Múltiplos usuários
- [ ] Compartilhamento de despesas
- [ ] Orçamentos e metas
- [ ] Previsões com IA
- [ ] Integração com bancos

## 🤝 Contribuindo

Faça forks, crie branches e envie PRs!

## 📄 Licença

MIT License - Sinta-se livre para usar, modificar e distribuir

## 📞 Contato

Desenvolvido por: Luan e Bianca
GitHub: [WolfSource](https://github.com)

---

**Desenvolvido com ❤️ para gestão financeira eficiente**
