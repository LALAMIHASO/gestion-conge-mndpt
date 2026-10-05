-- =========================================================
--  Migration : rôles des utilisateurs
--  Application de gestion des congés (MNDPT)
--  À exécuter sur une base existante (mndpt_conges)
-- =========================================================

USE mndpt_conges;

-- 1) Étendre l'ENUM des rôles
ALTER TABLE users
    MODIFY role ENUM('employe','directeur','chef_srdc','chef_technique')
    NOT NULL DEFAULT 'employe';

-- 2) Réaffecter les rôles existants (à adapter à vos comptes si besoin)
UPDATE users SET role = 'directeur'      WHERE role = 'manager'  OR email = 'nomena.rajoelina@poste.mg' OR email = 'andrianaivolovatiana@gmail.com';
UPDATE users SET role = 'chef_technique' WHERE email = 'marie.rakoto@poste.mg';
UPDATE users SET role = 'chef_srdc'      WHERE email = 'lanto@gmail.com';

-- 3) Département / fonction du chef de service technique
UPDATE users
SET departement = 'Service Technique',
    fonction    = 'Chef de service technique'
WHERE email = 'marie.rakoto@poste.mg';

-- 4) Mot de passe du compte SRDC (facultatif)
UPDATE users SET password = 'lanto2026' WHERE email = 'lanto@gmail.com';