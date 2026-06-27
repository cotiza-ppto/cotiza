<?php
$content = file_get_contents('assets/js/full.js');

// 1. Extract Config & API
$coreEnd = strpos($content, 'const app = {');
$coreCode = substr($content, 0, $coreEnd);

// 2. Extract inner body of `const app = {`
$appBody = substr($content, $coreEnd + 13); // skip 'const app = {'
$endPos = strrpos($appBody, '};');
if ($endPos === false) {
    die("Error: no se encontró '};' en el cuerpo de app.\n");
}
$appBody = substr($appBody, 0, $endPos); // remove last };

// Define the sections
$sections = [
    'DASHBOARD' => 'dashboard.js',
    'CLIENTES' => 'clients.js',
    'PRODUCTOS' => 'products.js',
    'PRESUPUESTOS' => 'budgets.js',
    'CONFIGURACI' => 'settings.js'
];

$modules = [];
$currentSection = 'APP'; // Everything before DASHBOARD goes to app.js
$modules[$currentSection] = '';

$lines = explode("\n", $appBody);
foreach ($lines as $line) {
    if (strpos($line, '// ==================== ') !== false) {
        foreach ($sections as $key => $file) {
            if (strpos($line, $key) !== false) {
                $currentSection = $file;
                $modules[$currentSection] = '';
                break;
            }
        }
        continue;
    }
    $modules[$currentSection] .= $line . "\n";
}

// Write the files
file_put_contents('assets/js/core.js', $coreCode);

file_put_contents('assets/js/app.js', "window.app = window.app || {};\nObject.assign(window.app, {\n" . $modules['APP'] . "\n});\n");

foreach ($sections as $key => $file) {
    if (isset($modules[$file])) {
        // Strip trailing comma from the last method if it exists
        $content = trim($modules[$file]);
        if (substr($content, -1) === ',') {
            $content = substr($content, 0, -1);
        }
        $code = "window.app = window.app || {};\nObject.assign(window.app, {\n" . $content . "\n});\n";
        file_put_contents('assets/js/' . $file, $code);
    }
}

echo "Files generated successfully.\n";
