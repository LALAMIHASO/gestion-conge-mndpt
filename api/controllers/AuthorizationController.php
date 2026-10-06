<?php

require_once __DIR__ . '/../models/Authorization.php';
require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class AuthorizationController {
    private $authorizationModel;
    private $userModel;
    private $maxDaysPerMonth = 2;

    public function __construct() {
        $this->authorizationModel = new Authorization();
        $this->userModel = new User();
    }

    public function index() {
        AuthMiddleware::requireStaff();
        $authorizations = $this->authorizationModel->findAll();

        $authorizations = array_map(function ($a) {
            $employee = $this->userModel->findById($a['user_id']);
            $a['employee_name'] = $employee
                ? $employee['prenom'] . ' ' . $employee['nom']
                : 'Employé supprimé';
            $a['departement'] = $employee['departement'] ?? '';
            $a['fonction'] = $employee['fonction'] ?? '';
            return $a;
        }, $authorizations);

        usort($authorizations, function ($a, $b) {
            return strcmp($b['date_debut'], $a['date_debut']);
        });

        echo json_encode(array_values($authorizations));
    }

    public function store() {
        AuthMiddleware::requireStaff();
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['user_id']) || empty($input['date_debut']) || empty($input['date_fin']) || empty($input['lieu'])) {
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

        $error = $this->checkMonthlyLimit($input, null);
        if ($error) {
            http_response_code(400);
            echo json_encode(['error' => $error]);
            return;
        }

        $authorization = [
            'user_id' => (int)$input['user_id'],
            'date_debut' => $input['date_debut'],
            'date_fin' => $input['date_fin'],
            'lieu' => $input['lieu'],
            'motif' => $input['motif'] ?? ''
        ];

        $created = $this->authorizationModel->create($authorization);

        http_response_code(201);
        echo json_encode([
            'message' => 'Autorisation d\'absence enregistrée avec succès.',
            'authorization' => $created
        ]);
    }

    public function update($id) {
        $user = AuthMiddleware::requireStaff();
        $input = json_decode(file_get_contents('php://input'), true);

        $authorization = $this->authorizationModel->findById($id);
        if (!$authorization) {
            http_response_code(404);
            echo json_encode(['error' => 'Autorisation non trouvée.']);
            return;
        }

        if ($user['role'] !== 'directeur' && (isset($input['statut']) || isset($input['commentaire_manager']))) {
            http_response_code(403);
            echo json_encode(['error' => 'Seul le directeur peut valider ou refuser les autorisations d\'absence.']);
            return;
        }

        if (isset($input['statut']) && !in_array($input['statut'], ['En attente', 'Approuvé', 'Non approuvé'], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Statut invalide.']);
            return;
        }

        $allowed = ['user_id', 'date_debut', 'date_fin', 'lieu', 'motif', 'statut', 'commentaire_manager'];
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

        if (isset($update['user_id'])) {
            $employee = $this->userModel->findById($update['user_id']);
            if (!$employee || $employee['role'] !== 'employe') {
                http_response_code(404);
                echo json_encode(['error' => 'Employé non trouvé.']);
                return;
            }

            $checkInput = [
                'user_id' => $update['user_id'],
                'date_debut' => $update['date_debut'] ?? $authorization['date_debut'],
                'date_fin' => $update['date_fin'] ?? $authorization['date_fin']
            ];

            $error = $this->checkMonthlyLimit($checkInput, $authorization['id']);
            if ($error) {
                http_response_code(400);
                echo json_encode(['error' => $error]);
                return;
            }
        }

        $updated = $this->authorizationModel->update($id, $update);

        echo json_encode([
            'message' => 'Autorisation mise à jour.',
            'authorization' => $updated
        ]);
    }

    public function destroy($id) {
        AuthMiddleware::requireAdmin();
        $authorization = $this->authorizationModel->findById($id);
        if (!$authorization) {
            http_response_code(404);
            echo json_encode(['error' => 'Autorisation non trouvée.']);
            return;
        }

        $this->authorizationModel->delete($id);
        echo json_encode(['message' => 'Autorisation supprimée.']);
    }

    private function checkMonthlyLimit($input, $excludeId) {
        $days = $this->authorizationModel->countDaysPerMonth($input['date_debut'], $input['date_fin']);

        $authorizations = $this->authorizationModel->findAll();
        $existingByMonth = [];
        foreach ($authorizations as $a) {
            if ($a['user_id'] != $input['user_id']) continue;
            if ($excludeId && $a['id'] == $excludeId) continue;
            if (isset($a['statut']) && $a['statut'] === 'Non approuvé') continue;
            $aDays = $this->authorizationModel->countDaysPerMonth($a['date_debut'], $a['date_fin']);
            foreach ($aDays as $month => $count) {
                $existingByMonth[$month] = ($existingByMonth[$month] ?? 0) + $count;
            }
        }

        foreach ($days as $month => $count) {
            $total = $count + ($existingByMonth[$month] ?? 0);
            if ($total > $this->maxDaysPerMonth) {
                $monthParts = explode('-', $month);
                $monthName = date('F Y', mktime(0, 0, 0, (int)$monthParts[1], 1, (int)$monthParts[0]));
                return 'Limite dépassée pour ' . $monthName . ' : ' . $total . ' jours (maximum ' . $this->maxDaysPerMonth . ' jours par mois pour chaque employé).';
            }
        }

        return null;
    }
}