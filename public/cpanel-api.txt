<?php
/**
 * ==============================================================================
 * SIPADES SIROMBU - CPANEL BACKEND BRIDGE API
 * Permendagri No. 20/2018 & Permendagri No. 1/2016
 * ==============================================================================
 * File ini digunakan untuk memindahkan penyimpanan data SIPADES dari Firebase
 * ke Web Hosting cPanel pribadi tanpa batasan kuota harian (Unlimited Storage).
 *
 * CARA PEMASANGAN DI CPANEL:
 * 1. Buka cPanel (File Manager) -> masuk ke folder 'public_html'
 * 2. Upload file ini ('cpanel-api.php') dan file 'sipades_database.json'
 * 3. Buka aplikasi SIPADES -> Pengaturan Hosting cPanel -> Masukkan URL domain Anda
 *    Contoh: https://namadomain-anda.com/cpanel-api.php
 * ==============================================================================
 */

// Set batas memori dan ukuran upload untuk menangani foto aset HD
@ini_set('memory_limit', '512M');
@ini_set('post_max_size', '128M');
@ini_set('upload_max_filesize', '128M');

// Header CORS agar aplikasi dapat berkomunikasi aman dari browser
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

// Tangani Preflight Request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dbFile = __DIR__ . '/sipades_database.json';

