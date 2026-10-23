<?php

// Samma svarsformat som Node-API:et: { "data": ... } respektive { "error": {...} }
class Response
{
    public static function json(int $status, array $body): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    }

    public static function data(int $status, $data): void
    {
        self::json($status, ['data' => $data]);
    }

    public static function error(int $status, string $code, string $message): void
    {
        self::json($status, ['error' => ['code' => $code, 'message' => $message]]);
    }
}
