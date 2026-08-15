// Configuration de l'API
const API_BASE_URL = 'http://localhost:3000/api';

async function apiSignup(firstName, lastName, email, role, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ firstName, lastName, email, role, password })
        });
        return response.json();
    } catch (e) {
        return { 
            success: false, 
            message: 'Serveur non accessible. Veuillez démarrer le serveur (cd server && npm install && npm start)',
            offline: true
        };
    }
}

async function apiLogin(loginCode, password) {
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loginCode, password })
        });
        return response.json();
    } catch (e) {
        return { 
            success: false, 
            message: 'Serveur non accessible. Veuillez démarrer le serveur (cd server && npm install && npm start)',
            offline: true
        };
    }
}

async function apiGetUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users`);
        return response.json();
    } catch (e) {
        return { success: false, users: [] };
    }
}

async function apiDeleteUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'DELETE'
        });
        return response.json();
    } catch (e) {
        return { success: false };
    }
}

async function apiUpdateUserRole(userId, role) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role })
        });
        return response.json();
    } catch (e) {
        return { success: false };
    }
}

async function apiGetUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        return response.json();
    } catch (e) {
        return { success: false, message: 'Erreur de connexion au serveur.' };
    }
}

async function apiUpdateUserProfile(id, firstName, lastName, email, role) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, firstName, lastName, email, role })
        });
        return response.json();
    } catch (e) {
        return { success: false, message: 'Erreur de connexion au serveur.' };
    }
}

async function apiChangePassword(userId, currentPassword, newPassword) {
    try {
        const response = await fetch(`${API_BASE_URL}/users/change-password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, currentPassword, newPassword })
        });
        return response.json();
    } catch (e) {
        return { success: false, message: 'Erreur de connexion au serveur.' };
    }
}
