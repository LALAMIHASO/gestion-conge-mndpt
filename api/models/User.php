<?php

require_once __DIR__ . '/../config/database.php';

class User {
    private $db;

    private $columns = ['nom', 'prenom', 'im', 'email', 'password', 'role', 'departement', 'fonction', 'date_embauche', 'solde_conge'];

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function findAll() {
        return $this->db->query('SELECT * FROM users ORDER BY id')->fetchAll();
    }

    public function findById($id) {
        $stmt = $this->db->query('SELECT * FROM users WHERE id = ?', [$id]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function findByEmail($email) {
        $stmt = $this->db->query('SELECT * FROM users WHERE email = ?', [$email]);
        $user = $stmt->fetch();
        return $user ?: null;
    }

    public function authenticate($email, $password) {
        $user = $this->findByEmail($email);
        if ($user && $user['password'] === $password) {
            unset($user['password']);
            return $user;
        }
        return null;
    }

    public function create($data) {
        $values = array_merge([
            'im' => null,
            'fonction' => '',
            'date_embauche' => null,
            'solde_conge' => 30
        ], $data);

        $this->db->query(
            'INSERT INTO users (nom, prenom, im, email, password, role, departement, fonction, date_embauche, solde_conge)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $values['nom'],
                $values['prenom'],
                $values['im'] ?? null,
                $values['email'],
                $values['password'],
                $values['role'] ?? 'employe',
                $values['departement'],
                $values['fonction'],
                $values['date_embauche'],
                (int)$values['solde_conge']
            ]
        );

        return $this->findById($this->db->lastInsertId());
    }

    public function update($id, $data) {
        $allowed = array_intersect_key($data, array_flip($this->columns));
        if (empty($allowed)) {
            return $this->findById($id);
        }

        $sets = [];
        $params = [];
        foreach ($allowed as $column => $value) {
            $sets[] = "$column = ?";
            $params[] = $value;
        }
        $params[] = $id;

        $this->db->query('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);

        return $this->findById($id);
    }

    public function delete($id) {
        $this->db->query('DELETE FROM users WHERE id = ?', [$id]);
        return true;
    }
}