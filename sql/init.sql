CREATE DATABASE IF NOT EXISTS `vno` 
DEFAULT CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `vno`;


CREATE TABLE IF NOT EXISTS `cities` (
  `id` int NOT NULL AUTO_INCREMENT,
  `code` varchar(10) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `system_groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `city_id` int NOT NULL,
  `group_name` varchar(255) NOT NULL,
  `description` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_city_group` (`city_id`,`group_name`),
  KEY `city_id` (`city_id`),
  CONSTRAINT `system_groups_ibfk_1` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `qrcodes` (
  `qr_id` int NOT NULL AUTO_INCREMENT,
  `qr_code` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qr_image` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `city_id` int DEFAULT NULL,
  `system_group_id` int DEFAULT NULL,
  PRIMARY KEY (`qr_id`),
  UNIQUE KEY `qr_code` (`qr_code`),
  KEY `city_id` (`city_id`),
  KEY `system_group_id` (`system_group_id`),
  CONSTRAINT `qrcodes_ibfk_1` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`),
  CONSTRAINT `qrcodes_ibfk_2` FOREIGN KEY (`system_group_id`) REFERENCES `system_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `devices` (
  `id` int NOT NULL AUTO_INCREMENT,
  `device_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `qr_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `city_id` int NOT NULL,
  `system_group_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `device_name` (`device_name`),
  KEY `qr_id` (`qr_id`),
  KEY `city_id` (`city_id`),
  KEY `idx_devices_group` (`system_group_id`),
  CONSTRAINT `devices_ibfk_1` FOREIGN KEY (`qr_id`) REFERENCES `qrcodes` (`qr_id`) ON DELETE SET NULL,
  CONSTRAINT `devices_ibfk_2` FOREIGN KEY (`city_id`) REFERENCES `cities` (`id`),
  CONSTRAINT `devices_ibfk_3` FOREIGN KEY (`system_group_id`) REFERENCES `system_groups` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `first_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `last_name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `pin_code` char(4) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_pin_code` (`pin_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `admins` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('user','admin','superadmin') NOT NULL DEFAULT 'user',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `scans` (
  `scan_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `scan_timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  `is_scanned` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`scan_id`),
  KEY `device_id` (`device_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `scans_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scans_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `device_rules` (
  `rule_id` int NOT NULL AUTO_INCREMENT,
  `device_id` int NOT NULL,
  `recurrence_type` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'weekly',
  `daily_interval` int DEFAULT '1',
  `weekly_days` text COLLATE utf8mb4_unicode_ci,
  `monthly_day` int DEFAULT NULL,
  `yearly_date` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `start_date` date NOT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`rule_id`),
  KEY `device_id` (`device_id`),
  CONSTRAINT `device_rules_ibfk_1` FOREIGN KEY (`device_id`) REFERENCES `devices` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `admins` (`username`, `email`, `password_hash`, `role`) VALUES
('itgedimai', 'itgedimai@ltou.lt', '$2b$10$dgdj0K6Tm89UUheNmHY3yus9bbD0LM4ekjIGBMXEDuU5CeAl75CAi', 'superadmin');

INSERT IGNORE INTO cities (code, name) VALUES
('VNO', 'Vilnius'),
('KUN', 'Kaunas'),
('PLQ', 'Palanga');