// Inisialisasi file database jika belum ada
if (!file_exists($dbFile)) {
    $initialData = [
        'asets' => [],
        'desas' => [],
        'users' => [],
        'verifikasiList' => [],
        'pengesahanList' => [],
        'kecamatanProfile' => [
            'namaKecamatan' => 'KECAMATAN SIROMBU',
            'kabupaten' => 'PEMERINTAH KABUPATEN NIAS BARAT',
            'namaCamat' => 'BEMIN FETARO DAELI, S.Pd',
            'nipCamat' => '19880521 201503 1 002',
            'pangkatCamat' => 'PENATA TK. I',
            'jabatanCamat' => 'CAMAT SIROMBU',
            'alamatKantor' => 'Tetesua Desa Togideu Kec. Sirombu Kabupaten Nias Barat',
            'teleponKantor' => '0813 6699 8787',
            'emailKantor' => 'kecamatansirombu2023@gmail.com',
            'kodePos' => '22863',
            'tempatSurat' => 'Tetesua'
        ],
        'updatedAt' => date('c')
    ];
    file_put_contents($dbFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function getDatabase($file) {
    if (!file_exists($file)) return null;
    $content = file_get_contents($file);
    return json_decode($content, true);
}

function saveDatabase($file, $data) {
    $data['updatedAt'] = date('c');
    return file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

$action = isset($_GET['action']) ? $_GET['action'] : 'data';
$method = $_SERVER['REQUEST_METHOD'];

// Otomatis route jika method adalah DELETE
if ($method === 'DELETE') {
    $action = 'delete_aset';
}

switch ($action) {
    case 'ping':
        $db = getDatabase($dbFile);
        $count = isset($db['asets']) && is_array($db['asets']) ? count($db['asets']) : 0;
        echo json_encode([
            'status' => 'success',
            'message' => 'Koneksi cPanel Web Hosting SIPADES Berhasil!',
            'server' => $_SERVER['SERVER_NAME'],
            'totalAset' => $count,
            'updatedAt' => $db['updatedAt'] ?? date('c'),
            'timestamp' => date('c')
        ]);
        break;

    case 'data':
        $db = getDatabase($dbFile);
        if (!$db) {
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal membaca database di cPanel']);
            exit;
        }
        echo json_encode($db);
        break;

    case 'sync':
    case 'upload_all':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
            exit;
        }
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);
        if (!$payload || !is_array($payload)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Format payload tidak valid']);
            exit;
        }

        $db = getDatabase($dbFile) ?: [];
        if (isset($payload['data']) && is_array($payload['data'])) {
            $payload = $payload['data'];
        }

        if (isset($payload['asets']) && is_array($payload['asets']) && count($payload['asets']) > 0) {
            $db['asets'] = $payload['asets'];
        }
        if (isset($payload['desas']) && is_array($payload['desas'])) {
            $db['desas'] = $payload['desas'];
        }
        if (isset($payload['users']) && is_array($payload['users'])) {
            $db['users'] = $payload['users'];
        }
        if (isset($payload['verifikasiList']) && is_array($payload['verifikasiList'])) {
            $db['verifikasiList'] = $payload['verifikasiList'];
        }
        if (isset($payload['pengesahanList']) && is_array($payload['pengesahanList'])) {
            $db['pengesahanList'] = $payload['pengesahanList'];
        }
        if (isset($payload['kecamatanProfile'])) {
            $db['kecamatanProfile'] = $payload['kecamatanProfile'];
        }

        saveDatabase($dbFile, $db);
        echo json_encode([
            'status' => 'success',
            'message' => 'Seluruh data berhasil disinkronkan ke cPanel hosting',
            'totalAset' => count($db['asets'] ?? [])
        ]);
        break;

    case 'upload_chunk':
    case 'batch_sync':
        if ($method !== 'POST') {
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Method not allowed']);
            exit;
        }
        $raw = file_get_contents('php://input');
        $payload = json_decode($raw, true);
        if (!$payload || !is_array($payload)) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Format payload tidak valid']);
            exit;
        }
        $db = getDatabase($dbFile) ?: [];
        $d = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;
        $items = isset($d['asets']) && is_array($d['asets']) ? $d['asets'] : [];

        $existing = isset($db['asets']) && is_array($db['asets']) ? $db['asets'] : [];
        $map = [];
        foreach ($existing as $idx => $a) {
            if (isset($a['id'])) $map[$a['id']] = $idx;
        }

        foreach ($items as $item) {
            if (!isset($item['id'])) continue;
            if (isset($map[$item['id']])) {
                $orig = $existing[$map[$item['id']]];
                if (empty($item['fotoAset']) && !empty($orig['fotoAset'])) $item['fotoAset'] = $orig['fotoAset'];
                if (empty($item['fotoBast']) && !empty($orig['fotoBast'])) $item['fotoBast'] = $orig['fotoBast'];
                $existing[$map[$item['id']]] = array_merge($orig, $item);
            } else {
                $existing[] = $item;
                $map[$item['id']] = count($existing) - 1;
            }
        }
        $db['asets'] = $existing;

        if (isset($d['desas']) && is_array($d['desas'])) $db['desas'] = $d['desas'];
        if (isset($d['users']) && is_array($d['users'])) $db['users'] = $d['users'];
        if (isset($d['verifikasiList']) && is_array($d['verifikasiList'])) $db['verifikasiList'] = $d['verifikasiList'];
        if (isset($d['pengesahanList']) && is_array($d['pengesahanList'])) $db['pengesahanList'] = $d['pengesahanList'];
        if (isset($d['kecamatanProfile'])) $db['kecamatanProfile'] = $d['kecamatanProfile'];

        saveDatabase($dbFile, $db);
        echo json_encode([
            'status' => 'success',
            'message' => 'Batch data berhasil disinkronkan ke cPanel',
            'totalAset' => count($db['asets'] ?? [])
        ]);
        break;

    case 'save_aset':
        if ($method !== 'POST' && $method !== 'PUT') {
            http_response_code(405);
            exit;
        }
        $raw = file_get_contents('php://input');
        $item = json_decode($raw, true);
        if (!$item || !isset($item['id'])) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'Data aset tidak valid']);
            exit;
        }
        $db = getDatabase($dbFile);
        $asets = $db['asets'] ?? [];
        $found = false;
        foreach ($asets as $i => $a) {
            if ($a['id'] === $item['id']) {
                // Pertahankan foto jika incoming foto kosong
                if (empty($item['fotoAset']) && !empty($a['fotoAset'])) {
                    $item['fotoAset'] = $a['fotoAset'];
                }
                if (empty($item['fotoBast']) && !empty($a['fotoBast'])) {
                    $item['fotoBast'] = $a['fotoBast'];
                }
                $asets[$i] = array_merge($a, $item);
                $found = true;
                break;
            }
        }
        if (!$found) {
            array_unshift($asets, $item);
        }
        $db['asets'] = $asets;
        saveDatabase($dbFile, $db);
        echo json_encode(['status' => 'success', 'message' => 'Aset tersimpan di cPanel']);
        break;

    case 'delete_aset':
        $raw = file_get_contents('php://input');
        $body = json_decode($raw, true);
        $id = isset($_GET['id']) ? $_GET['id'] : ($body['id'] ?? null);
        if (!$id) {
            http_response_code(400);
            echo json_encode(['status' => 'error', 'message' => 'ID aset diperlukan']);
            exit;
        }
        $db = getDatabase($dbFile);
        $asets = $db['asets'] ?? [];
        $newAsets = [];
        foreach ($asets as $a) {
            if ($a['id'] !== $id) {
                $newAsets[] = $a;
            }
        }
        $db['asets'] = $newAsets;
        saveDatabase($dbFile, $db);
        echo json_encode(['status' => 'success', 'message' => 'Aset dihapus dari cPanel']);
        break;

    default:
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Action tidak ditemukan']);
        break;
}
