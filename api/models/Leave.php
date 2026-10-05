<?php

require_once __DIR__ . '/../config/database.php';

class Leave {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function findAll() {
        return $this->db->query('SELECT * FROM leaves ORDER BY date_debut DESC')->fetchAll();
    }

    public function findById($id) {
        $stmt = $this->db->query('SELECT * FROM leaves WHERE id = ?', [$id]);
        $leave = $stmt->fetch();
        return $leave ?: null;
    }

    public function findByUserId($userId) {
        return $this->db->query('SELECT * FROM leaves WHERE user_id = ? ORDER BY date_debut DESC', [$userId])->fetchAll();
    }

    public function create($data) {
        $this->db->query(
            'INSERT INTO leaves (user_id, type_conge, date_debut, date_fin, lieu, motif, date_soumission, statut, commentaire_manager)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (int)$data['user_id'],
                $data['type_conge'],
                $data['date_debut'],
                $data['date_fin'],
                $data['lieu'] ?? '',
                $data['motif'] ?? '',
                date('Y-m-d'),
                'En attente',
                ''
            ]
        );

        return $this->findById($this->db->lastInsertId());
    }

    public function update($id, $data) {
        $allowed = ['user_id', 'type_conge', 'date_debut', 'date_fin', 'lieu', 'motif', 'statut', 'commentaire_manager'];
        $updates = array_intersect_key($data, array_flip($allowed));
        if (empty($updates)) {
            return $this->findById($id);
        }

        $sets = [];
        $params = [];
        foreach ($updates as $column => $value) {
            $sets[] = "$column = ?";
            $params[] = $value;
        }
        $params[] = $id;

        $this->db->query('UPDATE leaves SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);

        return $this->findById($id);
    }

    public function delete($id) {
        $this->db->query('DELETE FROM leaves WHERE id = ?', [$id]);
        return true;
    }

    public function getStats($userId = null) {
        $where = '';
        $params = [];
        if ($userId) {
            $where = ' WHERE user_id = ?';
            $params[] = $userId;
        }

        $stmt = $this->db->query(
            'SELECT
                COUNT(*) AS total,
                COALESCE(SUM(statut = "En attente"), 0) AS en_attente,
                COALESCE(SUM(statut = "Approuvé"), 0) AS approuve,
                COALESCE(SUM(statut = "Non approuvé"), 0) AS non_approuve
             FROM leaves' . $where,
            $params
        );

        $row = $stmt->fetch();
        return [
            'total' => (int)$row['total'],
            'en_attente' => (int)$row['en_attente'],
            'approuve' => (int)$row['approuve'],
            'non_approuve' => (int)$row['non_approuve']
        ];
    }
}