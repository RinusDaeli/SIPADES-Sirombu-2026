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

// Aktifkan kompresi gzip otomatis untuk pengiriman data secepat kilat (menghemat bandwidth 95%)
if (function_exists('ob_gzhandler') && !ob_get_level()) {
    ob_start('ob_gzhandler');
}

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

function savePhotoFile($b64_str, $folder, $prefix) {
    if (empty($b64_str) || !is_string($b64_str)) return $b64_str;
    if (strpos($b64_str, '/uploads/') === 0 || strpos($b64_str, 'http') === 0) {
        return $b64_str; // Sudah berupa URL gambar
    }
    if (strlen($b64_str) < 100) return $b64_str;

    $dir = __DIR__ . '/uploads/' . $folder;
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    $ext = (strpos($b64_str, 'image/png') !== false) ? 'png' : 'jpg';
    $safe_prefix = preg_replace('/[^a-zA-Z0-9_-]/', '_', $prefix);
    $filename = $safe_prefix . '_' . time() . '_' . substr(md5(uniqid()), 0, 5) . '.' . $ext;
    $filePath = $dir . '/' . $filename;

    if (strpos($b64_str, ',') !== false) {
        $parts = explode(',', $b64_str, 2);
        $data = base64_decode($parts[1]);
    } else {
        $data = base64_decode($b64_str);
    }

    if ($data !== false && file_put_contents($filePath, $data) !== false) {
        return '/uploads/' . $folder . '/' . $filename;
    }
    return $b64_str;
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
        $asets = isset($db['asets']) && is_array($db['asets']) ? $db['asets'] : [];
        $total = count($asets);
        $active = 0;
        $pending = 0;
        foreach ($asets as $a) {
            if (($a['status'] ?? 'aktif') !== 'terhapus') {
                $active++;
            }
            if (($a['statusVerifikasi'] ?? '') === 'sedang_diproses') {
                $pending++;
            }
        }
        echo json_encode([
            'status' => 'success',
            'message' => 'Koneksi cPanel Web Hosting SIPADES Berhasil!',
            'server' => $_SERVER['SERVER_NAME'] ?? 'sipadessirombu.my.id',
            'totalAset' => $active > 0 ? $active : $total,
            'totalUnit' => $total,
            'activeAset' => $active,
            'pendingVerifikasi' => $pending,
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
        // Selalu sertakan foto thumbnail pertama sehingga foto aset tetap tampil jelas di tabel & dashboard
        if (isset($_GET['light']) && $_GET['light'] === '1' && isset($db['asets']) && is_array($db['asets'])) {
            $lightAsets = [];
            foreach ($db['asets'] as $a) {
                if (isset($a['fotoAset'])) {
                    if (is_array($a['fotoAset']) && !empty($a['fotoAset'])) {
                        $a['hasFoto'] = true;
                        // Tetap sertakan foto pertama untuk thumbnail visual
                        $a['fotoAset'] = [$a['fotoAset'][0]];
                    } else if (is_string($a['fotoAset']) && strlen($a['fotoAset']) > 50) {
                        $a['hasFoto'] = true;
                        $a['fotoAset'] = [$a['fotoAset']];
                    }
                }
                if (isset($a['fotoBast']) && !empty($a['fotoBast'])) {
                    $a['hasBast'] = true;
                }
                $lightAsets[] = $a;
            }
            $db['asets'] = $lightAsets;
        }
        echo json_encode($db);
        break;

    case 'foto':
        $id = $_GET['id'] ?? '';
        if (!$id) {
            http_response_code(400);
            echo json_encode(['error' => 'ID aset diperlukan']);
            exit;
        }
        $db = getDatabase($dbFile);
        $found = null;
        if (isset($db['asets']) && is_array($db['asets'])) {
            foreach ($db['asets'] as $a) {
                if (isset($a['id']) && $a['id'] === $id) {
                    $found = $a;
                    break;
                }
            }
        }
        if ($found) {
            echo json_encode([
                'id' => $found['id'],
                'fotoAset' => $found['fotoAset'] ?? [],
                'fotoBast' => $found['fotoBast'] ?? ''
            ]);
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Aset tidak ditemukan']);
        }
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

        $deletedIds = $db['deletedIds'] ?? [];
        if (isset($payload['deletedIds']) && is_array($payload['deletedIds'])) {
            $deletedIds = array_values(array_unique(array_merge($deletedIds, $payload['deletedIds'])));
            $db['deletedIds'] = $deletedIds;
        }

        if (isset($payload['asets']) && is_array($payload['asets']) && count($payload['asets']) > 0) {
            $existing = isset($db['asets']) && is_array($db['asets']) ? $db['asets'] : [];
            // Buang aset yang sudah ada dalam daftar terhapus permanen
            $incoming = array_values(array_filter($payload['asets'], function($a) use ($deletedIds) {
                return !in_array($a['id'] ?? '', $deletedIds);
            }));

            $existingMap = [];
            foreach ($existing as $idx => $ea) {
                if (isset($ea['id'])) $existingMap[$ea['id']] = $idx;
            }

            foreach ($incoming as $idx => $ia) {
                if (isset($ia['id']) && isset($existingMap[$ia['id']])) {
                    $orig = $existing[$existingMap[$ia['id']]];
                    // Lindungi status verifikasi agar tidak tertimpa kembali ke 'sedang_diproses'
                    if (($orig['statusVerifikasi'] ?? '') === 'sudah_diverifikasi' && ($ia['statusVerifikasi'] ?? '') !== 'sudah_diverifikasi') {
                        $incoming[$idx]['statusVerifikasi'] = 'sudah_diverifikasi';
                        $incoming[$idx]['diverifikasiOleh'] = $orig['diverifikasiOleh'] ?? ($ia['diverifikasiOleh'] ?? '');
                        $incoming[$idx]['tanggalVerifikasi'] = $orig['tanggalVerifikasi'] ?? ($ia['tanggalVerifikasi'] ?? '');
                        $incoming[$idx]['catatanVerifikasi'] = $orig['catatanVerifikasi'] ?? ($ia['catatanVerifikasi'] ?? '');
                        $incoming[$idx]['nomorSKVerifikasi'] = $orig['nomorSKVerifikasi'] ?? ($ia['nomorSKVerifikasi'] ?? '');
                    }
                    if (empty($incoming[$idx]['fotoAset']) && !empty($orig['fotoAset'])) {
                        $incoming[$idx]['fotoAset'] = $orig['fotoAset'];
                    }
                    if (empty($incoming[$idx]['fotoBast']) && !empty($orig['fotoBast'])) {
                        $incoming[$idx]['fotoBast'] = $orig['fotoBast'];
                    }
                }
            }

            if (count($incoming) < count($existing)) {
                $mergedMap = [];
                foreach ($existing as $ea) {
                    if (isset($ea['id'])) $mergedMap[$ea['id']] = $ea;
                }
                foreach ($incoming as $ia) {
                    if (isset($ia['id'])) {
                        $curr = $mergedMap[$ia['id']] ?? [];
                        $mergedMap[$ia['id']] = array_merge($curr, $ia);
                    }
                }
                $db['asets'] = array_values($mergedMap);
            } else {
                $db['asets'] = $incoming;
            }
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
        $deletedIds = $db['deletedIds'] ?? [];
        // Hapus dari daftar terhapus jika sengaja disimpan ulang
        $db['deletedIds'] = array_values(array_diff($deletedIds, [$item['id']]));

        $asets = $db['asets'] ?? [];
        $found = false;
        $oldPhotos = [];
        $oldBast = '';

        foreach ($asets as $i => $a) {
            if ($a['id'] === $item['id']) {
                $oldPhotos = is_array($a['fotoAset'] ?? null) ? $a['fotoAset'] : [];
                $oldBast = is_string($a['fotoBast'] ?? null) ? $a['fotoBast'] : '';
                $found = true;
                break;
            }
        }

        // 1. Simpan foto aset baru ke folder uploads/ dan ubah menjadi URL fisik
        if (isset($item['fotoAset']) && is_array($item['fotoAset'])) {
            $savedPhotos = [];
            foreach ($item['fotoAset'] as $idx => $p) {
                if (is_string($p)) {
                    $savedPhotos[] = savePhotoFile($p, 'foto-aset', $item['id'] . '_' . $idx);
                }
            }
            $item['fotoAset'] = $savedPhotos;

            // Hapus file fisik foto lama yang dibuang oleh pengguna
            foreach ($oldPhotos as $op) {
                if (is_string($op) && strpos($op, '/uploads/') === 0 && !in_array($op, $savedPhotos)) {
                    @unlink(__DIR__ . $op);
                }
            }
        }

        // 2. Simpan foto BAST baru dan hapus file lama jika diganti
        if (isset($item['fotoBast']) && is_string($item['fotoBast'])) {
            if (!empty($item['fotoBast'])) {
                $item['fotoBast'] = savePhotoFile($item['fotoBast'], 'foto-bast', $item['id'] . '_bast');
                if (!empty($oldBast) && strpos($oldBast, '/uploads/') === 0 && $oldBast !== $item['fotoBast']) {
                    @unlink(__DIR__ . $oldBast);
                }
            } else if (!empty($oldBast) && strpos($oldBast, '/uploads/') === 0) {
                // Pengguna mengosongkan foto BAST
                @unlink(__DIR__ . $oldBast);
            }
        }

        $item['updatedAt'] = date('c');

        if ($found) {
            foreach ($asets as $i => $a) {
                if ($a['id'] === $item['id']) {
                    // Timpa data lama secara presisi dengan data editan terbaru
                    $asets[$i] = array_merge($a, $item);
                    break;
                }
            }
        } else {
            array_unshift($asets, $item);
        }

        $db['asets'] = $asets;
        saveDatabase($dbFile, $db);
        echo json_encode([
            'status' => 'success',
            'message' => 'Aset berhasil diperbarui dan disimpan permanen di cPanel',
            'aset' => $item
        ]);
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
            } else {
                // Hapus berkas foto fisik dari folder uploads agar kapasitas hosting bersih
                if (!empty($a['fotoAset']) && is_array($a['fotoAset'])) {
                    foreach ($a['fotoAset'] as $p) {
                        if (is_string($p) && strpos($p, '/uploads/') === 0) {
                            @unlink(__DIR__ . $p);
                        }
                    }
                }
                if (!empty($a['fotoBast']) && is_string($a['fotoBast']) && strpos($a['fotoBast'], '/uploads/') === 0) {
                    @unlink(__DIR__ . $a['fotoBast']);
                }
            }
        }

        // Catat ke daftar tombstone terhapus permanen agar TIDAK AKAN PERNAH muncul lagi
        $deletedIds = $db['deletedIds'] ?? [];
        if (!in_array($id, $deletedIds)) {
            $deletedIds[] = $id;
        }

        $db['asets'] = $newAsets;
        $db['deletedIds'] = $deletedIds;
        saveDatabase($dbFile, $db);
        echo json_encode([
            'status' => 'success',
            'message' => 'Aset dan berkas foto fisik berhasil dihapus permanen dari cPanel',
            'id' => $id,
            'totalAset' => count($newAsets)
        ]);
        break;

    case 'zip_base64':
        $zipFile = __DIR__ . '/sipades-web-sirombu.zip';
        if (!file_exists($zipFile)) {
            http_response_code(404);
            echo json_encode(['status' => 'error', 'message' => 'Berkas zip tidak ditemukan']);
            exit;
        }
        $data = file_get_contents($zipFile);
        echo json_encode([
            'status' => 'success',
            'filename' => 'sipades-web-sirombu.zip',
            'size' => strlen($data),
            'sizeKB' => round(strlen($data) / 1024, 1),
            'base64' => base64_encode($data)
        ]);
        break;

    default:
        http_response_code(404);
        echo json_encode(['status' => 'error', 'message' => 'Action tidak ditemukan']);
        break;
}
