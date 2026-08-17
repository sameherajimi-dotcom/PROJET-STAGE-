// Validation et gestion du formulaire de connexion
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const codeInput = document.getElementById('loginCode');
    const passwordInput = document.getElementById('password');
    const codeError = document.getElementById('codeError');
    const passwordError = document.getElementById('passwordError');
    const loginBtn = document.getElementById('loginBtn');
    const btnText = document.getElementById('btnText');
    const spinner = document.getElementById('spinner');
    const loginSuccess = document.getElementById('loginSuccess');
    const rememberCheck = document.getElementById('remember');

    // Charger le code sauvegardé si "Se souvenir" était coché
    if (localStorage.getItem('valeo_remember') === 'true') {
        codeInput.value = localStorage.getItem('valeo_code') || '';
        rememberCheck.checked = true;
    }

    // Validation code en temps réel
    codeInput.addEventListener('input', function() {
        this.value = this.value.toUpperCase();
        if (this.value.length > 0) {
            codeError.classList.remove('visible');
            this.style.borderColor = '#00cc66';
        } else {
            codeError.classList.remove('visible');
            this.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }
    });

    // Validation mot de passe en temps réel
    passwordInput.addEventListener('input', function() {
        if (this.value.length > 0 && this.value.length < 6) {
            passwordError.classList.add('visible');
            this.style.borderColor = '#ff4444';
        } else {
            passwordError.classList.remove('visible');
            this.style.borderColor = this.value.length >= 6 ? '#00cc66' : 'rgba(255, 255, 255, 0.15)';
        }
    });

    // Soumission du formulaire
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        codeError.classList.remove('visible');
        passwordError.classList.remove('visible');
        loginSuccess.classList.remove('visible');

        let isValid = true;
        let firstError = null;

        if (!codeInput.value.trim()) {
            codeError.textContent = 'Veuillez entrer votre code de connexion';
            codeError.classList.add('visible');
            codeInput.style.borderColor = '#ff4444';
            isValid = false;
            firstError = codeInput;
        }

        if (!passwordInput.value) {
            passwordError.textContent = 'Veuillez entrer votre mot de passe';
            passwordError.classList.add('visible');
            passwordInput.style.borderColor = '#ff4444';
            isValid = false;
            if (!firstError) firstError = passwordInput;
        } else if (passwordInput.value.length < 6) {
            passwordError.textContent = 'Le mot de passe doit contenir au moins 6 caractères';
            passwordError.classList.add('visible');
            passwordInput.style.borderColor = '#ff4444';
            isValid = false;
            if (!firstError) firstError = passwordInput;
        }

        if (!isValid) {
            if (firstError) firstError.focus();
            return;
        }

        // Envoi à l'API
        loginBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.classList.add('visible');

        apiLogin(codeInput.value.trim(), passwordInput.value)
            .then(data => {
                spinner.classList.remove('visible');
                btnText.style.display = 'inline';
                loginBtn.disabled = false;

                if (data.success) {
                    // Stocker la préférence "Se souvenir"
                    if (rememberCheck.checked) {
                        localStorage.setItem('valeo_remember', 'true');
                        localStorage.setItem('valeo_code', codeInput.value.trim());
                    } else {
                        localStorage.removeItem('valeo_remember');
                        localStorage.removeItem('valeo_code');
                    }

                    // Stocker les infos utilisateur
                    if (data.user) {
                        sessionStorage.setItem('valeo_userId', data.user.id);
                        sessionStorage.setItem('valeo_userName', data.user.firstName + ' ' + data.user.lastName);
                        sessionStorage.setItem('valeo_userEmail', data.user.email || '');
                        sessionStorage.setItem('valeo_userRole', data.user.role);
                        sessionStorage.setItem('valeo_userCode', data.user.loginCode);
                        sessionStorage.setItem('valeo_isAdmin', data.user.isAdmin ? 'true' : 'false');
                    }

                    // Afficher le message de succès
                    loginSuccess.classList.add('visible');

                    // Rediriger vers le tableau de bord après 1.5s
                    setTimeout(function() {
                        window.location.href = 'dashboard.html';
                    }, 1500);
                } else {
                    passwordError.textContent = data.message || 'Code ou mot de passe incorrect';
                    passwordError.classList.add('visible');
                    passwordInput.style.borderColor = '#ff4444';
                    codeInput.style.borderColor = '#ff4444';
                }
            })
            .catch(err => {
                spinner.classList.remove('visible');
                btnText.style.display = 'inline';
                loginBtn.disabled = false;

                passwordError.textContent = 'Erreur de connexion au serveur. Vérifiez que le serveur est démarré.';
                passwordError.classList.add('visible');
                passwordInput.style.borderColor = '#ff4444';
            });
    });

    // Animation des labels au focus
    const inputs = document.querySelectorAll('.form-group input');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.querySelector('label').style.color = '#c9a84c';
        });
        input.addEventListener('blur', function() {
            this.parentElement.querySelector('label').style.color = '#aaaaaa';
        });
    });
});
