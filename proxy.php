<?php
/**
 * Relais vers les API d'IA utilisées par l'éditeur.
 *
 * Le navigateur ne peut pas appeler ces API directement (CORS) ; ce relais
 * reste volontairement fermé : seuls les hôtes connus sont acceptés, en HTTPS,
 * et seuls les en-têtes nécessaires sont transmis. Sans cette liste blanche,
 * n'importe qui pourrait faire récupérer des URL internes par le serveur
 * (SSRF). La clé API n'est jamais stockée : elle transite et repart.
 */

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => ['message' => 'Méthode non autorisée']]);
    exit;
}

// Taille maximale d'une requête (prompt + historique).
$rawInput = file_get_contents('php://input', false, null, 0, 524288);
$input = json_decode((string) $rawInput, true);

if (!is_array($input) || empty($input['url'])) {
    http_response_code(400);
    echo json_encode(['error' => ['message' => 'Requête invalide — url manquante']]);
    exit;
}

$url = (string) $input['url'];
$headers = isset($input['headers']) && is_array($input['headers']) ? $input['headers'] : [];
$body = $input['body'] ?? '';
if (is_array($body) || is_object($body)) {
    $body = json_encode($body);
}
$body = (string) $body;

$allowedHosts = [
    'api.openai.com',
    'api.anthropic.com',
    'generativelanguage.googleapis.com',
    'api.x.ai',
    'api.mistral.ai',
    'api.cohere.com',
];

$scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));
$host = strtolower((string) parse_url($url, PHP_URL_HOST));

if ($scheme !== 'https' || !in_array($host, $allowedHosts, true)) {
    http_response_code(403);
    echo json_encode(['error' => ['message' => 'Hôte non autorisé']]);
    exit;
}

// Seuls ces en-têtes sont relayés : pas d'injection possible de Host, etc.
$allowedHeaders = [
    'content-type',
    'authorization',
    'x-api-key',
    'x-goog-api-key',
    'anthropic-version',
    'anthropic-dangerous-direct-browser-access',
    'accept',
];

$curlHeaders = [];
foreach ($headers as $key => $value) {
    $name = strtolower(trim((string) $key));
    $value = (string) $value;

    if (!in_array($name, $allowedHeaders, true)) {
        continue;
    }
    // Un en-tête ne peut pas contenir de retour à la ligne.
    if (strpbrk($value, "\r\n") !== false) {
        continue;
    }
    $curlHeaders[] = $key . ': ' . $value;
}

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $url);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
curl_setopt($ch, CURLOPT_HTTPHEADER, $curlHeaders);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
curl_setopt($ch, CURLOPT_TIMEOUT, 90);

$response = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

http_response_code($httpCode > 0 ? $httpCode : 502);

if ($error !== '') {
    echo json_encode(['error' => ['message' => 'Relais : ' . $error]]);
    exit;
}

echo $response === false ? '' : $response;
