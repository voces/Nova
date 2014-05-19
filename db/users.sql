CREATE TABLE `users` (
	`id` INT(11) UNSIGNED NOT NULL AUTO_INCREMENT,
	`name` VARCHAR(15) NOT NULL COLLATE 'utf8_unicode_ci',
	`password` VARCHAR(60) NOT NULL COLLATE 'utf8_unicode_ci',
	`email` VARCHAR(63) NULL DEFAULT NULL COLLATE 'utf8_unicode_ci',
	`avatar` VARCHAR(255) NULL DEFAULT NULL COLLATE 'utf8_unicode_ci',
	`lastlogged` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY (`id`),
	UNIQUE INDEX `name` (`name`)
)