<?php

class Database
{
    private static ?PDO $pdo = null;

    public static function get(): PDO
    {
        if (self::$pdo === null) {
            self::$pdo = new PDO('sqlite:' . __DIR__ . '/../blog.sqlite');
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            self::init(self::$pdo);
        }

        return self::$pdo;
    }

    private static function init(PDO $pdo): void
    {
        $pdo->exec('CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )');
    }
}
