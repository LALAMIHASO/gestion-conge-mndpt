document.addEventListener('DOMContentLoaded', () => {
    checkExistingSession();
    initLoginForm();
    initPasswordToggle();
});

function checkExistingSession() {
    ApiClient.get('auth/me').then(data => {
        if (data.user) {
            window.location.href = 'dashboard.html';
        }
    }).catch(() => {});
}

function initLoginForm() {
    const form = document.getElementById('loginForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        clearErrors();

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        let valid = true;

        if (!email) {
            showFieldError('email', 'L\'email est requis.');
            valid = false;
        } else if (!isValidEmail(email)) {
            showFieldError('email', 'Format d\'email invalide.');
            valid = false;
        }

        if (!password) {
            showFieldError('password', 'Le mot de passe est requis.');
            valid = false;
        }

        if (!valid) return;

        const btn = document.getElementById('loginBtn');
        setButtonLoading(btn, true);
        hideLoginAlert();

        try {
            const data = await ApiClient.post('auth/login', { email, password });
            Toast.show('Connexion réussie ! Redirection...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 800);
        } catch (error) {
            showLoginAlert(error.message, 'error');
            setButtonLoading(btn, false);
        }
    });
}

function initPasswordToggle() {
    const toggle = document.getElementById('togglePassword');
    const password = document.getElementById('password');

    toggle.addEventListener('click', () => {
        const type = password.type === 'password' ? 'text' : 'password';
        password.type = type;
        toggle.innerHTML = type === 'password'
            ? '<i class="bi bi-eye"></i>'
            : '<i class="bi bi-eye-slash"></i>';
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showFieldError(fieldId, message) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(fieldId + 'Error');
    field.classList.add('is-invalid');
    if (error) error.textContent = message;
}

function clearErrors() {
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('.invalid-feedback').forEach(el => el.textContent = '');
}

function showLoginAlert(message, type) {
    const alert = document.getElementById('loginAlert');
    const alertClass = type === 'error' ? 'alert-danger' : 'alert-success';
    alert.className = `alert ${alertClass}`;
    alert.textContent = message;
    alert.classList.remove('d-none');
}

function hideLoginAlert() {
    document.getElementById('loginAlert').classList.add('d-none');
}