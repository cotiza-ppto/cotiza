<?php
// ============================================================
// email.php — Envío de correos para Sistema de Presupuestos
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
    echo json_encode(['error' => 'No autorizado']);
    exit;
}
$stmt = $pdo->prepare("SELECT username FROM sessions WHERE token = ? AND expires_at > NOW()");
$stmt->execute([$token]);
$currentSession = $stmt->fetch();
if (!$currentSession) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado']);
    exit;
}

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require 'libs/PHPMailer/src/Exception.php';
require 'libs/PHPMailer/src/PHPMailer.php';
require 'libs/PHPMailer/src/SMTP.php';

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!$data || empty($data['to']) || empty($data['html'])) {
    echo json_encode(['error' => 'Datos insuficientes para enviar el correo']);
    exit;
}

$mail = new PHPMailer(true);

try {
    // Cargar configuración SMTP desde la BD
    $smtpDefaults = ['host'=>'smtp.gmail.com', 'port'=>'587', 'secure'=>'tls', 'user'=>'ventas@suncatcher.com.mx', 'pass'=>''];
    
    $cStmt = $pdo->query("SELECT valor FROM configuracion WHERE clave = 'app_settings'");
    $cRow = $cStmt->fetch();
    $settings = $cRow ? (json_decode($cRow['valor'], true) ?: []) : [];

    if (!empty($settings['smtp'])) {
        $s = $settings['smtp'];
        $smtpDefaults['host'] = $s['host'] ?? $smtpDefaults['host'];
        $smtpDefaults['port'] = $s['port'] ?? $smtpDefaults['port'];
        $smtpDefaults['user'] = $s['username'] ?? $s['user'] ?? $smtpDefaults['user'];
        // Vercel / BD contiene el password real (api.php lo mantiene al guardar)
        $smtpDefaults['pass'] = $s['password'] ?? $s['pass'] ?? $smtpDefaults['pass'];
        $smtpDefaults['secure'] = $s['secure'] ?? $smtpDefaults['secure'];
        $smtpDefaults['from'] = $s['from'] ?? $s['fromEmail'] ?? $smtpDefaults['user'];
        $smtpDefaults['fromName'] = $s['fromName'] ?? '';
    }
    $smtpConfig = $smtpDefaults;

    // Configuración del servidor SMTP
    $mail->isSMTP();
    $mail->Host       = $smtpConfig['host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpConfig['user'];
    $mail->Password   = $smtpConfig['pass'];
    $mail->SMTPSecure = strtolower($smtpConfig['secure'] ?? 'tls') === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = intval($smtpConfig['port']) ?: 587;
    $mail->CharSet    = 'UTF-8';

    // Remitente y destinatario
    $fromEmail = $smtpConfig['from'] ?: $smtpConfig['user'] ?: 'ventas@suncatcher.com.mx';
    $fromName  = $smtpConfig['fromName'] ?: 'Comercializadora Suncatcher del Norte';
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($data['to']);

    // BCC (CCO)
    if (!empty($data['bcc']) && is_array($data['bcc'])) {
        foreach ($data['bcc'] as $bccAddr) {
            if (filter_var($bccAddr, FILTER_VALIDATE_EMAIL)) {
                $mail->addBCC($bccAddr);
            }
        }
    }

    // Contenido
    $mail->isHTML(true);
    $mail->Subject = $data['subject'] ?? 'Presupuesto Comercializadora Suncatcher';
    
    // Optional logo URL (passed from frontend as 'logo')
    $logoImg = $data['logo'] ?? '';
    $logoTag = $logoImg ? "<p style='text-align:center;'><img src='" . $logoImg . "' alt='Logo' style='max-height:80px;'></p>" : '';
    
    $htmlBody = "
    <!DOCTYPE html>
    <html lang='es'>
    <head>
        <meta charset='UTF-8'>
        <style>
            body { font-family: Arial, sans-serif; background-color: #f3f4f6; padding: 20px; }
            .container { background-color: white; border-radius: 8px; padding: 20px; max-width: 800px; margin: 0 auto; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
            .footer { font-size: 12px; color: #666; margin-top: 20px; text-align: center; }
        </style>
    </head>
    <body>
        <div class='container'>
            {$logoTag}
            " . $data['html'] . "
            <div class='footer'>
                <p>Comercializadora Suncatcher del Norte</p>
            </div>
        </div>
    </body>
    </html>
    ";
    
    $mail->Body    = $htmlBody;
    $mail->AltBody = strip_tags($data['html']);

    if (!empty($data['pdfBase64']) && !empty($data['pdfName'])) {
        $raw = $data['pdfBase64'];
        $b64 = preg_replace('#^data:application/pdf(;[^,]+)?;base64,#i', '', $raw);
        $pdfData = @base64_decode($b64, true);
        if ($pdfData !== false) {
            $mail->addStringAttachment($pdfData, $data['pdfName'], 'base64', 'application/pdf');
        }
    }

    $mail->send();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
