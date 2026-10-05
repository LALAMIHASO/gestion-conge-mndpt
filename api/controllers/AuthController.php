<?php

require_once __DIR__ . '/../models/User.php';
require_once __DIR__ . '/../middleware/AuthMiddleware.php';

class AuthController {
    private $userModel;

    public function __construct() {
        $this->userModel = new User();
    }

    public function login() {
        $input = json_decode(file_get_contents('php://input'), true);

        if (empty($input['email']) || empty($input['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email et mot de passe requis.']);
            return;
        }

        $user = $this->userModel->authenticate($input['email'], $input['password']);

        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Identifiants incorrects.']);
            return;
        }

        $allowedRoles = ['directeur', 'chef_srdc', 'chef_technique'];
        if (!in_array($user['role'], $allowedRoles, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'Accès non autorisé.']);
            return;
        }

        $_SESSION['user'] = $user;

        echo json_encode([
            'message' => 'Connexion réussie.',
            'user' => $user
        ]);
    }

    public function logout() {
        session_destroy();
        echo json_encode(['message' => 'Déconnexion réussie.']);
    }

    public function me() {
        $user = AuthMiddleware::requireAppUser();
        echo json_encode(['user' => $user]);
    }

    public function updateAccount() {
        $user = AuthMiddleware::requireAppUser();
        $input = json_decode(file_get_contents('php://input'), true);

        $currentUser = $this->userModel->findById($user['id']);
        if (!$currentUser) {
            http_response_code(404);
            echo json_encode(['error' => 'Compte introuvable.']);
            return;
        }

        if (empty($input['current_password']) || $input['current_password'] !== $currentUser['password']) {
            http_response_code(400);
            echo json_encode(['error' => 'Mot de passe actuel incorrect.']);
            return;
        }

        $update = [];

        if (isset($input['email']) && trim($input['email']) !== '' && trim($input['email']) !== $currentUser['email']) {
            $email = trim($input['email']);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                http_response_code(400);
                echo json_encode(['error' => 'Adresse email invalide.']);
                return;
            }
            $duplicate = $this->userModel->findByEmail($email);
            if ($duplicate && $duplicate['id'] != $currentUser['id']) {
                http_response_code(409);
                echo json_encode(['error' => 'Cette adresse email est déjà utilisée par un autre compte.']);
                return;
            }
            $update['email'] = $email;
        }

        if (isset($input['password']) && $input['password'] !== '') {
            $update['password'] = $input['password'];
        }

        if (empty($update)) {
            http_response_code(400);
            echo json_encode(['error' => 'Aucune modification demandée.']);
            return;
        }

        $updated = $this->userModel->update($currentUser['id'], $update);
        unset($updated['password']);
        $_SESSION['user'] = $updated;

        echo json_encode([
            'message' => 'Compte mis à jour avec succès.',
            'user' => $updated
        ]);
    }
}
