<?php

class AuthMiddleware {
    private static $allowedRoles = ['directeur', 'chef_srdc', 'chef_technique'];

    public static function verify() {
        if (!isset($_SESSION['user'])) {
            http_response_code(401);
            echo json_encode(['error' => 'Non autorisé. Veuillez vous connecter.']);
            exit;
        }
        return $_SESSION['user'];
    }

    public static function requireRole($role) {
        $user = self::verify();
        if ($user['role'] !== $role) {
            http_response_code(403);
            echo json_encode(['error' => 'Accès non autorisé pour votre rôle.']);
            exit;
        }
        return $user;
    }

    public static function requireAnyRole(array $roles) {
        $user = self::verify();
        if (!in_array($user['role'], $roles, true)) {
            http_response_code(403);
            echo json_encode(['error' => 'Accès non autorisé pour votre rôle.']);
            exit;
        }
        return $user;
    }

    public static function requireDirector() {
        return self::requireRole('directeur');
    }

    public static function requireChefSRDC() {
        return self::requireRole('chef_srdc');
    }

    public static function requireChefTechnique() {
        return self::requireRole('chef_technique');
    }

    public static function requireStaff() {
        return self::requireAnyRole(['directeur', 'chef_srdc', 'chef_technique']);
    }

    public static function requireAdmin() {
        return self::requireAnyRole(['chef_srdc', 'chef_technique']);
    }

    public static function requireAppUser() {
        return self::requireAnyRole(self::$allowedRoles);
    }

    public static function getUser() {
        return $_SESSION['user'] ?? null;
    }
}
