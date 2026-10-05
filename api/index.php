<?php

session_start();

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: same-origin');

require_once __DIR__ . '/controllers/AuthController.php';
require_once __DIR__ . '/controllers/EmployeeController.php';
require_once __DIR__ . '/controllers/LeaveController.php';
require_once __DIR__ . '/controllers/AuthorizationController.php';

$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = rtrim($uri, '/');

$segments = explode('/', trim($uri, '/'));

$apiIndex = array_search('api', $segments);
if ($apiIndex !== false) {
    $segments = array_slice($segments, $apiIndex + 1);
}

$route = implode('/', $segments);

$authController = new AuthController();
$employeeController = new EmployeeController();
$leaveController = new LeaveController();
$authorizationController = new AuthorizationController();

switch (true) {
    // ---- Auth (directeur uniquement) ----
    case $route === 'auth/login' && $method === 'POST':
        $authController->login();
        break;

    case $route === 'auth/logout' && $method === 'POST':
        $authController->logout();
        break;

    case $route === 'auth/me' && $method === 'GET':
        $authController->me();
        break;

    case $route === 'auth/account' && $method === 'PUT':
        $authController->updateAccount();
        break;

    // ---- Employés (directeur) ----
    case $route === 'employees' && $method === 'GET':
        $employeeController->index();
        break;

    case $route === 'employees' && $method === 'POST':
        $employeeController->store();
        break;

    case preg_match('/^employees\/(\d+)$/', $route, $matches) && $method === 'PUT':
        $employeeController->update($matches[1]);
        break;

    case preg_match('/^employees\/(\d+)$/', $route, $matches) && $method === 'DELETE':
        $employeeController->destroy($matches[1]);
        break;

    // ---- Congés (directeur) ----
    case $route === 'leaves' && $method === 'GET':
        $leaveController->index();
        break;

    case $route === 'leaves' && $method === 'POST':
        $leaveController->store();
        break;

    case preg_match('/^leaves\/(\d+)$/', $route, $matches) && $method === 'PUT':
        $leaveController->update($matches[1]);
        break;

    case preg_match('/^leaves\/(\d+)$/', $route, $matches) && $method === 'DELETE':
        $leaveController->destroy($matches[1]);
        break;

    case $route === 'leaves/stats' && $method === 'GET':
        $leaveController->stats();
        break;

    // ---- Autorisations d'absence (directeur) ----
    case $route === 'authorizations' && $method === 'GET':
        $authorizationController->index();
        break;

    case $route === 'authorizations' && $method === 'POST':
        $authorizationController->store();
        break;

    case preg_match('/^authorizations\/(\d+)$/', $route, $matches) && $method === 'PUT':
        $authorizationController->update($matches[1]);
        break;

    case preg_match('/^authorizations\/(\d+)$/', $route, $matches) && $method === 'DELETE':
        $authorizationController->destroy($matches[1]);
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Route non trouvée: ' . $route]);
        break;
}
