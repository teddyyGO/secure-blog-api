<?php

require_once __DIR__ . '/src/Response.php';
require_once __DIR__ . '/src/PostController.php';

header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$path = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
$parts = $path === '' ? [] : explode('/', $path);

$body = [];
if (in_array($method, ['POST', 'PUT'], true)) {
    $body = json_decode(file_get_contents('php://input'), true);
    if (!is_array($body)) {
        Response::error(400, 'INVALID_JSON', 'Body måste vara giltig JSON');
        exit;
    }
}

$controller = new PostController();

// Enkel routing: /posts och /posts/{id}
if (($parts[0] ?? '') === 'posts') {
    $id = $parts[1] ?? null;

    if ($id !== null && !ctype_digit($id)) {
        Response::error(400, 'INVALID_ID', 'Ogiltigt ID');
        exit;
    }

    match (true) {
        $method === 'GET' && $id === null => $controller->index(),
        $method === 'GET' => $controller->show($id),
        $method === 'POST' && $id === null => $controller->store($body),
        $method === 'PUT' && $id !== null => $controller->update($id, $body),
        $method === 'DELETE' && $id !== null => $controller->destroy($id),
        default => Response::error(405, 'METHOD_NOT_ALLOWED', 'Metoden stöds inte på den här routen'),
    };
    exit;
}

if ($path === '') {
    Response::data(200, ['message' => 'PHP Blog API', 'endpoints' => ['/posts']]);
    exit;
}

Response::error(404, 'ROUTE_NOT_FOUND', "Route $method /$path finns inte");
