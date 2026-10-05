-- =========================================================
--  Base de données : mndpt_conges
--  Application de gestion des congés (MNDPT)
--  MariaDB / MySQL
-- =========================================================

CREATE DATABASE IF NOT EXISTS mndpt_conges
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE mndpt_conges;

-- ---------------------------------------------------------
-- Table : users (employés + comptes direction)
-- ---------------------------------------------------------
DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    im CHAR(6) DEFAULT NULL,
    email VARCHAR(150) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('employe','directeur','chef_srdc','chef_technique') NOT NULL DEFAULT 'employe',
    departement VARCHAR(100) NOT NULL,
    fonction VARCHAR(150) NOT NULL DEFAULT '',
    date_embauche DATE DEFAULT NULL,
    solde_conge INT NOT NULL DEFAULT 30,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
-- Table : leaves (demandes de congé)
-- ---------------------------------------------------------
DROP TABLE IF EXISTS leaves;
CREATE TABLE leaves (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    type_conge VARCHAR(50) NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    lieu VARCHAR(150) NOT NULL DEFAULT '',
    motif VARCHAR(255) NOT NULL DEFAULT '',
    date_soumission DATE NOT NULL,
    statut ENUM('En attente','Approuvé','Non approuvé') NOT NULL DEFAULT 'En attente',
    commentaire_manager TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_leaves_user (user_id),
    KEY idx_leaves_date_debut (date_debut),
    CONSTRAINT fk_leaves_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
-- Table : authorizations (autorisations d'absence)
-- ---------------------------------------------------------
DROP TABLE IF EXISTS authorizations;
CREATE TABLE authorizations (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id INT UNSIGNED NOT NULL,
    date_debut DATE NOT NULL,
    date_fin DATE NOT NULL,
    lieu VARCHAR(150) NOT NULL DEFAULT '',
    motif VARCHAR(255) NOT NULL DEFAULT '',
    date_soumission DATE NOT NULL,
    statut ENUM('En attente','Approuvé','Non approuvé') NOT NULL DEFAULT 'En attente',
    commentaire_manager TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_authorizations_user (user_id),
    CONSTRAINT fk_authorizations_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------
-- Données initiales (comptes de direction)
-- ---------------------------------------------------------
INSERT INTO users (nom, prenom, im, email, password, role, departement, fonction, date_embauche, solde_conge) VALUES
('Rajoelina', 'Nomena', NULL, 'nomena.rajoelina@poste.mg', 'directeur2026', 'directeur', 'Direction', 'PRMP', '2015-02-01', 30),
('Andrianaivolovatiana', 'Directeur', NULL, 'andrianaivolovatiana@gmail.com', 'korotika', 'directeur', 'Direction', 'Assistant PRMP', '2015-02-01', 30),
('Rakoto', 'Marie', NULL, 'marie.rakoto@poste.mg', 'password123', 'chef_technique', 'Service Technique', 'Chef de service technique', '2018-06-01', 20),
('RAKOTOMANGA', 'Lanto', '223332', 'lanto@gmail.com', 'lanto2026', 'chef_srdc', 'SRDC', 'Chef de service SRDC - Comptable - Ordonateur suppléant', '2026-09-03', 25);