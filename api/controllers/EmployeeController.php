<?php

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class EmployeeController {
    private $userModel;

    public function __construct() {
        $this->userModel = new User();
    }

    public function index() {
        AuthMiddleware::requireAnyRole(['directeur', 'chef_srdc', 'chef_technique']);
        $employees = array_values(array_filter(
            $this->userModel->findAll(),
            function ($u) { return $u['role'] === 'employe'; }
        ));
        foreach ($employees as &$emp) {
            unset($emp['password']);
        }
        echo json_encode($employees);
    }

    public function store() {
        AuthMiddleware::requireStaff();
        $input = json_decode(file_get_contents('php://input'), true);

        $this->validateInput($input, true);

        $existing = $this->userModel->findByEmail($input['email']);
        if ($existing) {
            http_response_code(409);
            echo json_encode(['error' => 'Cette adresse email est déjà utilisée, l\'employé n\'a pas été enregistré.']);
            return;
        }

        $duplicate = $this->findDuplicateNomPrenom($input['nom'], $input['prenom']);
        if ($duplicate) {
            http_response_code(409);
            echo json_encode(['error' => 'Un employé portant déjà le nom et prénom « ' . $duplicate['prenom'] . ' ' . $duplicate['nom'] . ' » existe, l\'employé n\'a pas été enregistré.']);
            return;
        }

        $employee = $this->userModel->create([
            'nom' => trim($input['nom']),
            'prenom' => trim($input['prenom']),
            'im' => trim($input['im']),
            'email' => trim($input['email']),
            'password' => bin2hex(random_bytes(8)),
            'role' => 'employe',
            'departement' => $input['departement'],
            'fonction' => trim($input['fonction']),
            'date_embauche' => $input['date_embauche'],
            'solde_conge' => 30
        ]);

        unset($employee['password']);

        http_response_code(201);
        echo json_encode([
            'message' => 'Employé créé avec succès.',
            'employee' => $employee
        ]);
    }

    public function update($id) {
        AuthMiddleware::requireAnyRole(['chef_srdc', 'chef_technique']);
        $input = json_decode(file_get_contents('php://input'), true);

        $existing = $this->userModel->findById($id);
        if (!$existing || $existing['role'] !== 'employe') {
            http_response_code(404);
            echo json_encode(['error' => 'Employé non trouvé.']);
            return;
        }

        $allowed = ['nom', 'prenom', 'im', 'email', 'departement', 'fonction', 'date_embauche'];
        $update = [];
        foreach ($allowed as $field) {
            if (isset($input[$field]) && $input[$field] !== '') {
                $update[$field] = trim($input[$field]);
            }
        }

        if (isset($update['nom']) || isset($update['prenom'])) {
            $nom = $update['nom'] ?? $existing['nom'];
            $prenom = $update['prenom'] ?? $existing['prenom'];
            $duplicate = $this->findDuplicateNomPrenom($nom, $prenom, $id);
            if ($duplicate) {
                http_response_code(409);
                echo json_encode(['error' => 'Un employé portant déjà le nom et prénom « ' . $duplicate['prenom'] . ' ' . $duplicate['nom'] . ' » existe.']);
                return;
            }
        }

        $departement = $update['departement'] ?? $existing['departement'];
        $fonction = $update['fonction'] ?? $existing['fonction'] ?? '';
        $departements = $this->getDepartements();
        if (!isset($departements[$departement])) {
            http_response_code(400);
            echo json_encode(['error' => 'Département invalide.']);
            return;
        }
        if ($fonction !== '' && !in_array($fonction, $departements[$departement], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Fonction invalide pour ce département.']);
            return;
        }

        if (isset($update['email'])) {
            if (!filter_var($update['email'], FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => 'Adresse email invalide.']);
                return;
            }
            $duplicate = $this->userModel->findByEmail($update['email']);
            if ($duplicate && $duplicate['id'] != $id) {
                http_response_code(409);
                echo json_encode(['error' => 'Cette adresse email est déjà utilisée par un autre employé.']);
                return;
            }
        }

        if (isset($update['im']) && !preg_match('/^\d{6}$/', $update['im'])) {
            http_response_code(400);
            echo json_encode(['error' => 'L\'IM (matricule) doit être un nombre de 6 chiffres.']);
            return;
        }

        if (isset($update['date_embauche']) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $update['date_embauche'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Format de date d\'embauche invalide.']);
            return;
        }

        $updated = $this->userModel->update($id, $update);
        unset($updated['password']);

        echo json_encode([
            'message' => 'Employé mis à jour.',
            'employee' => $updated
        ]);
    }

    public function destroy($id) {
        AuthMiddleware::requireAdmin();
        $existing = $this->userModel->findById($id);
        if (!$existing || $existing['role'] !== 'employe') {
            http_response_code(404);
            echo json_encode(['error' => 'Employé non trouvé.']);
            return;
        }

        $this->userModel->delete($id);
        echo json_encode(['message' => 'Employé supprimé.']);
    }

    private function validateInput($input, $isCreate) {
        $required = ['nom', 'prenom', 'im', 'email', 'departement', 'fonction', 'date_embauche'];
        foreach ($required as $field) {
            if (!isset($input[$field]) || trim($input[$field]) === '') {
                http_response_code(400);
                echo json_encode(['error' => 'Le champ "' . $field . '" est requis.']);
                exit;
            }
        }

        $departements = $this->getDepartements();

        if (!isset($departements[$input['departement']])) {
            http_response_code(400);
            echo json_encode(['error' => 'Département invalide.']);
            exit;
        }

        if (!in_array($input['fonction'], $departements[$input['departement']], true)) {
            http_response_code(400);
            echo json_encode(['error' => 'Fonction invalide pour ce département.']);
            exit;
        }

        if (!filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
            http_response_code(400);
            echo json_encode(['error' => 'Adresse email invalide.']);
            exit;
        }

        if (!preg_match('/^\d{6}$/', trim($input['im']))) {
            http_response_code(400);
            echo json_encode(['error' => 'L\'IM (matricule) doit être un nombre de 6 chiffres.']);
            exit;
        }

        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $input['date_embauche'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Format de date d\'embauche invalide.']);
            exit;
        }
    }

    private function getDepartements() {
        return [
            'Direction' => ['PRMP', 'Assistant PRMP'],
            'Service Technique' => ['Chef de service technique', 'Responsable vulgarisation', 'Suivi-Animation-Formation'],
            'SRDC' => ['Chef de service SRDC - Comptable - Ordonateur suppléant', 'Aide comptable - Responsable personnel', 'Bureau secrétariat'],
            'Service Bureau Regional' => ['Chef de service bureau régional', 'Responsable patrimoine', 'Dépositaire comptable', 'Assistant dépositaire comptable - Magasinier'],
            'Technicien de Surface' => ['Balayeur', 'Sécurité', 'Chauffeur']
        ];
    }

    private function findDuplicateNomPrenom($nom, $prenom, $excludeId = null) {
        $users = $this->userModel->findAll();
        $nom = mb_strtolower(trim($nom));
        $prenom = mb_strtolower(trim($prenom));
        foreach ($users as $user) {
            if ($excludeId && $user['id'] == $excludeId) {
                continue;
            }
            if (mb_strtolower(trim($user['nom'])) === $nom && mb_strtolower(trim($user['prenom'])) === $prenom) {
                return $user;
            }
        }
        return null;
    }
}
