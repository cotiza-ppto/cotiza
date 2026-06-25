<?php
session_start();
header('Content-Type: application/json');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');

// Permitir acceso desde el mismo origen
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit; }

// Requiere autenticación
if (empty($_SESSION['logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'No autorizado. Por favor inicia sesión.']);
    exit;
}

// Credenciales Supabase (obtenidas de api.php)
define('SB_URL', 'https://ewrhzalwcnzclhjortfp.supabase.co');
define('SB_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3cmh6YWx3Y256Y2xoam9ydGZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0MDQwMTcsImV4cCI6MjA5Nzk4MDAxN30.OO7iVtklBkZwgII2nw8UTpVqv4UQuWQ9kg5IntpppCk');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_FILES['logo'])) {
    $file = $_FILES['logo'];

    if ($file['error'] === UPLOAD_ERR_OK) {
        $allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        $maxSize = 5 * 1024 * 1024; // 5MB

        if ($file['size'] > $maxSize) {
            echo json_encode(['error' => 'La imagen excede el tamaño máximo de 5MB']);
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

        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $name = 'logo_' . time() . '.' . $ext;
        
        // --- SUBIR A SUPABASE STORAGE ---
        $fileData = file_get_contents($file['tmp_name']);
        $url = SB_URL . '/storage/v1/object/uploads/' . $name;
        
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => 'POST',
            CURLOPT_POSTFIELDS => $fileData,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Authorization: Bearer ' . SB_KEY,
                'apikey: ' . SB_KEY,
                'Content-Type: ' . $file['type']
            ]
        ]);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode === 200 || $httpCode === 201) {
            // Generar URL pública
            $publicUrl = SB_URL . '/storage/v1/object/public/uploads/' . $name;
            echo json_encode(['url' => $publicUrl]);
            exit;
        } else {
            $respObj = json_decode($response, true);
            echo json_encode(['error' => 'Error al subir a Supabase: ' . ($respObj['message'] ?? $response)]);
            exit;
        }
    } else {
        echo json_encode(['error' => 'Código de error de subida: ' . $file['error']]);
        exit;
    }
}

echo json_encode(['error' => 'No se recibió ningún archivo válido']);
