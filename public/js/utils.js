const API_BASE = '../api';

class Toast {
    static show(message, type = 'success', duration = 4000) {
        const container = document.getElementById('toastContainer');
        const icons = {
            success: 'bi-check-circle-fill',
            error: 'bi-exclamation-triangle-fill',
            warning: 'bi-exclamation-circle-fill',
            info: 'bi-info-circle-fill'
        };
        const bgColors = {
            success: 'bg-success',
            error: 'bg-danger',
            warning: 'bg-warning',
            info: 'bg-info'
        };

        const toastId = 'toast-' + Date.now();
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-white ${bgColors[type]} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi ${icons[type]} me-2"></i>
                        ${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `;

        container.insertAdjacentHTML('beforeend', toastHTML);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: duration });
        toast.show();

        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    }
}

class ApiClient {
    static async request(endpoint, options = {}) {
        const url = `${API_BASE}/${endpoint}`;
        const config = {
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Une erreur est survenue.');
            }

            return data;
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('Impossible de contacter le serveur.');
            }
            throw error;
        }
    }

    static get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    static put(endpoint, body = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    }

    static delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function getLeaveTypeLabel(type) {
    const types = {
        annuel: 'Congé annuel',
        maladie: 'Congé maladie',
        maternite: 'Congé maternité',
        paternite: 'Congé paternité',
        personnel: 'Congé personnel',
        exceptionnel: 'Congé exceptionnel'
    };
    return types[type] || type;
}

function getStatusBadge(statut) {
    const badges = {
        'En attente': '<span class="badge text-dark" style="background:#f0d000;"><i class="bi bi-clock"></i> En attente</span>',
        'Approuvé': '<span class="badge bg-success"><i class="bi bi-check-circle"></i> Approuvé</span>',
        'Non approuvé': '<span class="badge" style="background:#e01010; color:#fff;"><i class="bi bi-x-circle"></i> Non approuvé</span>'
    };
    return badges[statut] || `<span class="badge bg-secondary">${statut}</span>`;
}

function setButtonLoading(btn, loading) {
    const textSpan = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.spinner-border');
    if (loading) {
        btn.disabled = true;
        textSpan?.classList.add('d-none');
        spinner?.classList.remove('d-none');
    } else {
        btn.disabled = false;
        textSpan?.classList.remove('d-none');
        spinner?.classList.add('d-none');
    }
}
