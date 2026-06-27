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
        
        if (!is_dir('uploads')) {
            mkdir('uploads', 0777, true);
        }
        
        $path = 'uploads/' . $name;
        
        if (move_uploaded_file($file['tmp_name'], $path)) {
            echo json_encode(['url' => $path]);
            exit;
        } else {
            echo json_encode(['error' => 'Error al mover el archivo al servidor']);
            exit;
        }
    } else {
        echo json_encode(['error' => 'Código de error de subida: ' . $file['error']]);
        exit;
    }
}

echo json_encode(['error' => 'No se recibió ningún archivo válido']);
