<?php

require_once __DIR__ . '/../config/database.php';

class Authorization {
    private $db;

    public function __construct() {
        $this->db = Database::getInstance();
    }

    public function findAll() {
        return $this->db->query('SELECT * FROM authorizations ORDER BY date_debut DESC')->fetchAll();
    }

    public function findById($id) {
        $stmt = $this->db->query('SELECT * FROM authorizations WHERE id = ?', [$id]);
        $authorization = $stmt->fetch();
        return $authorization ?: null;
    }

    public function findByUserId($userId) {
        return $this->db->query('SELECT * FROM authorizations WHERE user_id = ? ORDER BY date_debut DESC', [$userId])->fetchAll();
    }

    public function create($data) {
        $this->db->query(
            'INSERT INTO authorizations (user_id, date_debut, date_fin, lieu, motif, date_soumission, statut, commentaire_manager)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                (int)$data['user_id'],
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
        $allowed = ['user_id', 'date_debut', 'date_fin', 'lieu', 'motif', 'statut', 'commentaire_manager'];
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

        $this->db->query('UPDATE authorizations SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);

        return $this->findById($id);
    }

    public function delete($id) {
        $this->db->query('DELETE FROM authorizations WHERE id = ?', [$id]);
        return true;
    }

    public function countDaysPerMonth($debut, $fin) {
        $result = [];
        $d1 = new DateTime($debut);
        $d2 = new DateTime($fin);
        if ($d1 > $d2) {
            return $result;
        }
        $cur = clone $d1;
        while ($cur <= $d2) {
            $key = $cur->format('Y-m');
            if (!isset($result[$key])) {
                $result[$key] = 0;
            }
            $result[$key]++;
            $cur->modify('+1 day');
        }
        return $result;
    }
}