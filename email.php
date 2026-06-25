<?php
session_start();
header('Content-Type: application/json');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');

// Requiere autenticación
if (empty($_SESSION['logged_in'])) {
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
    // Cargar configuración SMTP desde settings.json
    $smtpDefaults = ['host'=>'smtp.gmail.com', 'port'=>'587', 'secure'=>'tls', 'user'=>'ventas@suncatcher.com.mx', 'pass'=>''];
    if (file_exists('settings.json')) {
        $settings = json_decode(file_get_contents('settings.json'), true);
        if (!empty($settings['smtp'])) {
            // Map settings.json keys (username, password) to expected keys (user, pass)
            $s = $settings['smtp'];
            $smtpDefaults['host'] = $s['host'] ?? $smtpDefaults['host'];
            $smtpDefaults['port'] = $s['port'] ?? $smtpDefaults['port'];
            $smtpDefaults['user'] = $s['username'] ?? $s['user'] ?? $smtpDefaults['user'];
            $smtpDefaults['pass'] = $s['password'] ?? $s['pass'] ?? $smtpDefaults['pass'];
            $smtpDefaults['secure'] = $s['secure'] ?? $smtpDefaults['secure'];
            $smtpDefaults['from'] = $s['from'] ?? $s['fromEmail'] ?? $smtpDefaults['user'];
            $smtpDefaults['fromName'] = $s['fromName'] ?? $smtpDefaults['fromName'] ?? '';
        }
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
    // El cuerpo HTML recibe un pequeño envoltorio para asegurar que se vea bien en clientes de correo
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
        $prefix = substr($raw, 0, 80);

        // Strip any data URI prefix (handles various jsPDF formats)
        $b64 = preg_replace('#^data:application/pdf(;[^,]+)?;base64,#i', '', $raw);

        $pdfData = @base64_decode($b64, true);
        if ($pdfData === false) {
            echo json_encode(['error' => 'base64_decode falló', 'prefix' => $prefix]);
            exit;
        }

        $mail->addStringAttachment($pdfData, $data['pdfName'], 'base64', 'application/pdf');
    }

    $mail->send();
    echo json_encode(['success' => true]);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
