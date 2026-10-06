<?php

require_once __DIR__ . '/../models/Leave.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class LeaveController {
    private $leaveModel;
    private $userModel;

    public function __construct() {
        $this->leaveModel = new Leave();
        $this->userModel = new User();
    }

    public function index() {
        AuthMiddleware::requireStaff();
        $leaves = $this->leaveModel->findAll();

        $leaves = array_map(function ($leave) {
            $employee = $this->userModel->findById($leave['user_id']);
            $leave['employee_name'] = $employee
                ? $employee['prenom'] . ' ' . $employee['nom']
                : 'Employé supprimé';
            $leave['departement'] = $employee['departement'] ?? '';
            $leave['fonction'] = $employee['fonction'] ?? '';
            return $leave;
        }, $leaves);

        usort($leaves, function ($a, $b) {
            return strcmp($b['date_debut'], $a['date_debut']);
        });

        echo json_encode(array_values($leaves));
    }

    public function store() {
        AuthMiddleware::requireStaff();
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['user_id']) || empty($input['type_conge']) || empty($input['date_debut']) || empty($input['date_fin']) || empty($input['lieu'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Tous les champs sont requis.']);
            return;
        }

        $employee = $this->userModel->findById($input['user_id']);
        if (!$employee || $employee['role'] !== 'employe') {
            http_response_code(404);
            echo json_encode(['error' => 'Employé non trouvé.']);
            return;
        }

        if ($input['date_debut'] > $input['date_fin']) {
            http_response_code(400);
            echo json_encode(['error' => 'La date de fin doit être après la date de début.']);
            return;
        }

        $conflict = $this->findOverlappingLeave((int)$input['user_id'], $input['date_debut'], $input['date_fin']);
        if ($conflict) {
            http_response_code(409);
            echo json_encode(['error' => 'Vous avez déjà un congé du ' . $this->formatDateFR($conflict['date_debut']) . ' jusqu\'au ' . $this->formatDateFR($conflict['date_fin']) . '.']);
            return;
        }

        $leave = [
            'user_id' => (int)$input['user_id'],
            'type_conge' => $input['type_conge'],
            'date_debut' => $input['date_debut'],
            'date_fin' => $input['date_fin'],
            'lieu' => $input['lieu'],
            'motif' => $input['motif'] ?? ''
        ];

        $created = $this->leaveModel->create($leave);

        http_response_code(201);
        echo json_encode([
            'message' => 'Congé enregistré avec succès.',
            'leave' => $created
        ]);
    }

    public function update($id) {
        $user = AuthMiddleware::requireStaff();
        $input = json_decode(file_get_contents('php://input'), true);

        $leave = $this->leaveModel->findById($id);
        if (!$leave) {
            http_response_code(404);
            echo json_encode(['error' => 'Congé non trouvé.']);
            return;
        }

        if ($user['role'] !== 'directeur' && (isset($input['statut']) || isset($input['commentaire_manager']))) {
            http_response_code(403);
            echo json_encode(['error' => 'Seul le directeur peut valider ou refuser les congés.']);
            return;
        }

        if (isset($input['statut']) && !in_array($input['statut'], ['En attente', 'Approuvé', 'Non approuvé'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Statut invalide.']);
            return;
        }

        $allowed = ['user_id', 'type_conge', 'date_debut', 'date_fin', 'lieu', 'motif', 'statut', 'commentaire_manager'];
        $update = [];
        foreach ($allowed as $field) {
            if (isset($input[$field]) && $input[$field] !== '') {
                $update[$field] = ($field === 'user_id') ? (int)$input[$field] : $input[$field];
            }
        }

        if (isset($input['commentaire_manager'])) {
            $update['commentaire_manager'] = trim($input['commentaire_manager']);
        }

        if (isset($update['date_debut'], $update['date_fin']) && $update['date_debut'] > $update['date_fin']) {
            http_response_code(400);
            echo json_encode(['error' => 'La date de fin doit être après la date de début.']);
            return;
        }

        $newUserId = (int)($update['user_id'] ?? $leave['user_id']);
        $newDebut = $update['date_debut'] ?? $leave['date_debut'];
        $newFin = $update['date_fin'] ?? $leave['date_fin'];
        $conflict = $this->findOverlappingLeave($newUserId, $newDebut, $newFin, $id);
        if ($conflict) {
            http_response_code(409);
            echo json_encode(['error' => 'Vous avez déjà un congé du ' . $this->formatDateFR($conflict['date_debut']) . ' jusqu\'au ' . $this->formatDateFR($conflict['date_fin']) . '.']);
            return;
        }

        $this->adjustSolde($leave, $update);

        $updated = $this->leaveModel->update($id, $update);

        echo json_encode([
            'message' => 'Congé mis à jour.',
            'leave' => $updated
        ]);
    }

    public function destroy($id) {
        AuthMiddleware::requireAdmin();
        $leave = $this->leaveModel->findById($id);
        if (!$leave) {
            http_response_code(404);
            echo json_encode(['error' => 'Congé non trouvé.']);
            return;
        }

        $this->leaveModel->delete($id);
        echo json_encode(['message' => 'Congé supprimé.']);
    }

    public function stats() {
        AuthMiddleware::requireStaff();
        $stats = $this->leaveModel->getStats();
        $stats['employes'] = count(array_filter(
            $this->userModel->findAll(),
            function ($u) { return $u['role'] === 'employe'; }
        ));
        echo json_encode($stats);
    }

    private function countDays($debut, $fin) {
        $d1 = new DateTime($debut);
        $d2 = new DateTime($fin);
        return (int)$d1->diff($d2)->days + 1;
    }

    private function adjustSolde($leave, $update) {
        $oldStatut = $leave['statut'];
        $newStatut = $update['statut'] ?? $oldStatut;

        $oldApproved = $oldStatut === 'Approuvé';
        $newApproved = $newStatut === 'Approuvé';

        if (!$oldApproved && !$newApproved) {
            return;
        }

        $oldDebut = $leave['date_debut'];
        $oldFin = $leave['date_fin'];
        $newDebut = $update['date_debut'] ?? $oldDebut;
        $newFin = $update['date_fin'] ?? $oldFin;

        $oldDays = $this->countDays($oldDebut, $oldFin);
        $newDays = $this->countDays($newDebut, $newFin);

        if ($oldApproved && $newApproved) {
            $delta = $newDays - $oldDays;
        } elseif ($oldApproved && !$newApproved) {
            $delta = -$oldDays;
        } else {
            $delta = $newDays;
        }

        if ($delta === 0) {
            return;
        }

        $employee = $this->userModel->findById($leave['user_id']);
        if (!$employee) {
            return;
        }

        $newSolde = (int)$employee['solde_conge'] - $delta;
        $this->userModel->update($employee['id'], ['solde_conge' => $newSolde]);
    }

    private function findOverlappingLeave($userId, $dateDebut, $dateFin, $excludeId = null) {
        $leaves = $this->leaveModel->findAll();
        foreach ($leaves as $leave) {
            if ($leave['user_id'] != $userId) continue;
            if ($excludeId && $leave['id'] == $excludeId) continue;
            if (isset($leave['statut']) && $leave['statut'] === 'Non approuvé') continue;
            if ($dateDebut <= $leave['date_fin'] && $dateFin >= $leave['date_debut']) {
                return $leave;
            }
        }
        return null;
    }

    private function formatDateFR($date) {
        return date('d/m/Y', strtotime($date));
    }
}
