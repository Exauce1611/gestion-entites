const API_URL = window.location.origin + '/api';

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    
    if (!token || !user) {
        if (!window.location.pathname.includes('index.html') && window.location.pathname !== '/') {
            window.location.href = '/';
        }
        return false;
    }
    
    const userRoleEl = document.getElementById('userRole');
    if (userRoleEl) {
        userRoleEl.textContent = user.role === 'admin' ? 'Administrateur' : 'Gérant';
    }
    
    return true;
}

async function login(username, password) {
    const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Erreur de connexion');
    }
    
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    window.location.href = '/dashboard.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
}

async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    
    if (response.status === 401) {
        logout();
        throw new Error('Session expirée');
    }
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Erreur');
    return data;
}

function formatAmount(amount, type = null) {
    const formatted = new Intl.NumberFormat('fr-FR').format(Math.abs(amount));
    if (type === 'income') return `+ ${formatted} FCFA`;
    if (type === 'expense') return `- ${formatted} FCFA`;
    return `${formatted} FCFA`;
}

// Page de connexion
if (document.getElementById('loginForm')) {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('errorMessage');
        
        try {
            await login(username, password);
        } catch (error) {
            errorDiv.textContent = error.message;
            errorDiv.style.display = 'block';
        }
    });
}

// Dashboard
if (document.getElementById('entitiesGrid')) {
    checkAuth();
    
    document.getElementById('currentDate').textContent = new Date().toLocaleDateString('fr-FR');
    document.getElementById('logoutBtn').onclick = logout;
    
    async function loadDashboard() {
        try {
            const stats = await apiRequest('/stats/global');
            const grid = document.getElementById('entitiesGrid');
            
            grid.innerHTML = stats.map(entity => `
                <div class="entity-card" onclick="window.location.href='/entity.html?id=${entity.id}'">
                    <div class="entity-icon">${entity.icon || '📦'}</div>
                    <div class="entity-name">${entity.name}</div>
                    <div class="entity-balance ${entity.balance >= 0 ? 'positive' : 'negative'}">
                        ${formatAmount(entity.balance)}
                    </div>
                    <div class="entity-stats">
                        <span>📈 +${formatAmount(entity.total_income)}</span>
                        <span>📉 -${formatAmount(entity.total_expense)}</span>
                    </div>
                </div>
            `).join('');
            
            const recent = await apiRequest('/transactions/recent/global');
            const tbody = document.getElementById('recentTransactionsBody');
            
            if (recent.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Aucune transaction</td></tr>';
            } else {
                tbody.innerHTML = recent.map(t => `
                    <tr>
                        <td>${new Date(t.date).toLocaleDateString('fr-FR')}</td>
                        <td>${t.entity_icon || ''} ${t.entity_name}</td>
                        <td class="transaction-${t.type}">${t.type === 'income' ? 'Entrée' : 'Sortie'}</td>
                        <td class="transaction-${t.type}">${formatAmount(t.amount, t.type)}</td>
                        <td>${t.description || '-'}</td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error(error);
        }
    }
    
    loadDashboard();
}

// Page entité
if (document.getElementById('entityName')) {
    checkAuth();
    
    const urlParams = new URLSearchParams(window.location.search);
    const entityId = urlParams.get('id');
    let currentEntity = null;
    
    document.getElementById('backBtn').onclick = () => window.location.href = '/dashboard.html';
    document.getElementById('logoutBtn').onclick = logout;
    
    const modal = document.getElementById('transactionModal');
    const closeBtn = document.querySelector('.close');
    let currentType = null;
    
    document.getElementById('addIncomeBtn').onclick = () => {
        currentType = 'income';
        document.getElementById('modalTitle').textContent = 'Ajouter une entrée';
        document.getElementById('transactionForm').reset();
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        modal.style.display = 'flex';
    };
    
    document.getElementById('addExpenseBtn').onclick = () => {
        currentType = 'expense';
        document.getElementById('modalTitle').textContent = 'Ajouter une sortie';
        document.getElementById('transactionForm').reset();
        document.getElementById('date').value = new Date().toISOString().split('T')[0];
        modal.style.display = 'flex';
    };
    
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (e) => { if (e.target === modal) modal.style.display = 'none'; };
    
    document.getElementById('transactionForm').onsubmit = async (e) => {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('amount').value);
        const description = document.getElementById('description').value;
        const date = document.getElementById('date').value;
        
        try {
            await apiRequest('/transactions', {
                method: 'POST',
                body: JSON.stringify({ entity_id: entityId, type: currentType, amount, description, date })
            });
            modal.style.display = 'none';
            loadEntity();
        } catch (error) {
            alert(error.message);
        }
    };
    
    async function loadEntity() {
        try {
            const entity = await apiRequest(`/entities/${entityId}`);
            currentEntity = entity;
            document.getElementById('entityName').innerHTML = `${entity.icon || ''} ${entity.name}`;
            document.getElementById('balance').textContent = formatAmount(entity.balance);
            document.getElementById('totalIncome').textContent = formatAmount(entity.total_income);
            document.getElementById('totalExpense').textContent = formatAmount(entity.total_expense);
            
            const transactions = await apiRequest(`/transactions/${entityId}`);
            const tbody = document.getElementById('transactionsBody');
            
            if (transactions.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5">Aucune transaction</td></tr>';
            } else {
                const user = JSON.parse(localStorage.getItem('user'));
                tbody.innerHTML = transactions.map(t => `
                    <tr>
                        <td>${new Date(t.date).toLocaleDateString('fr-FR')}</td>
                        <td class="transaction-${t.type}">${t.type === 'income' ? 'Entrée' : 'Sortie'}</td>
                        <td class="transaction-${t.type}">${formatAmount(t.amount, t.type)}</td>
                        <td>${t.description || '-'}</td>
                        <td>${user.role === 'admin' ? `<button class="delete-btn" onclick="deleteTransaction(${t.id})">🗑️</button>` : '-'}</td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error(error);
        }
    }
    
    window.deleteTransaction = async (id) => {
        if (confirm('Supprimer cette transaction ?')) {
            try {
                await apiRequest(`/transactions/${id}`, { method: 'DELETE' });
                loadEntity();
            } catch (error) {
                alert(error.message);
            }
        }
    };
    
    loadEntity();
}