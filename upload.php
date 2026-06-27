<?php
// ============================================================
// upload.php — Subida de Logotipo (Guardado en BD en Base64)
// ============================================================
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-cache, must-revalidate');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Credentials: true');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');

// CORS: permitir mismo origen y APP_URL configurado en Vercel
$origin      = $_SERVER['HTTP_ORIGIN'] ?? '';
$appUrl      = getenv('APP_URL') ?: '';
$localOrigins = ['http://localhost', 'http://localhost:8000', 'http://127.0.0.1'];
if ($origin && ($origin === $appUrl || in_array($origin, $localOrigins))) {
    header("Access-Control-Allow-Origin: $origin");
} elseif (!$origin) {
    header('Access-Control-Allow-Origin: *');
} else {
    header('Access-Control-Allow-Origin: ' . ($appUrl ?: $origin));
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// --- Conexión ---
if (file_exists(__DIR__ . '/db_config.php')) {
    include_once __DIR__ . '/db_config.php';
} else {
    define('DB_HOST',    getenv('DB_HOST')    ?: 'db.ewrhzalwcnzclhjortfp.supabase.co');
    define('DB_PORT',    getenv('DB_PORT')    ?: '5432');
    define('DB_NAME',    getenv('DB_NAME')    ?: 'postgres');
    define('DB_USER',    getenv('DB_USER')    ?: 'postgres');
    define('DB_PASS',    getenv('DB_PASS')    ?: '');
}

try {
    $pdo = new PDO(
        "pgsql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME,
        DB_USER, DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (PDOException $e) {
    http_response_code(500);
    die(json_encode(['error' => 'Error de conexión: ' . $e->getMessage()]));
}

// ---- Verificar sesión por Token ----
define('TOKEN_COOKIE', 'SUNCATCHER_TOKEN');
$token = $_COOKIE[TOKEN_COOKIE] ?? '';
if (!$token || strlen($token) < 32) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado. Por favor inicia sesión.']);
    exit;
}
$stmt = $pdo->prepare("SELECT username FROM sessions WHERE token = ? AND expires_at > NOW()");
$stmt->execute([$token]);
$currentSession = $stmt->fetch();
if (!$currentSession) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado. Por favor inicia sesión.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['logo'])) {
    $file = $_FILES['logo'];

    if ($file['error'] === UPLOAD_ERR_OK) {
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $maxSize = 2 * 1024 * 1024; // Límite reducido a 2MB para evitar excesivo tamaño Base64 en BD

        if ($file['size'] > $maxSize) {
            echo json_encode(['error' => 'La imagen excede el tamaño máximo de 2MB']);
            exit;
        }

        if (!in_array($file['type'], $allowedTypes)) {
            echo json_encode(['error' => 'Formato de imagen no válido']);
            exit;
        }

        $check = getimagesize($file['tmp_name']);
        if ($check === false) {
            echo json_encode(['error' => 'El archivo no es una imagen válida']);
            exit;
        }

        // Convertir la imagen a Base64 Data URI
        $data = file_get_contents($file['tmp_name']);
        $base64 = 'data:' . $file['type'] . ';base64,' . base64_encode($data);

        // Retornar directamente la URI base64, compatible con Vercel serverless (sin almacenar archivos locales)
        echo json_encode(['url' => $base64]);
        exit;
    } else {
        echo json_encode(['error' => 'Código de error de subida: ' . $file['error']]);
        exit;
    }
}

echo json_encode(['error' => 'No se recibió ningún archivo válido']);
?>
