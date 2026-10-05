class Dashboard {
    static FONCTIONS_BY_DEPARTEMENT = {
        'Direction': ['PRMP', 'Assistant PRMP'],
        'Service Technique': ['Chef de service technique', 'Responsable vulgarisation', 'Suivi-Animation-Formation'],
        'SRDC': ['Chef de service SRDC - Comptable - Ordonateur suppléant', 'Aide comptable - Responsable personnel', 'Bureau secrétariat'],
        'Service Bureau Regional': ['Chef de service bureau régional', 'Responsable patrimoine', 'Dépositaire comptable', 'Assistant dépositaire comptable - Magasinier'],
        'Technicien de Surface': ['Balayeur', 'Sécurité', 'Chauffeur']
    };

    static ROLE_LABELS = {
        'directeur': 'Directeur',
        'chef_technique': 'Chef de service technique',
        'chef_srdc': 'Chef de service SRDC'
    };

    constructor() {
        this.currentUser = null;
        this.employees = [];
        this.leaves = [];
        this.authorizations = [];
        this.employeeModal = null;
        this.leaveModal = null;
        this.decisionModal = null;
        this.authorizationModal = null;
        this.authorizationDecisionModal = null;
        this.deleteModal = null;
        this.employeeModalMode = 'create';
        this.editingEmployeeId = null;
        this.editingLeaveId = null;
        this.leaveModalMode = 'create';
        this.decidingLeaveId = null;
        this.authorizationModalMode = 'create';
        this.editingAuthorizationId = null;
        this.decidingAuthorizationId = null;
        this.authFilter = 'all';
        this.currentFilter = 'all';
        this.deleteConfirmCallback = null;
    }

    get isDir() { return this.currentUser && this.currentUser.role === 'directeur'; }
    get isTech() { return this.currentUser && this.currentUser.role === 'chef_technique'; }
    get isSrdc() { return this.currentUser && this.currentUser.role === 'chef_srdc'; }
    get isAdmin() { return this.isTech || this.isSrdc; }

    async init() {
        try {
            const userData = await ApiClient.get('auth/me');
            this.currentUser = userData.user;
        } catch {
            window.location.href = 'index.html';
            return;
        }

        this.initModals();
        this.bindEvents();
        this.setCurrentDate();
        this.updateUserInfo();
        this.initHistoriqueYearSelect();

        await Promise.all([
            this.loadEmployees(),
            this.loadLeaves(),
            this.loadAuthorizations()
        ]);
        this.switchView('overview');
    }

    updateUserInfo() {
        const u = this.currentUser;
        document.getElementById('sidebarUserName').textContent = `${u.prenom} ${u.nom}`;
        document.getElementById('sidebarUserRole').textContent = Dashboard.ROLE_LABELS[u.role] || u.role;
    }

    initModals() {
        this.employeeModal = new bootstrap.Modal(document.getElementById('employeeModal'));
        this.leaveModal = new bootstrap.Modal(document.getElementById('leaveModal'));
        this.decisionModal = new bootstrap.Modal(document.getElementById('decisionModal'));
        this.authorizationModal = new bootstrap.Modal(document.getElementById('authorizationModal'));
        this.authorizationDecisionModal = new bootstrap.Modal(document.getElementById('authorizationDecisionModal'));
        this.settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
        this.deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));
    }

    setCurrentDate() {
        const el = document.getElementById('currentDate');
        if (el) {
            el.textContent = new Date().toLocaleDateString('fr-FR', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
            });
        }
    }

    bindEvents() {
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
        document.getElementById('btnSettings')?.addEventListener('click', () => this.openSettingsModal());
        document.getElementById('settingsForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });
        document.getElementById('toggleSidebar')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebarOverlay').classList.toggle('open');
        });
        document.getElementById('sidebarOverlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebarOverlay').classList.remove('open');
        });

        document.querySelectorAll('.sidebar-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');
                this.switchView(link.dataset.view);
            });
        });

        // Add buttons
        ['btnAddEmployee', 'btnAddEmployee2'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => this.openEmployeeModal());
        });
        ['btnAddLeave', 'btnAddLeave2'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => this.openLeaveModal('create'));
        });

        // Employee form
        document.getElementById('btnSaveEmployee')?.addEventListener('click', () => this.saveEmployee());
        document.getElementById('employeeForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveEmployee();
        });
        document.getElementById('empDepartement')?.addEventListener('change', (e) => {
            this.updateFonctionOptions(e.target.value);
        });

        // Leave form
        document.getElementById('btnSaveLeave')?.addEventListener('click', () => this.saveLeave());
        document.getElementById('leaveForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLeave();
        });

        // Authorization buttons & form
        ['btnAddAuthorization', 'btnAddAuthorization2'].forEach(id => {
            document.getElementById(id)?.addEventListener('click', () => this.openAuthorizationModal());
        });
        document.getElementById('btnSaveAuthorization')?.addEventListener('click', () => this.saveAuthorization());
        document.getElementById('authorizationForm')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAuthorization();
        });
        document.getElementById('authDateDebut')?.addEventListener('change', () => this.updateAuthorizationInfo());
        document.getElementById('authDateFin')?.addEventListener('change', () => this.updateAuthorizationInfo());
        document.getElementById('authUserId')?.addEventListener('change', () => this.updateAuthorizationInfo());
        document.getElementById('btnApproveAuthorization')?.addEventListener('click', () => this.decideAuthorization('Approuvé'));
        document.getElementById('btnRefuseAuthorization')?.addEventListener('click', () => this.decideAuthorization('Non approuvé'));

        // Authorization filters & search
        document.querySelectorAll('#authFilterButtons .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#authFilterButtons .btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.authFilter = e.currentTarget.dataset.filter;
                this.renderAuthorizations();
            });
        });
        document.getElementById('searchAuthorization')?.addEventListener('input', () => this.renderAuthorizations());

        // Decision
        document.getElementById('btnApproveLeave')?.addEventListener('click', () => this.decideLeave('Approuvé'));
        document.getElementById('btnRefuseLeave')?.addEventListener('click', () => this.decideLeave('Non approuvé'));

        document.getElementById('leaveDateDebut')?.addEventListener('change', () => this.updateLeaveDuration());
        document.getElementById('leaveDateFin')?.addEventListener('change', () => this.updateLeaveDuration());

        // Delete modal
        document.getElementById('btnConfirmDelete')?.addEventListener('click', () => {
            if (this.deleteConfirmCallback) {
                this.deleteConfirmCallback();
                this.deleteConfirmCallback = null;
            }
            this.deleteModal.hide();
        });

        // Filters
        document.querySelectorAll('#filterButtons .btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('#filterButtons .btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.currentFilter = e.currentTarget.dataset.filter;
                this.renderLeaves();
            });
        });

        // Historique
        document.getElementById('searchHistorique')?.addEventListener('input', () => this.renderHistorique());
        document.getElementById('historiqueYear')?.addEventListener('change', () => this.renderHistorique());
        document.getElementById('btnCloseHistoriqueDetail')?.addEventListener('click', () => {
            document.getElementById('historiqueDetail').classList.add('d-none');
        });

        // Search
        document.getElementById('searchEmployee')?.addEventListener('input', () => this.renderEmployees());
        document.getElementById('searchLeave')?.addEventListener('input', () => this.renderLeaves());
    }

    switchView(view) {
        document.querySelectorAll('.view-section').forEach(s => s.classList.add('d-none'));
        const el = document.getElementById('view-' + view);
        if (el) el.classList.remove('d-none');
        if (view === 'overview') {
            this.renderOverview();
            this.renderHistorique();
        }
        if (view === 'authorisations') this.renderAuthorizations();
    }

    /* ============ EMPLOYEES ============ */

    async loadEmployees() {
        try {
            this.employees = await ApiClient.get('employees');
            this.renderEmployees();
            this.populateLeaveUserSelect();
            this.populateAuthUserSelect();
            this.renderOverview();
        } catch (e) {
            Toast.show('Erreur lors du chargement des employés.', 'error');
        }
    }

    renderEmployees() {
        const tbody = document.getElementById('employeesTableBody');
        const search = (document.getElementById('searchEmployee')?.value || '').toLowerCase();
        const filtered = this.employees.filter(e =>
            !search || (e.prenom + ' ' + e.nom + ' ' + (e.im || '') + ' ' + e.departement + ' ' + (e.fonction || '') + ' ' + e.email).toLowerCase().includes(search)
        );

        document.getElementById('employeeCount').textContent = filtered.length;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="bi bi-people fs-1 d-block mb-2"></i>
                        Aucun employé trouvé.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((e, i) => {
            const soldeClass = e.solde_conge <= 5 ? 'text-danger fw-bold' : (e.solde_conge <= 10 ? 'text-warning fw-bold' : 'text-success fw-bold');

            let actions = '';
            if (this.isAdmin) {
                actions = `
                    <button class="btn btn-sm btn-outline-primary btn-edit-employee me-1" data-id="${e.id}" title="Modifier">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-employee" data-id="${e.id}" title="Supprimer">
                        <i class="bi bi-trash"></i>
                    </button>`;
            }

            return `
                <tr>
                    <td><strong>${e.im || '-'}</strong></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <div class="employee-avatar">${this.getInitials(e.prenom, e.nom)}</div>
                            <div>
                                <strong>${e.prenom} ${e.nom}</strong>
                            </div>
                        </div>
                    </td>
                    <td><small>${e.email}</small></td>
                    <td><span class="badge dept-badge">${e.departement}</span></td>
                    <td><small>${e.fonction || '-'}</small></td>
                    <td><small>${formatDate(e.date_embauche)}</small></td>
                    <td><span class="${soldeClass}">${e.solde_conge} jrs</span></td>
                    <td class="text-end">${actions}</td>
                </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-edit-employee').forEach(btn => {
            btn.addEventListener('click', () => this.openEmployeeModal('edit', btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete-employee').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDeleteEmployee(btn.dataset.id));
        });
    }

    getInitials(prenom, nom) {
        return (prenom?.[0] || '') + (nom?.[0] || '');
    }

    openEmployeeModal(mode = 'create', id = null) {
        this.employeeModalMode = mode;
        this.editingEmployeeId = id;
        const title = document.getElementById('employeeModalTitle');
        const btn = document.getElementById('btnSaveEmployee');
        const form = document.getElementById('employeeForm');
        form.reset();

        if (mode === 'edit' && id) {
            const emp = this.employees.find(e => e.id == id);
            if (!emp) return;
            title.innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier l\'employé';
            btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Mettre à jour';
            document.getElementById('empPrenom').value = emp.prenom;
            document.getElementById('empNom').value = emp.nom;
            document.getElementById('empIm').value = emp.im || '';
            document.getElementById('empEmail').value = emp.email;
            document.getElementById('empDepartement').value = emp.departement;
            this.updateFonctionOptions(emp.departement, emp.fonction);
            document.getElementById('empDateEmbauche').value = emp.date_embauche;
        } else {
            title.innerHTML = '<i class="bi bi-person-plus me-2"></i>Nouvel employé';
            btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Créer';
            document.getElementById('empDepartement').value = '';
            this.updateFonctionOptions('');
        }

        this.employeeModal.show();
    }

    updateFonctionOptions(departement, selectedFonction) {
        const select = document.getElementById('empFonction');
        if (!select) return;
        const fonctions = Dashboard.FONCTIONS_BY_DEPARTEMENT[departement] || [];
        select.innerHTML = '<option value="">-- Choisir --</option>';
        if (fonctions.length === 0) {
            select.innerHTML = '<option value="">-- Choisir un département d\'abord --</option>';
        } else {
            fonctions.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f;
                if (selectedFonction && selectedFonction === f) opt.selected = true;
                select.appendChild(opt);
            });
        }
    }

    async saveEmployee() {
        const btn = document.getElementById('btnSaveEmployee');

        const body = {
            prenom: document.getElementById('empPrenom').value.trim(),
            nom: document.getElementById('empNom').value.trim(),
            im: document.getElementById('empIm').value.trim(),
            email: document.getElementById('empEmail').value.trim(),
            departement: document.getElementById('empDepartement').value,
            fonction: document.getElementById('empFonction').value,
            date_embauche: document.getElementById('empDateEmbauche').value
        };

        const nomL = body.nom.toLowerCase();
        const prenomL = body.prenom.toLowerCase();
        const emailL = body.email.toLowerCase();

        const dupName = this.employees.find(e => {
            if (this.employeeModalMode === 'edit' && e.id == this.editingEmployeeId) return false;
            return (e.nom || '').toLowerCase() === nomL && (e.prenom || '').toLowerCase() === prenomL;
        });
        if (dupName) {
            Toast.show(`Un employé avec ce nom et prénom existe déjà (${dupName.prenom} ${dupName.nom}).`, 'error');
            return;
        }

        const dupEmail = this.employees.find(e => {
            if (this.employeeModalMode === 'edit' && e.id == this.editingEmployeeId) return false;
            return (e.email || '').toLowerCase() === emailL;
        });
        if (dupEmail) {
            Toast.show('Cette adresse email est déjà utilisée.', 'error');
            return;
        }

        setButtonLoading(btn, true);

        try {
            let data;
            if (this.employeeModalMode === 'edit') {
                data = await ApiClient.put(`employees/${this.editingEmployeeId}`, body);
            } else {
                data = await ApiClient.post('employees', body);
            }
            Toast.show(data.message, 'success');
            this.employeeModal.hide();
            await this.loadEmployees();
        } catch (e) {
            Toast.show(e.message, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    confirmDeleteEmployee(id) {
        const emp = this.employees.find(e => e.id == id);
        if (!emp) return;
        document.getElementById('deleteModalMessage').innerHTML =
            `Êtes-vous sûr de vouloir supprimer <strong>${emp.prenom} ${emp.nom}</strong> ?<br>
            <small class="text-muted">Cette action est irréversible.</small>`;
        this.deleteConfirmCallback = async () => {
            try {
                const data = await ApiClient.delete(`employees/${id}`);
                Toast.show(data.message, 'success');
                await this.loadEmployees();
                await this.loadLeaves();
                await this.loadAuthorizations();
            } catch (e) {
                Toast.show(e.message, 'error');
            }
        };
        this.deleteModal.show();
    }

    /* ============ LEAVES ============ */

    populateLeaveUserSelect() {
        const select = document.getElementById('leaveUserId');
        select.innerHTML = '<option value="">-- Choisir un employé --</option>' +
            this.employees.map(e =>
                `<option value="${e.id}">${e.prenom} ${e.nom} (${e.departement})</option>`
            ).join('');
    }

    async loadLeaves() {
        try {
            this.leaves = await ApiClient.get('leaves');
            this.renderLeaves();
            this.renderOverview();
            await this.loadStats();
        } catch (e) {
            Toast.show('Erreur lors du chargement des congés.', 'error');
        }
    }

    async loadStats() {
        try {
            const stats = await ApiClient.get('leaves/stats');
            document.getElementById('statEmployes').textContent = stats.employes ?? this.employees.length;
            document.getElementById('statTotal').textContent = stats.total;
            document.getElementById('statApproved').textContent = stats.approuve;
            document.getElementById('statRejected').textContent = stats.non_approuve;
        } catch {}
    }

    openLeaveModal(mode = 'create', id = null) {
        this.leaveModalMode = mode;
        this.editingLeaveId = id;
        const title = document.getElementById('leaveModalTitle');
        const btn = document.getElementById('btnSaveLeave');
        const form = document.getElementById('leaveForm');
        const statutField = document.getElementById('leaveStatutField');
        const statutInfo = document.getElementById('leaveStatutInfo');

        if (mode === 'edit' && id) {
            const leave = this.leaves.find(l => l.id == id);
            if (!leave) return;
            title.innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier le congé';
            btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Mettre à jour';
            document.getElementById('leaveUserId').value = leave.user_id;
            document.getElementById('leaveType').value = leave.type_conge;
            document.getElementById('leaveDateDebut').value = leave.date_debut;
            document.getElementById('leaveDateFin').value = leave.date_fin;
            document.getElementById('leaveLieu').value = leave.lieu || '';
            document.getElementById('leaveMotif').value = leave.motif || '';
            if (this.isDir) {
                document.getElementById('leaveStatut').value = leave.statut;
                statutField.classList.remove('d-none');
                statutInfo.classList.add('d-none');
            } else {
                statutField.classList.add('d-none');
            }
        } else {
            title.innerHTML = '<i class="bi bi-calendar-plus me-2"></i>Nouveau congé';
            btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Créer';
            form.reset();
            document.getElementById('leaveStatut').value = 'En attente';
            statutField.classList.add('d-none');
            statutInfo.classList.remove('d-none');
        }

        this.updateLeaveDuration();
        this.leaveModal.show();
    }

    updateLeaveDuration() {
        const debut = document.getElementById('leaveDateDebut').value;
        const fin = document.getElementById('leaveDateFin').value;
        const el = document.getElementById('leaveDuration');
        if (!debut || !fin) {
            el.innerHTML = 'Sélectionnez les dates pour calculer la durée';
            el.className = 'badge bg-secondary';
            return;
        }
        const d1 = new Date(debut), d2 = new Date(fin);
        if (d1 > d2) {
            el.innerHTML = 'Date de fin antérieure à la date de début';
            el.className = 'badge bg-danger';
            return;
        }
        const diff = Math.round((d2 - d1) / 86400000) + 1;
        el.innerHTML = `${diff} jour${diff > 1 ? 's' : ''} de congé`;
        el.className = 'badge bg-primary';
    }

    getLeaveDuration(debut, fin) {
        if (!debut || !fin) return 0;
        const d1 = new Date(debut), d2 = new Date(fin);
        return Math.max(0, Math.round((d2 - d1) / 86400000) + 1);
    }

    openDecisionModal(id) {
        const leave = this.leaves.find(l => l.id == id);
        if (!leave) return;
        const employee = this.employees.find(e => e.id == leave.user_id);
        const empName = leave.employee_name || (employee ? `${employee.prenom} ${employee.nom}` : 'Employé');

        this.decidingLeaveId = id;
        const duration = this.getLeaveDuration(leave.date_debut, leave.date_fin);

        document.getElementById('decisionLeaveId').textContent = leave.id;
        document.getElementById('decisionEmployeeInfo').innerHTML = `
            <strong>${empName}</strong><br>
            <small class="text-muted">${employee?.departement || ''}</small>
        `;

        const solde = parseFloat(employee?.solde_conge) || 0;
        const soldeApres = solde - duration;
        const soldeClass = soldeApres < 0 ? 'text-danger fw-bold' : 'text-success fw-bold';
        document.getElementById('decisionSolde').innerHTML = `
            <span class="badge dept-badge">
                <i class="bi bi-wallet2 me-1"></i>Solde restant : <strong>${solde} jrs</strong>
            </span><br>
            <small class="${soldeClass}">Après approbation : ${soldeApres} jrs</small>
        `;

        document.getElementById('decisionLeaveInfo').innerHTML = `
            <div class="mb-1"><span class="badge type-badge">${getLeaveTypeLabel(leave.type_conge)}</span></div>
            <small>
                <i class="bi bi-calendar3 me-1"></i>${formatDate(leave.date_debut)} → ${formatDate(leave.date_fin)}<br>
                <i class="bi bi-hourglass-split me-1"></i>${duration} jour${duration > 1 ? 's' : ''}<br>
                <i class="bi bi-geo-alt me-1"></i>${leave.lieu || '-'}
            </small>
            ${leave.motif ? `<br><small class="text-muted"><i class="bi bi-chat-left-text me-1"></i>${leave.motif}</small>` : ''}
            <div class="mt-2">${getStatusBadge(leave.statut)}</div>
            ${leave.commentaire_manager ? `<small class="text-muted"><strong>Commentaire :</strong> ${leave.commentaire_manager}</small>` : ''}
        `;

        document.getElementById('decisionHistoryName').textContent = empName;
        const history = this.leaves
            .filter(l => l.user_id == leave.user_id && l.id != leave.id)
            .sort((a, b) => (b.date_soumission || '').localeCompare(a.date_soumission || ''));

        const historyEl = document.getElementById('decisionHistory');
        if (history.length === 0) {
            historyEl.innerHTML = `
                <div class="text-center py-3 text-muted">
                    <i class="bi bi-inbox fs-3 d-block mb-1"></i>
                    Aucun congé passé pour cet employé.
                </div>`;
        } else {
            historyEl.innerHTML = history.map(h => `
                <div class="history-item">
                    <div class="history-item-left">
                        <span class="badge type-badge">${getLeaveTypeLabel(h.type_conge)}</span>
                        <small class="text-muted ms-2">
                            ${formatDate(h.date_debut)} → ${formatDate(h.date_fin)}
                            <span class="badge bg-secondary ms-1">${this.getLeaveDuration(h.date_debut, h.date_fin)} jrs</span>
                        </small>
                    </div>
                    <div>${getStatusBadge(h.statut)}</div>
                </div>`).join('');
        }

        const comment = leave.commentaire_manager || '';
        document.getElementById('decisionComment').value = comment;

        const pending = leave.statut === 'En attente';
        document.getElementById('btnApproveLeave').classList.toggle('disabled', !pending);
        document.getElementById('btnRefuseLeave').classList.toggle('disabled', !pending);

        this.decisionModal.show();
    }

    async decideLeave(statut) {
        const id = this.decidingLeaveId;
        if (!id) return;
        const comment = document.getElementById('decisionComment').value.trim();
        if (!comment) {
            Toast.show('Veuillez saisir un commentaire précisant le motif de votre décision.', 'error');
            return;
        }
        const body = { statut, commentaire_manager: comment };
        const btn = statut === 'Approuvé' ? document.getElementById('btnApproveLeave') : document.getElementById('btnRefuseLeave');

        try {
            const data = await ApiClient.put(`leaves/${id}`, body);
            Toast.show(data.message, 'success');
            this.decisionModal.hide();
            await this.loadLeaves();
        } catch (e) {
            Toast.show(e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    async saveLeave() {
        const btn = document.getElementById('btnSaveLeave');
        setButtonLoading(btn, true);

        const body = {
            user_id: document.getElementById('leaveUserId').value,
            type_conge: document.getElementById('leaveType').value,
            date_debut: document.getElementById('leaveDateDebut').value,
            date_fin: document.getElementById('leaveDateFin').value,
            lieu: document.getElementById('leaveLieu').value.trim(),
            motif: document.getElementById('leaveMotif').value.trim()
        };

        if (this.leaveModalMode === 'edit' && this.isDir) {
            body.statut = document.getElementById('leaveStatut').value;
        }

        try {
            let data;
            if (this.leaveModalMode === 'edit') {
                data = await ApiClient.put(`leaves/${this.editingLeaveId}`, body);
            } else {
                data = await ApiClient.post('leaves', body);
            }
            Toast.show(data.message, 'success');
            this.leaveModal.hide();
            await this.loadLeaves();
        } catch (e) {
            Toast.show(e.message, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    renderLeaves() {
        const tbody = document.getElementById('leavesTableBody');
        const search = (document.getElementById('searchLeave')?.value || '').toLowerCase();
        let filtered = this.leaves;
        if (this.currentFilter !== 'all') {
            filtered = filtered.filter(l => l.statut === this.currentFilter);
        }
        if (search) {
            filtered = filtered.filter(l =>
                (l.employee_name + ' ' + getLeaveTypeLabel(l.type_conge) + ' ' + (l.lieu || '') + ' ' + (l.motif || '')).toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                        Aucun congé trouvé.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(leave => {
            const typeLabel = getLeaveTypeLabel(leave.type_conge);

            let actions = '';
            if (this.isDir) {
                actions = `
                    <button class="btn btn-sm btn-outline-secondary btn-review-leave" data-id="${leave.id}" title="Examiner et décider">
                        <i class="bi bi-eye"></i>
                    </button>`;
            } else if (this.isAdmin) {
                actions = `
                    <button class="btn btn-sm btn-outline-primary btn-edit-leave me-1" data-id="${leave.id}" title="Modifier">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-leave" data-id="${leave.id}" title="Supprimer">
                        <i class="bi bi-trash"></i>
                    </button>`;
            }

            return `
                <tr>
                    <td><strong>#${leave.id}</strong></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <div class="employee-avatar sm">${this.getInitials(...(leave.employee_name || '? ?').split(' '))}</div>
                            <div>
                                <strong>${leave.employee_name}</strong><br>
                                <small class="text-muted">${leave.departement || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td><span class="badge type-badge">${typeLabel}</span></td>
                    <td>
                        <small>
                            <i class="bi bi-calendar3 me-1"></i>${formatDate(leave.date_debut)}<br>
                            <i class="bi bi-calendar-check me-1"></i>${formatDate(leave.date_fin)}
                        </small>
                    </td>
                    <td><small>${leave.motif || '-'}</small></td>
                    <td><small><i class="bi bi-geo-alt me-1"></i>${leave.lieu || '-'}</small></td>
                    <td>${getStatusBadge(leave.statut)}</td>
                    <td class="text-end">${actions}</td>
                </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-review-leave').forEach(btn => {
            btn.addEventListener('click', () => this.openDecisionModal(btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit-leave').forEach(btn => {
            btn.addEventListener('click', () => this.openLeaveModal('edit', btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete-leave').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDeleteLeave(btn.dataset.id));
        });
    }

    confirmDeleteLeave(id) {
        const leave = this.leaves.find(l => l.id == id);
        if (!leave) return;
        document.getElementById('deleteModalMessage').innerHTML =
            `Êtes-vous sûr de vouloir supprimer le congé <strong>#${id}</strong> de <strong>${leave.employee_name}</strong> ?<br>
            <small class="text-muted">Cette action est irréversible.</small>`;
        this.deleteConfirmCallback = async () => {
            try {
                const data = await ApiClient.delete(`leaves/${id}`);
                Toast.show(data.message, 'success');
                await this.loadLeaves();
            } catch (e) {
                Toast.show(e.message, 'error');
            }
        };
        this.deleteModal.show();
    }

    /* ============ AUTORISATIONS D'ABSENCE ============ */

    populateAuthUserSelect() {
        const select = document.getElementById('authUserId');
        if (!select) return;
        select.innerHTML = '<option value="">-- Choisir un employé --</option>' +
            this.employees.map(e =>
                `<option value="${e.id}">${e.prenom} ${e.nom} (${e.departement})</option>`
            ).join('');
    }

    async loadAuthorizations() {
        try {
            this.authorizations = await ApiClient.get('authorizations');
            this.renderAuthorizations();
            this.renderOverview();
        } catch (e) {
            Toast.show('Erreur lors du chargement des autorisations.', 'error');
        }
    }

    getAuthorizationDuration(debut, fin) {
        if (!debut || !fin) return 0;
        const d1 = new Date(debut), d2 = new Date(fin);
        return Math.max(0, Math.round((d2 - d1) / 86400000) + 1);
    }

    getMonthlyUsage(userId, excludeId = null) {
        const months = {};
        this.authorizations.forEach(a => {
            if (a.user_id != userId) return;
            if (excludeId && a.id == excludeId) return;
            if (a.statut === 'Non approuvé') return;
            let cur = new Date(a.date_debut);
            const end = new Date(a.date_fin);
            while (cur <= end) {
                const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
                if (!months[key]) months[key] = 0;
                months[key]++;
                cur = new Date(cur.getTime() + 86400000);
            }
        });
        return months;
    }

    renderAuthorizations() {
        const tbody = document.getElementById('authorizationsTableBody');
        const search = (document.getElementById('searchAuthorization')?.value || '').toLowerCase();
        let filtered = this.authorizations;
        if (this.authFilter !== 'all') {
            filtered = filtered.filter(a => a.statut === this.authFilter);
        }
        if (search) {
            filtered = filtered.filter(a =>
                (a.employee_name + ' ' + (a.lieu || '') + ' ' + (a.motif || '')).toLowerCase().includes(search)
            );
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4 text-muted">
                        <i class="bi bi-person-slash fs-1 d-block mb-2"></i>
                        Aucune autorisation trouvée.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(a => {
            const days = this.getAuthorizationDuration(a.date_debut, a.date_fin);

            let actions = '';
            if (this.isDir) {
                actions = `
                    <button class="btn btn-sm btn-outline-secondary btn-review-auth" data-id="${a.id}" title="Examiner et décider">
                        <i class="bi bi-eye"></i>
                    </button>`;
            } else if (this.isAdmin) {
                actions = `
                    <button class="btn btn-sm btn-outline-primary btn-edit-auth me-1" data-id="${a.id}" title="Modifier">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-auth" data-id="${a.id}" title="Supprimer">
                        <i class="bi bi-trash"></i>
                    </button>`;
            }

            return `
                <tr>
                    <td><strong>#${a.id}</strong></td>
                    <td>
                        <div class="d-flex align-items-center gap-2">
                            <div class="employee-avatar sm">${this.getInitials(...(a.employee_name || '? ?').split(' '))}</div>
                            <div>
                                <strong>${a.employee_name}</strong><br>
                                <small class="text-muted">${a.departement || ''}</small>
                            </div>
                        </div>
                    </td>
                    <td>
                        <small>
                            <i class="bi bi-calendar3 me-1"></i>${formatDate(a.date_debut)}<br>
                            <i class="bi bi-calendar-check me-1"></i>${formatDate(a.date_fin)}
                        </small>
                    </td>
                    <td><span class="badge bg-secondary">${days} jrs</span></td>
                    <td><small>${a.motif || '-'}</small></td>
                    <td><small><i class="bi bi-geo-alt me-1"></i>${a.lieu || '-'}</small></td>
                    <td>${getStatusBadge(a.statut)}</td>
                    <td class="text-end">${actions}</td>
                </tr>`;
        }).join('');

        tbody.querySelectorAll('.btn-review-auth').forEach(btn => {
            btn.addEventListener('click', () => this.openAuthorizationDecision(btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-edit-auth').forEach(btn => {
            btn.addEventListener('click', () => this.openAuthorizationModal('edit', btn.dataset.id));
        });
        tbody.querySelectorAll('.btn-delete-auth').forEach(btn => {
            btn.addEventListener('click', () => this.confirmDeleteAuthorization(btn.dataset.id));
        });
    }

    openAuthorizationModal(mode = 'create', id = null) {
        this.authorizationModalMode = mode;
        this.editingAuthorizationId = id;
        const title = document.getElementById('authorizationModalTitle');
        const btn = document.getElementById('btnSaveAuthorization');
        const form = document.getElementById('authorizationForm');
        form.reset();

        if (mode === 'edit' && id) {
            const auth = this.authorizations.find(a => a.id == id);
            if (!auth) return;
            title.innerHTML = '<i class="bi bi-pencil me-2"></i>Modifier l\'autorisation d\'absence';
            btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Mettre à jour';
            document.getElementById('authUserId').value = auth.user_id;
            document.getElementById('authDateDebut').value = auth.date_debut;
            document.getElementById('authDateFin').value = auth.date_fin;
            document.getElementById('authLieu').value = auth.lieu || '';
            document.getElementById('authMotif').value = auth.motif || '';
            if (this.isDir) {
                document.getElementById('authStatut').value = auth.statut;
                document.getElementById('authStatutField').classList.remove('d-none');
            } else {
                document.getElementById('authStatutField').classList.add('d-none');
            }
        } else {
            title.innerHTML = '<i class="bi bi-person-check me-2"></i>Nouvelle autorisation d\'absence';
            btn.innerHTML = '<i class="bi bi-check-lg me-2"></i>Créer';
            document.getElementById('authStatutField').classList.add('d-none');
        }

        this.updateAuthorizationInfo();
        this.authorizationModal.show();
    }

    updateAuthorizationInfo() {
        const debut = document.getElementById('authDateDebut').value;
        const fin = document.getElementById('authDateFin').value;
        const userId = document.getElementById('authUserId').value;
        const el = document.getElementById('authDuration');
        const infoEl = document.getElementById('authLimitInfo');

        if (!debut || !fin) {
            el.innerHTML = 'Sélectionnez les dates pour calculer la durée';
            el.className = 'badge bg-secondary';
            infoEl.classList.remove('d-none');
            return;
        }
        const d1 = new Date(debut), d2 = new Date(fin);
        if (d1 > d2) {
            el.innerHTML = 'Date de fin antérieure à la date de début';
            el.className = 'badge bg-danger';
            infoEl.classList.remove('d-none');
            return;
        }
        const diff = Math.round((d2 - d1) / 86400000) + 1;
        el.innerHTML = `${diff} jour${diff > 1 ? 's' : ''} d'absence`;
        el.className = 'badge bg-primary';

        if (!userId) {
            infoEl.innerHTML = `
                <div class="alert alert-info mb-0 py-2 small">
                    <i class="bi bi-info-circle me-1"></i>
                    Chaque employé a droit à <strong>2 jours d'autorisation d'absence par mois</strong>.
                </div>`;
            infoEl.classList.remove('d-none');
            return;
        }

        const excludeId = this.authorizationModalMode === 'edit' ? this.editingAuthorizationId : null;
        const usage = this.getMonthlyUsage(parseInt(userId), excludeId);
        const newDays = this.getMonthlyDays(debut, fin);
        const monthsInfo = [];
        let over = false;
        Object.keys(newDays).forEach(month => {
            const used = (usage[month] || 0) + newDays[month];
            const monthLabel = new Date(month + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
            const remaining = Math.max(0, 2 - used);
            const color = used > 2 ? 'text-danger' : (remaining <= 0 ? 'text-warning' : 'text-success');
            monthsInfo.push(`<span class="${color}">${monthLabel} : ${used}/2 jrs</span>`);
            if (used > 2) over = true;
        });

        infoEl.innerHTML = `
            <div class="alert ${over ? 'alert-danger' : usage[Object.keys(newDays)[0]] !== undefined ? 'alert-warning' : 'alert-info'} mb-0 py-2 small">
                <i class="bi bi-info-circle me-1"></i>
                Utilisation du mois : ${monthsInfo.join(' — ')}
                ${over ? '<br><span class="fw-bold">Dépassement ! Maximum 2 jours par mois.</span>' : ''}
            </div>`;
        infoEl.classList.remove('d-none');
    }

    getMonthlyDays(debut, fin) {
        const result = {};
        let cur = new Date(debut);
        const end = new Date(fin);
        while (cur <= end) {
            const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
            if (!result[key]) result[key] = 0;
            result[key]++;
            cur = new Date(cur.getTime() + 86400000);
        }
        return result;
    }

    async saveAuthorization() {
        const btn = document.getElementById('btnSaveAuthorization');
        setButtonLoading(btn, true);

        const body = {
            user_id: document.getElementById('authUserId').value,
            date_debut: document.getElementById('authDateDebut').value,
            date_fin: document.getElementById('authDateFin').value,
            lieu: document.getElementById('authLieu').value.trim(),
            motif: document.getElementById('authMotif').value.trim()
        };

        if (this.authorizationModalMode === 'edit') {
            if (this.isDir) {
                body.statut = document.getElementById('authStatut').value;
            } else {
                document.getElementById('authStatutField').classList.add('d-none');
            }
        }

        try {
            let data;
            if (this.authorizationModalMode === 'edit') {
                data = await ApiClient.put(`authorizations/${this.editingAuthorizationId}`, body);
            } else {
                data = await ApiClient.post('authorizations', body);
            }
            Toast.show(data.message, 'success');
            this.authorizationModal.hide();
            await this.loadAuthorizations();
        } catch (e) {
            Toast.show(e.message, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    openAuthorizationDecision(id) {
        const auth = this.authorizations.find(a => a.id == id);
        if (!auth) return;
        const employee = this.employees.find(e => e.id == auth.user_id);

        this.decidingAuthorizationId = id;
        const days = this.getAuthorizationDuration(auth.date_debut, auth.date_fin);

        document.getElementById('authDecisionId').textContent = auth.id;
        document.getElementById('authDecisionEmployeeInfo').innerHTML = `
            <strong>${auth.employee_name}</strong><br>
            <small class="text-muted">${employee?.departement || ''}</small>
        `;
        document.getElementById('authDecisionInfo').innerHTML = `
            <div class="mb-1"><span class="badge type-badge">Autorisation d'absence</span></div>
            <small>
                <i class="bi bi-calendar3 me-1"></i>${formatDate(auth.date_debut)} → ${formatDate(auth.date_fin)}<br>
                <i class="bi bi-hourglass-split me-1"></i>${days} jour${days > 1 ? 's' : ''}<br>
                <i class="bi bi-geo-alt me-1"></i>${auth.lieu || '-'}
            </small>
            ${auth.motif ? `<br><small class="text-muted"><i class="bi bi-chat-left-text me-1"></i>${auth.motif}</small>` : ''}
            <div class="mt-2">${getStatusBadge(auth.statut)}</div>
            ${auth.commentaire_manager ? `<small class="text-muted"><strong>Commentaire :</strong> ${auth.commentaire_manager}</small>` : ''}
        `;

        document.getElementById('authDecisionComment').value = auth.commentaire_manager || '';

        const pending = auth.statut === 'En attente';
        document.getElementById('btnApproveAuthorization').classList.toggle('disabled', !pending);
        document.getElementById('btnRefuseAuthorization').classList.toggle('disabled', !pending);

        this.authorizationDecisionModal.show();
    }

    async decideAuthorization(statut) {
        const id = this.decidingAuthorizationId;
        if (!id) return;
        const comment = document.getElementById('authDecisionComment').value.trim();
        if (!comment) {
            Toast.show('Veuillez saisir un commentaire précisant le motif de votre décision.', 'error');
            return;
        }
        const body = { statut, commentaire_manager: comment };
        const btn = statut === 'Approuvé' ? document.getElementById('btnApproveAuthorization') : document.getElementById('btnRefuseAuthorization');

        try {
            const data = await ApiClient.put(`authorizations/${id}`, body);
            Toast.show(data.message, 'success');
            this.authorizationDecisionModal.hide();
            await this.loadAuthorizations();
        } catch (e) {
            Toast.show(e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    confirmDeleteAuthorization(id) {
        const auth = this.authorizations.find(a => a.id == id);
        if (!auth) return;
        document.getElementById('deleteModalMessage').innerHTML =
            `Êtes-vous sûr de vouloir supprimer l'autorisation <strong>#${id}</strong> de <strong>${auth.employee_name}</strong> ?<br>
            <small class="text-muted">Cette action est irréversible.</small>`;
        this.deleteConfirmCallback = async () => {
            try {
                const data = await ApiClient.delete(`authorizations/${id}`);
                Toast.show(data.message, 'success');
                await this.loadAuthorizations();
            } catch (e) {
                Toast.show(e.message, 'error');
            }
        };
        this.deleteModal.show();
    }

    /* ============ OVERVIEW ============ */

    renderOverview() {
        const tbody = document.getElementById('overviewLeavesBody');
        const recent = [...this.leaves].sort((a, b) => (b.date_soumission || '').localeCompare(a.date_soumission || '')).slice(0, 8);

        if (recent.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-calendar-x fs-1 d-block mb-2"></i>
                        Aucun congé enregistré.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = recent.map(leave => `
            <tr>
                <td><strong>#${leave.id}</strong></td>
                <td>
                    <strong>${leave.employee_name}</strong><br>
                    <small class="text-muted">${leave.departement || ''}</small>
                </td>
                <td><span class="badge type-badge">${getLeaveTypeLabel(leave.type_conge)}</span></td>
                <td>
                    <small>
                        ${formatDate(leave.date_debut)} → ${formatDate(leave.date_fin)}
                    </small>
                </td>
                <td>${getStatusBadge(leave.statut)}</td>
            </tr>`).join('');

        this.renderHistorique();
    }

    /* ============ HISTORIQUE ============ */

    initHistoriqueYearSelect() {
        const select = document.getElementById('historiqueYear');
        if (!select) return;
        const currentYear = new Date().getFullYear();
        select.innerHTML = '';
        for (let y = currentYear; y >= currentYear - 5; y--) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = y;
            select.appendChild(opt);
        }
    }

    renderHistorique() {
        const tbody = document.getElementById('historiqueTableBody');
        const search = (document.getElementById('searchHistorique')?.value || '').toLowerCase();
        const year = parseInt(document.getElementById('historiqueYear')?.value) || new Date().getFullYear();

        document.getElementById('historiqueDetail')?.classList.add('d-none');

        const approvedDaysByEmployee = {};
        this.leaves.forEach(l => {
            if (l.statut !== 'Approuvé') return;
            const startYear = new Date(l.date_debut).getFullYear();
            const endYear = new Date(l.date_fin).getFullYear();
            if (startYear === year || endYear === year) {
                const uid = l.user_id;
                if (!approvedDaysByEmployee[uid]) approvedDaysByEmployee[uid] = 0;
                approvedDaysByEmployee[uid] += this.getLeaveDuration(l.date_debut, l.date_fin);
            }
        });

        const filtered = this.employees.filter(e =>
            !search || (e.prenom + ' ' + e.nom + ' ' + (e.im || '') + ' ' + e.departement + ' ' + (e.fonction || '')).toLowerCase().includes(search)
        );

        document.getElementById('historiqueCount').textContent = filtered.length;

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-clock-history fs-1 d-block mb-2"></i>
                        Aucun employé trouvé.
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = filtered.map((e, i) => {
            const solde = parseInt(e.solde_conge) || 0;
            const daysUsed = approvedDaysByEmployee[e.id] || 0;
            const soldeRestant = solde;
            const soldeClass = soldeRestant < 0 ? 'text-danger fw-bold' : (soldeRestant <= 5 ? 'text-warning fw-bold' : 'text-success fw-bold');
            return `
                <tr class="historique-row" data-id="${e.id}" style="cursor:pointer">
                    <td>${i + 1}</td>
                    <td><strong>${e.prenom} ${e.nom}</strong></td>
                    <td><span class="badge dept-badge">${e.departement}</span></td>
                    <td><small>${e.fonction || '-'}</small></td>
                    <td>
                        <span class="${soldeClass}">${soldeRestant} jrs</span>
                        <small class="text-muted d-block">(reste | utilisés en ${year} : ${daysUsed} jrs)</small>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-primary btn-show-detail" data-id="${e.id}" title="Voir le registre">
                            <i class="bi bi-journal-text"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');

        tbody.querySelectorAll('.historique-row').forEach(row => {
            row.addEventListener('click', () => this.showHistoriqueDetail(row.dataset.id));
        });
    }

    showHistoriqueDetail(employeeId) {
        const employee = this.employees.find(e => e.id == employeeId);
        if (!employee) return;

        const year = parseInt(document.getElementById('historiqueYear')?.value) || new Date().getFullYear();
        const yearLeaves = this.leaves.filter(l => {
            if (l.user_id != employeeId) return false;
            const startYear = new Date(l.date_debut).getFullYear();
            const endYear = new Date(l.date_fin).getFullYear();
            return startYear === year || endYear === year;
        }).sort((a, b) => b.date_debut.localeCompare(a.date_debut));

        document.getElementById('historiqueDetailTitle').innerHTML = `
            <i class="bi bi-journal-text me-2"></i>Registre de congés — ${employee.prenom} ${employee.nom} (${year})
        `;

        const tbody = document.getElementById('historiqueDetailBody');
        const tfoot = document.getElementById('historiqueDetailFoot');

        if (yearLeaves.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-3 text-muted">
                        Aucun congé enregistré pour cette année.
                    </td>
                </tr>`;
            tfoot.innerHTML = '';
        } else {
            let totalDays = 0;
            tbody.innerHTML = yearLeaves.map((l, i) => {
                const days = this.getLeaveDuration(l.date_debut, l.date_fin);
                if (l.statut === 'Approuvé') totalDays += days;
                return `
                    <tr>
                        <td>${i + 1}</td>
                        <td><span class="badge type-badge">${getLeaveTypeLabel(l.type_conge)}</span></td>
                        <td>
                            <small>
                                <i class="bi bi-calendar3 me-1"></i>${formatDate(l.date_debut)}<br>
                                <i class="bi bi-calendar-check me-1"></i>${formatDate(l.date_fin)}
                            </small>
                        </td>
                        <td><span class="badge bg-secondary">${days} jrs</span></td>
                        <td><small>${l.lieu || '-'}</small></td>
                        <td><small>${l.motif || '-'}</small></td>
                        <td>${getStatusBadge(l.statut)}</td>
                    </tr>`;
            }).join('');
            tfoot.innerHTML = `
                <tr class="table-active">
                    <td colspan="3" class="text-end fw-bold">Total jours utilisés (Approuvés) :</td>
                    <td><span class="badge bg-primary">${totalDays} jrs</span></td>
                    <td colspan="3"></td>
                </tr>`;
        }

        const detail = document.getElementById('historiqueDetail');

        const yearAuths = this.authorizations.filter(a => {
            if (a.user_id != employeeId) return false;
            const startYear = new Date(a.date_debut).getFullYear();
            const endYear = new Date(a.date_fin).getFullYear();
            return startYear === year || endYear === year;
        }).sort((a, b) => b.date_debut.localeCompare(a.date_debut));

        document.getElementById('historiqueAuthTitle').innerHTML = `
            <i class="bi bi-person-check me-2"></i>Registre des autorisations d'absence — ${employee.prenom} ${employee.nom} (${year})
        `;

        const authBody = document.getElementById('historiqueAuthBody');
        const authFoot = document.getElementById('historiqueAuthFoot');

        if (yearAuths.length === 0) {
            authBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-3 text-muted">
                        Aucune autorisation d'absence enregistrée pour cette année.
                    </td>
                </tr>`;
            authFoot.innerHTML = '';
        } else {
            let totalAuthDays = 0;
            authBody.innerHTML = yearAuths.map((a, i) => {
                const days = this.getAuthorizationDuration(a.date_debut, a.date_fin);
                if (a.statut === 'Approuvé') totalAuthDays += days;
                return `
                    <tr>
                        <td>${i + 1}</td>
                        <td>
                            <small>
                                <i class="bi bi-calendar3 me-1"></i>${formatDate(a.date_debut)}<br>
                                <i class="bi bi-calendar-check me-1"></i>${formatDate(a.date_fin)}
                            </small>
                        </td>
                        <td><span class="badge bg-secondary">${days} jrs</span></td>
                        <td><small>${a.motif || '-'}</small></td>
                        <td><small><i class="bi bi-geo-alt me-1"></i>${a.lieu || '-'}</small></td>
                        <td>${getStatusBadge(a.statut)}</td>
                    </tr>`;
            }).join('');
            authFoot.innerHTML = `
                <tr class="table-active">
                    <td colspan="2" class="text-end fw-bold">Total jours utilisés (Approuvés) :</td>
                    <td><span class="badge bg-primary">${totalAuthDays} jrs</span></td>
                    <td colspan="3"></td>
                </tr>`;
        }

        detail.classList.remove('d-none');
        detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    openSettingsModal() {
        document.getElementById('settingsForm').reset();
        document.getElementById('settingsEmail').value = this.currentUser?.email || '';
        this.lastSettingsEmail = this.currentUser?.email || '';
        this.settingsModal.show();
    }

    async saveSettings() {
        const btn = document.getElementById('btnSaveSettings');
        const currentPassword = document.getElementById('settingsCurrentPassword').value;
        const email = document.getElementById('settingsEmail').value.trim();
        const newPassword = document.getElementById('settingsNewPassword').value;
        const confirmPassword = document.getElementById('settingsConfirmPassword').value;

        if (!email) {
            Toast.show('L\'email est requis.', 'error');
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            Toast.show('Format d\'email invalide.', 'error');
            return;
        }
        if (newPassword && newPassword !== confirmPassword) {
            Toast.show('Les mots de passe ne correspondent pas.', 'error');
            return;
        }

        const body = { current_password: currentPassword, email };
        if (newPassword) body.password = newPassword;

        setButtonLoading(btn, true);
        try {
            const data = await ApiClient.put('auth/account', body);
            this.currentUser = data.user;
            this.updateUserInfo();
            this.settingsModal.hide();
            Toast.show(data.message, 'success');
            if (data.user.email !== this.lastSettingsEmail) {
                setTimeout(() => { window.location.href = 'index.html'; }, 1200);
            }
        } catch (e) {
            Toast.show(e.message, 'error');
        } finally {
            setButtonLoading(btn, false);
        }
    }

    async logout() {
        try {
            await ApiClient.post('auth/logout');
        } catch {}
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new Dashboard();
    dashboard.init();
});