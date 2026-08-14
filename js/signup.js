// Validation et gestion du formulaire d'inscription
document.addEventListener('DOMContentLoaded', function() {
    const signupForm = document.getElementById('signupForm');
    const firstName = document.getElementById('firstName');
    const lastName = document.getElementById('lastName');
    const email = document.getElementById('signupEmail');
    const role = document.getElementById('signupRole');
    const password = document.getElementById('signupPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const terms = document.getElementById('terms');

    const firstNameError = document.getElementById('firstNameError');
    const lastNameError = document.getElementById('lastNameError');
    const emailError = document.getElementById('signupEmailError');
    const roleError = document.getElementById('signupRoleError');
    const passwordError = document.getElementById('signupPasswordError');
    const confirmError = document.getElementById('confirmError');
    const termsError = document.getElementById('termsError');

    const signupBtn = document.getElementById('signupBtn');
    const btnText = document.getElementById('signupBtnText');
    const spinner = document.getElementById('signupSpinner');
    const signupSuccess = document.getElementById('signupSuccess');
    const codeDisplay = document.getElementById('codeDisplay');
    const loginCodeDisplay = document.getElementById('loginCodeDisplay');

    const strengthBars = document.querySelectorAll('#passwordStrength .bar');
    const strengthText = document.getElementById('strengthText');

    // --- Indicateur de force du mot de passe ---
    password.addEventListener('input', function() {
        const val = this.value;
        const strength = getPasswordStrength(val);

        strengthBars.forEach(bar => { bar.className = 'bar'; });

        if (val.length === 0) {
            strengthText.className = 'strength-text';
            return;
        }

        strengthText.className = 'strength-text visible';

        let level = 0;
        let label = '';
        let cssClass = '';

        if (val.length < 6) {
            level = 1; label = 'Faible'; cssClass = 'weak';
        } else if (val.length < 10 || strength < 3) {
            level = 2; label = 'Moyen'; cssClass = 'medium';
        } else if (strength >= 3) {
            level = 4; label = 'Fort'; cssClass = 'strong';
        } else {
            level = 3; label = 'Bien'; cssClass = 'medium';
        }

        for (let i = 0; i < level; i++) {
            strengthBars[i].classList.add('active', cssClass);
        }

        strengthText.textContent = 'Force : ' + label;
        strengthText.className = 'strength-text visible ' + cssClass;

        if (val.length > 0 && val.length < 8) {
            passwordError.classList.add('visible');
            this.style.borderColor = '#ff4444';
        } else if (val.length >= 8) {
            passwordError.classList.remove('visible');
            this.style.borderColor = '#00cc66';
        } else {
            passwordError.classList.remove('visible');
            this.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }

        if (confirmPassword.value.length > 0) {
            checkPasswordMatch();
        }
    });

    confirmPassword.addEventListener('input', checkPasswordMatch);

    function checkPasswordMatch() {
        if (confirmPassword.value.length === 0) {
            confirmError.classList.remove('visible');
            confirmPassword.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            return;
        }
        if (confirmPassword.value !== password.value) {
            confirmError.classList.add('visible');
            confirmPassword.style.borderColor = '#ff4444';
        } else {
            confirmError.classList.remove('visible');
            confirmPassword.style.borderColor = '#00cc66';
        }
    }

    // --- Validation prénom / nom ---
    firstName.addEventListener('blur', function() {
        if (this.value.trim().length === 0) {
            firstNameError.classList.add('visible');
            this.style.borderColor = '#ff4444';
        } else {
            firstNameError.classList.remove('visible');
            this.style.borderColor = '#00cc66';
        }
    });

    lastName.addEventListener('blur', function() {
        if (this.value.trim().length === 0) {
            lastNameError.classList.add('visible');
            this.style.borderColor = '#ff4444';
        } else {
            lastNameError.classList.remove('visible');
            this.style.borderColor = '#00cc66';
        }
    });

    // Email validation
    email.addEventListener('blur', function() {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.value.trim().length === 0 || !emailPattern.test(this.value.trim())) {
            emailError.classList.add('visible');
            this.style.borderColor = '#ff4444';
        } else {
            emailError.classList.remove('visible');
            this.style.borderColor = '#00cc66';
        }
    });

    email.addEventListener('input', function() {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (this.value.trim().length > 0 && emailPattern.test(this.value.trim())) {
            emailError.classList.remove('visible');
            this.style.borderColor = '#00cc66';
        } else if (this.value.trim().length > 0) {
            emailError.classList.add('visible');
            this.style.borderColor = '#ff4444';
        } else {
            emailError.classList.remove('visible');
            this.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }
    });

    // Role validation
    role.addEventListener('change', function() {
        if (this.value) {
            roleError.classList.remove('visible');
            this.style.borderColor = '#00cc66';
        } else {
            this.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        }
    });

    // --- Soumission du formulaire ---
    signupForm.addEventListener('submit', function(e) {
        e.preventDefault();

        clearAllErrors();
        signupSuccess.classList.remove('visible');
        codeDisplay.classList.remove('visible');

        let isValid = true;
        let firstErrorField = null;

        if (!firstName.value.trim()) {
            showError(firstNameError, firstName);
            if (!firstErrorField) firstErrorField = firstName;
            isValid = false;
        }

        if (!lastName.value.trim()) {
            showError(lastNameError, lastName);
            if (!firstErrorField) firstErrorField = lastName;
            isValid = false;
        }

        if (!email.value.trim()) {
            emailError.textContent = 'Veuillez entrer votre email professionnel';
            showError(emailError, email);
            if (!firstErrorField) firstErrorField = email;
            isValid = false;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) {
            emailError.textContent = 'Format d\'email invalide';
            showError(emailError, email);
            if (!firstErrorField) firstErrorField = email;
            isValid = false;
        }

        if (!role.value) {
            showError(roleError, role);
            if (!firstErrorField) firstErrorField = role;
            isValid = false;
        }

        if (!password.value) {
            passwordError.textContent = 'Veuillez entrer un mot de passe';
            showError(passwordError, password);
            if (!firstErrorField) firstErrorField = password;
            isValid = false;
        } else if (password.value.length < 8) {
            passwordError.textContent = 'Le mot de passe doit contenir au moins 8 caractères';
            showError(passwordError, password);
            if (!firstErrorField) firstErrorField = password;
            isValid = false;
        }

        if (!confirmPassword.value) {
            confirmError.textContent = 'Veuillez confirmer votre mot de passe';
            showError(confirmError, confirmPassword);
            if (!firstErrorField) firstErrorField = confirmPassword;
            isValid = false;
        } else if (confirmPassword.value !== password.value) {
            confirmError.textContent = 'Les mots de passe ne correspondent pas';
            showError(confirmError, confirmPassword);
            if (!firstErrorField) firstErrorField = confirmPassword;
            isValid = false;
        }

        if (!terms.checked) {
            showError(termsError, terms);
            isValid = false;
        }

        if (!isValid) {
            if (firstErrorField) firstErrorField.focus();
            return;
        }

        // Envoi à l'API
        signupBtn.disabled = true;
        btnText.style.display = 'none';
        spinner.classList.add('visible');

        apiSignup(
            firstName.value.trim(),
            lastName.value.trim(),
            email.value.trim(),
            role.value,
            password.value
        ).then(data => {
            spinner.classList.remove('visible');
            btnText.style.display = 'inline';
            signupBtn.disabled = false;

            if (data.success) {
                // Afficher le code de connexion
                if (data.loginCode) {
                    loginCodeDisplay.textContent = data.loginCode;
                    codeDisplay.classList.add('visible');
                    // Stocker le code dans sessionStorage en cas de rafraîchissement
                    sessionStorage.setItem('valeo_new_loginCode', data.loginCode);
                }

                signupSuccess.textContent = '✅ Compte créé avec succès !';
                signupSuccess.classList.add('visible');

                // Désactiver tous les champs du formulaire pour éviter les modifications
                const allInputs = document.querySelectorAll('#signupForm input, #signupForm select, #signupForm button[type="submit"]');
                allInputs.forEach(el => el.disabled = true);

                // Cacher le spinner et montrer le bouton de redirection manuelle
                signupBtn.style.display = 'none';
                const redirectBtn = document.createElement('button');
                redirectBtn.type = 'button';
                redirectBtn.className = 'btn-signup';
                redirectBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Aller à la connexion';
                redirectBtn.style.marginTop = '0';
                redirectBtn.onclick = function() {
                    window.location.href = 'login.html';
                };
                signupBtn.parentNode.insertBefore(redirectBtn, signupBtn.nextSibling);
            } else {
                clearAllErrors();
                roleError.textContent = data.message || 'Erreur lors de la création du compte';
                roleError.classList.add('visible');
                role.style.borderColor = '#ff4444';
            }
        }).catch(err => {
            spinner.classList.remove('visible');
            btnText.style.display = 'inline';
            signupBtn.disabled = false;

            roleError.textContent = 'Erreur de connexion au serveur. Vérifiez que le serveur est démarré.';
            roleError.classList.add('visible');
            role.style.borderColor = '#ff4444';
        });
    });

    function getPasswordStrength(password) {
        let strength = 0;
        if (password.match(/[a-z]+/)) strength++;
        if (password.match(/[A-Z]+/)) strength++;
        if (password.match(/[0-9]+/)) strength++;
        if (password.match(/[$@#&!%^*.]+/)) strength++;
        return strength;
    }

    function showError(errorEl, inputEl) {
        errorEl.classList.add('visible');
        inputEl.style.borderColor = '#ff4444';
    }

    function clearAllErrors() {
        const errors = document.querySelectorAll('.error-message');
        errors.forEach(el => el.classList.remove('visible'));
        const inputs = document.querySelectorAll('.form-group input, .form-group select');
        inputs.forEach(input => {
            input.style.borderColor = '#2a2a2a';
        });
    }

    const inputs = document.querySelectorAll('.form-group input, .form-group select');
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            const label = this.parentElement.querySelector('label');
            if (label) label.style.color = '#c9a84c';
        });
        input.addEventListener('blur', function() {
            const label = this.parentElement.querySelector('label');
            if (label) label.style.color = '#aaaaaa';
        });
    });
});
