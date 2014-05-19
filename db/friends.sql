CREATE TABLE `friends` (
	`origin` INT(11) UNSIGNED NOT NULL,
	`target` INT(11) UNSIGNED NOT NULL,
	UNIQUE INDEX `origin` (`origin`, `target`)
)