<?php

require_once __DIR__ . '/Database.php';
require_once __DIR__ . '/Response.php';

class PostController
{
    public function index(): void
    {
        $stmt = Database::get()->query('SELECT * FROM posts ORDER BY id DESC');
        Response::data(200, $stmt->fetchAll());
    }

    public function show(string $id): void
    {
        // Parametriserad query, användarens input hamnar aldrig i SQL-strängen
        $stmt = Database::get()->prepare('SELECT * FROM posts WHERE id = :id');
        $stmt->execute([':id' => $id]);
        $post = $stmt->fetch();

        if (!$post) {
            Response::error(404, 'POST_NOT_FOUND', 'Inlägget hittades inte');
            return;
        }

        Response::data(200, $post);
    }

    public function store(array $body): void
    {
        $errors = $this->validate($body);
        if ($errors) {
            Response::json(422, ['error' => [
                'code' => 'VALIDATION_ERROR',
                'message' => 'Valideringsfel i förfrågan',
                'details' => $errors,
            ]]);
            return;
        }

        $pdo = Database::get();
        $stmt = $pdo->prepare('INSERT INTO posts (title, content) VALUES (:title, :content)');
        $stmt->execute([
            ':title' => strip_tags(trim($body['title'])),
            ':content' => strip_tags(trim($body['content'])),
        ]);

        $this->show((string) $pdo->lastInsertId());
    }

    public function update(string $id, array $body): void
    {
        $errors = $this->validate($body);
        if ($errors) {
            Response::json(422, ['error' => [
                'code' => 'VALIDATION_ERROR',
                'message' => 'Valideringsfel i förfrågan',
                'details' => $errors,
            ]]);
            return;
        }

        $stmt = Database::get()->prepare(
            'UPDATE posts SET title = :title, content = :content WHERE id = :id'
        );
        $stmt->execute([
            ':title' => strip_tags(trim($body['title'])),
            ':content' => strip_tags(trim($body['content'])),
            ':id' => $id,
        ]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'POST_NOT_FOUND', 'Inlägget hittades inte');
            return;
        }

        $this->show($id);
    }

    public function destroy(string $id): void
    {
        $stmt = Database::get()->prepare('DELETE FROM posts WHERE id = :id');
        $stmt->execute([':id' => $id]);

        if ($stmt->rowCount() === 0) {
            Response::error(404, 'POST_NOT_FOUND', 'Inlägget hittades inte');
            return;
        }

        http_response_code(204);
    }

    private function validate(array $body): array
    {
        $errors = [];

        if (empty($body['title']) || strlen(trim($body['title'])) < 3) {
            $errors[] = ['field' => 'title', 'message' => 'Titel krävs och måste vara minst 3 tecken'];
        }

        if (empty($body['content'])) {
            $errors[] = ['field' => 'content', 'message' => 'Innehåll krävs'];
        }

        return $errors;
    }
}
