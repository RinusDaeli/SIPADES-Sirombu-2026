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
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

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
    file_put_contents($dbFile, json_encode($initialData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function acquireDbLock($dbFile) {
    $lockFp = @fopen($dbFile . '.lock', 'c+');
    if ($lockFp) {
        @flock($lockFp, LOCK_EX);
    }
    return $lockFp;
}

function releaseDbLock($lockFp) {
    if ($lockFp) {
        @flock($lockFp, LOCK_UN);
        @fclose($lockFp);
    }
}

function getDatabase($file) {
    if (!file_exists($file)) return null;
    $content = @file_get_contents($file);
    if ($content === false || trim($content) === '') return null;
    return json_decode($content, true);
}

function saveDatabase($file, $data) {
    $data['updatedAt'] = date('c');
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    if ($json === false) return false;
    $tmpFile = $file . '.tmp_' . uniqid('', true);
    if (@file_put_contents($tmpFile, $json, LOCK_EX) !== false) {
        if (@rename($tmpFile, $file)) {
            return true;
        }
        @unlink($tmpFile);
    }
    return file_put_contents($file, $json, LOCK_EX);
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

function getKlasifikasiPrefixPhp($klasifikasi) {
    $map = [
        'Tanah' => '01.01.01',
        'Peralatan, Mesin, dan Alat Berat' => '02.01.01',
        'Kendaraan' => '02.02.01',
        'Gedung dan Bangunan' => '03.01.01',
        'Jalan' => '04.01.01',
        'Jembatan' => '04.02.01',
        'Irigasi/Embung/Air Sungai/Drainase' => '04.03.01',
        'Jaringan/Instalasi' => '04.04.01',
        'Aset Tetap Lainnya' => '05.01.01',
        'Konstruksi dalam Pengerjaan' => '06.01.01',
    ];
    return $map[$klasifikasi] ?? '01.01.01';
}

function getDesaCodeNumberPhp($desaId, $desas = []) {
    if (is_array($desas)) {
        foreach ($desas as $d) {
            if (is_array($d) && ($d['id'] ?? '') === $desaId && !empty($d['code'])) {
                $parts = explode('.', $d['code']);
                $last = end($parts);
                return strlen($last) >= 2 ? substr($last, -2) : str_pad($last, 2, '0', STR_PAD_LEFT);
            }
        }
    }
    if (!empty($desaId) && strpos($desaId, 'desa-') === 0) {
        return str_pad(str_replace('desa-', '', $desaId), 2, '0', STR_PAD_LEFT);
    }
    return '01';
}

function buildKodeAsetPhp($item, $regNumStr, $desas = []) {
    $prefix = getKlasifikasiPrefixPhp($item['klasifikasi'] ?? 'Tanah');
    $desaCode = getDesaCodeNumberPhp($item['desaId'] ?? 'desa-01', $desas);
    $year = intval($item['tahunPerolehan'] ?? date('Y'));
    if ($year < 1970) $year = intval(date('Y'));
    return $prefix . '.' . $desaCode . '.' . $year . '.' . $regNumStr;
}

function enforceUniqueNomorRegistersPhp(&$asets, $desas = [], $targetId = null) {
    if (!is_array($asets)) return false;
    $changed = false;
    $now = date('c');

    // 1. Jika menyimpan aset tunggal ($targetId), pastikan item tersebut tidak pernah bentrok dengan aset lain di grupnya
    if ($targetId !== null) {
        $targetIdx = null;
        foreach ($asets as $i => $a) {
            if (is_array($a) && ($a['id'] ?? '') === $targetId) {
                $targetIdx = $i;
                break;
            }
        }
        if ($targetIdx !== null && ($asets[$targetIdx]['status'] ?? 'aktif') !== 'terhapus') {
            $tItem = $asets[$targetIdx];
            $tDesa = $tItem['desaId'] ?? 'unknown';
            $tYear = intval($tItem['tahunPerolehan'] ?? date('Y'));
            if ($tYear < 1970) $tYear = intval(date('Y'));

            $usedSeqs = [];
            $maxSeq = 0;
            foreach ($asets as $i => $a) {
                if ($i === $targetIdx || !is_array($a) || ($a['status'] ?? 'aktif') === 'terhapus') continue;
                if (($a['desaId'] ?? '') !== $tDesa) continue;
                $aYear = intval($a['tahunPerolehan'] ?? date('Y'));
                if ($aYear < 1970) $aYear = intval(date('Y'));
                if ($aYear !== $tYear) continue;

                $reg = intval($a['nomorRegister'] ?? '0');
                if ($reg > 0) {
                    $usedSeqs[$reg] = true;
                    if ($reg > $maxSeq) $maxSeq = $reg;
                }
                if (!empty($a['kodeAset']) && preg_match('/\.(\d{3,5})$/', trim($a['kodeAset']), $m)) {
                    $cNum = intval($m[1]);
                    if ($cNum > 0) {
                        $usedSeqs[$cNum] = true;
                        if ($cNum > $maxSeq) $maxSeq = $cNum;
                    }
                }
            }

            $curSeq = intval($tItem['nomorRegister'] ?? '0');
            if ($curSeq <= 0 && !empty($tItem['kodeAset']) && preg_match('/\.(\d{3,5})$/', trim($tItem['kodeAset']), $m)) {
                $curSeq = intval($m[1]);
            }
            if ($curSeq <= 0 || isset($usedSeqs[$curSeq])) {
                $curSeq = $maxSeq + 1;
                while (isset($usedSeqs[$curSeq])) {
                    $curSeq++;
                }
            }

            $newReg = str_pad(strval($curSeq), 4, '0', STR_PAD_LEFT);
            $newKode = buildKodeAsetPhp($tItem, $newReg, $desas);
            if (($tItem['nomorRegister'] ?? '') !== $newReg || ($tItem['kodeAset'] ?? '') !== $newKode) {
                $asets[$targetIdx]['nomorRegister'] = $newReg;
                $asets[$targetIdx]['kodeAset'] = $newKode;
                $asets[$targetIdx]['updatedAt'] = $now;
                $changed = true;
            }
        }
    }

    // 2. Sapu bersih duplikat atau nomor register kosong di setiap grup (desaId, tahunPerolehan) tanpa menggeser aset yang sudah unik
    $groups = [];
    foreach ($asets as $idx => $a) {
        if (!is_array($a) || ($a['status'] ?? 'aktif') === 'terhapus') continue;
        $dId = $a['desaId'] ?? 'unknown';
        $yr = intval($a['tahunPerolehan'] ?? date('Y'));
        if ($yr < 1970) $yr = intval(date('Y'));
        $gKey = $dId . '_' . $yr;
        if (!isset($groups[$gKey])) $groups[$gKey] = [];
        $groups[$gKey][] = $idx;
    }

    foreach ($groups as $gKey => $indices) {
        usort($indices, function($ia, $ib) use ($asets) {
            $regA = intval($asets[$ia]['nomorRegister'] ?? '0');
            $regB = intval($asets[$ib]['nomorRegister'] ?? '0');
            if ($regA !== $regB) return $regA <=> $regB;
            $crA = strval($asets[$ia]['createdAt'] ?? '');
            $crB = strval($asets[$ib]['createdAt'] ?? '');
            $cmpC = strcmp($crA, $crB);
            if ($cmpC !== 0) return $cmpC;
            return strcmp(strval($asets[$ia]['id'] ?? ''), strval($asets[$ib]['id'] ?? ''));
        });

        $usedRegs = [];
        $maxReg = 0;
        foreach ($indices as $idx) {
            $r = intval($asets[$idx]['nomorRegister'] ?? '0');
            if ($r > $maxReg) $maxReg = $r;
        }

        foreach ($indices as $idx) {
            $targetSeq = intval($asets[$idx]['nomorRegister'] ?? '0');
            if ($targetSeq <= 0 || isset($usedRegs[$targetSeq])) {
                $targetSeq = $maxReg + 1;
                while (isset($usedRegs[$targetSeq])) {
                    $targetSeq++;
                }
            }
            $usedRegs[$targetSeq] = true;
            if ($targetSeq > $maxReg) $maxReg = $targetSeq;

            $newReg = str_pad(strval($targetSeq), 4, '0', STR_PAD_LEFT);
            $newKode = buildKodeAsetPhp($asets[$idx], $newReg, $desas);
            if (($asets[$idx]['nomorRegister'] ?? '') !== $newReg || ($asets[$idx]['kodeAset'] ?? '') !== $newKode) {
                $asets[$idx]['nomorRegister'] = $newReg;
                $asets[$idx]['kodeAset'] = $newKode;
                $asets[$idx]['updatedAt'] = $now;
                $changed = true;
            }
        }
    }

    return $changed;
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
        $lockFp = acquireDbLock($dbFile);
        $db = getDatabase($dbFile);
        if (!$db) {
            releaseDbLock($lockFp);
            http_response_code(500);
            echo json_encode(['status' => 'error', 'message' => 'Gagal membaca database di cPanel']);
            exit;
        }
        if (isset($db['asets']) && is_array($db['asets'])) {
            if (enforceUniqueNomorRegistersPhp($db['asets'], $db['desas'] ?? [])) {
                saveDatabase($dbFile, $db);
            }
        }
        releaseDbLock($lockFp);
        // Hanya pangkas base64 super besar pada mode light=1, pertahankan seluruh URL fisik (/uploads/...)
        if (isset($_GET['light']) && $_GET['light'] === '1' && isset($db['asets']) && is_array($db['asets'])) {
            $lightAsets = [];
            foreach ($db['asets'] as $a) {
                if (isset($a['fotoAset']) && is_array($a['fotoAset'])) {
                    $filtered = [];
                    foreach ($a['fotoAset'] as $p) {
                        if (is_string($p) && (strpos($p, '/uploads/') === 0 || strpos($p, 'http') === 0 || strlen($p) <= 25000)) {
                            $filtered[] = $p;
                        }
                    }
                    if (!empty($a['fotoAset'])) {
                        $a['hasFoto'] = true;
                        $a['fotoAset'] = !empty($filtered) ? $filtered : [$a['fotoAset'][0]];
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

        $lockFp = acquireDbLock($dbFile);
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
            $incoming = array_values(array_filter($payload['asets'], function($a) use ($deletedIds) {
                return is_array($a) && !empty($a['id']) && !in_array($a['id'], $deletedIds);
            }));

            // Gabungkan secara non-destruktif per ID agar batch kecil tidak menimpa data yang sudah ada di cPanel
            $mergedMap = [];
            foreach ($existing as $ea) {
                if (is_array($ea) && !empty($ea['id']) && !in_array($ea['id'], $deletedIds)) {
                    $mergedMap[$ea['id']] = $ea;
                }
            }

            $nowIso = date('c');
            foreach ($incoming as $ia) {
                $id = $ia['id'];
                if (isset($mergedMap[$id])) {
                    $orig = $mergedMap[$id];
                    $origTime = isset($orig['updatedAt']) ? strtotime($orig['updatedAt']) : 0;
                    $incTime = isset($ia['updatedAt']) ? strtotime($ia['updatedAt']) : 0;

                    if (($orig['statusVerifikasi'] ?? '') === 'sudah_diverifikasi' && ($ia['statusVerifikasi'] ?? '') !== 'sudah_diverifikasi') {
                        if ($incTime <= $origTime && empty($ia['batalPengesahan'])) {
                            $ia['statusVerifikasi'] = 'sudah_diverifikasi';
                            $ia['diverifikasiOleh'] = $orig['diverifikasiOleh'] ?? ($ia['diverifikasiOleh'] ?? '');
                            $ia['tanggalVerifikasi'] = $orig['tanggalVerifikasi'] ?? ($ia['tanggalVerifikasi'] ?? '');
                            $ia['catatanVerifikasi'] = $orig['catatanVerifikasi'] ?? ($ia['catatanVerifikasi'] ?? '');
                            $ia['nomorSKVerifikasi'] = $orig['nomorSKVerifikasi'] ?? ($ia['nomorSKVerifikasi'] ?? '');
                        }
                    }

                    if (empty($ia['createdAt']) && !empty($orig['createdAt'])) {
                        $ia['createdAt'] = $orig['createdAt'];
                    }
                    if (empty($ia['updatedAt'])) {
                        $ia['updatedAt'] = $orig['updatedAt'] ?? $nowIso;
                    }
                    if (empty($ia['fotoAset']) && !empty($orig['fotoAset'])) {
                        $ia['fotoAset'] = $orig['fotoAset'];
                    }
                    if (empty($ia['fotoBast']) && !empty($orig['fotoBast'])) {
                        $ia['fotoBast'] = $orig['fotoBast'];
                    }

                    if ($origTime > $incTime && empty($ia['batalPengesahan'])) {
                        // Server has strictly newer edit; only fill missing media/verified upgrade
                        $merged = array_merge($ia, $orig);
                        if (($ia['statusVerifikasi'] ?? '') === 'sudah_diverifikasi' && ($orig['statusVerifikasi'] ?? '') !== 'sudah_diverifikasi') {
                            $merged['statusVerifikasi'] = 'sudah_diverifikasi';
                            $merged['diverifikasiOleh'] = $ia['diverifikasiOleh'] ?? ($orig['diverifikasiOleh'] ?? '');
                            $merged['tanggalVerifikasi'] = $ia['tanggalVerifikasi'] ?? ($orig['tanggalVerifikasi'] ?? '');
                            $merged['catatanVerifikasi'] = $ia['catatanVerifikasi'] ?? ($orig['catatanVerifikasi'] ?? '');
                            $merged['nomorSKVerifikasi'] = $ia['nomorSKVerifikasi'] ?? ($orig['nomorSKVerifikasi'] ?? '');
                        }
                        $mergedMap[$id] = $merged;
                    } else {
                        $merged = array_merge($orig, $ia);
                        if (($ia['statusVerifikasi'] ?? '') === 'sedang_diproses' && !empty($ia['batalPengesahan'])) {
                            unset($merged['nomorSKVerifikasi'], $merged['diverifikasiOleh'], $merged['tanggalVerifikasi'], $merged['catatanVerifikasi'], $merged['batalPengesahan']);
                        }
                        $mergedMap[$id] = $merged;
                    }
                } else {
                    if (empty($ia['createdAt'])) $ia['createdAt'] = $nowIso;
                    if (empty($ia['updatedAt'])) $ia['updatedAt'] = $nowIso;
                    $mergedMap[$id] = $ia;
                }
            }

            $db['asets'] = array_values($mergedMap);
        }
        if (isset($payload['desas']) && is_array($payload['desas'])) {
            $db['desas'] = $payload['desas'];
        }
        if (isset($db['asets']) && is_array($db['asets'])) {
            enforceUniqueNomorRegistersPhp($db['asets'], $db['desas'] ?? []);
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
        releaseDbLock($lockFp);
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

        $lockFp = acquireDbLock($dbFile);
        $db = getDatabase($dbFile) ?: [];
        $d = isset($payload['data']) && is_array($payload['data']) ? $payload['data'] : $payload;
        $items = isset($d['asets']) && is_array($d['asets']) ? $d['asets'] : [];

        $deletedIds = $db['deletedIds'] ?? [];
        if (isset($d['deletedIds']) && is_array($d['deletedIds'])) {
            $deletedIds = array_values(array_unique(array_merge($deletedIds, $d['deletedIds'])));
            $db['deletedIds'] = $deletedIds;
        }

        $existing = isset($db['asets']) && is_array($db['asets']) ? $db['asets'] : [];
        $map = [];
        foreach ($existing as $idx => $a) {
            if (is_array($a) && isset($a['id'])) $map[$a['id']] = $idx;
        }

        $nowIso = date('c');
        foreach ($items as $item) {
            if (!is_array($item) || empty($item['id'])) continue;
            // Hapus dari daftar deletedIds jika sengaja disimpan ulang lewat batch
            $db['deletedIds'] = array_values(array_diff($db['deletedIds'] ?? [], [$item['id']]));

            // Simpan foto base64 jika ada
            if (isset($item['fotoAset']) && is_array($item['fotoAset'])) {
                $savedPhotos = [];
                foreach ($item['fotoAset'] as $pIdx => $p) {
                    if (is_string($p)) {
                        $savedPhotos[] = savePhotoFile($p, 'foto-aset', $item['id'] . '_' . $pIdx);
                    }
                }
                $item['fotoAset'] = $savedPhotos;
            }
            if (isset($item['fotoBast']) && is_string($item['fotoBast']) && !empty($item['fotoBast'])) {
                $item['fotoBast'] = savePhotoFile($item['fotoBast'], 'foto-bast', $item['id'] . '_bast');
            }

            if (isset($map[$item['id']])) {
                $orig = $existing[$map[$item['id']]];
                if (empty($item['createdAt']) && !empty($orig['createdAt'])) $item['createdAt'] = $orig['createdAt'];
                if (empty($item['updatedAt'])) $item['updatedAt'] = $nowIso;
                if (empty($item['fotoAset']) && !empty($orig['fotoAset'])) $item['fotoAset'] = $orig['fotoAset'];
                if (empty($item['fotoBast']) && !empty($orig['fotoBast'])) $item['fotoBast'] = $orig['fotoBast'];
                $merged = array_merge($orig, $item);
                if (($item['statusVerifikasi'] ?? '') === 'sedang_diproses') {
                    unset($merged['nomorSKVerifikasi'], $merged['diverifikasiOleh'], $merged['tanggalVerifikasi'], $merged['catatanVerifikasi'], $merged['batalPengesahan']);
                    $merged['statusVerifikasi'] = 'sedang_diproses';
                }
                $existing[$map[$item['id']]] = $merged;
            } else {
                if (empty($item['createdAt'])) $item['createdAt'] = $nowIso;
                if (empty($item['updatedAt'])) $item['updatedAt'] = $nowIso;
                array_unshift($existing, $item);
                // Re-index map after unshift
                $map = [];
                foreach ($existing as $idx => $a) {
                    if (is_array($a) && isset($a['id'])) $map[$a['id']] = $idx;
                }
            }
        }
        $db['asets'] = $existing;

        if (isset($d['desas']) && is_array($d['desas'])) $db['desas'] = $d['desas'];
        enforceUniqueNomorRegistersPhp($db['asets'], $db['desas'] ?? []);
        if (isset($d['users']) && is_array($d['users'])) $db['users'] = $d['users'];
        if (isset($d['verifikasiList']) && is_array($d['verifikasiList'])) $db['verifikasiList'] = $d['verifikasiList'];
        if (isset($d['pengesahanList']) && is_array($d['pengesahanList'])) $db['pengesahanList'] = $d['pengesahanList'];
        if (isset($d['kecamatanProfile'])) $db['kecamatanProfile'] = $d['kecamatanProfile'];

        saveDatabase($dbFile, $db);
        releaseDbLock($lockFp);
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

        $lockFp = acquireDbLock($dbFile);
        $db = getDatabase($dbFile) ?: [];
        $deletedIds = $db['deletedIds'] ?? [];
        // Hapus dari daftar terhapus jika sengaja disimpan ulang
        $db['deletedIds'] = array_values(array_diff($deletedIds, [$item['id']]));

        $asets = $db['asets'] ?? [];
        $found = false;
        $oldPhotos = [];
        $oldBast = '';
        $origCreatedAt = '';

        foreach ($asets as $i => $a) {
            if ($a['id'] === $item['id']) {
                $oldPhotos = is_array($a['fotoAset'] ?? null) ? $a['fotoAset'] : [];
                $oldBast = is_string($a['fotoBast'] ?? null) ? $a['fotoBast'] : '';
                $origCreatedAt = is_string($a['createdAt'] ?? null) ? $a['createdAt'] : '';
                $found = true;
                break;
            }
        }

        // 1. Simpan foto aset baru ke folder uploads/ dan ubah menjadi URL fisik (jangan hapus file fisik lama agar tidak pernah hilang oleh sinkronisasi ringan)
        if (isset($item['fotoAset']) && is_array($item['fotoAset'])) {
            $savedPhotos = [];
            foreach ($item['fotoAset'] as $idx => $p) {
                if (is_string($p) && !empty($p)) {
                    $savedPhotos[] = savePhotoFile($p, 'foto-aset', $item['id'] . '_' . $idx);
                }
            }
            if (!empty($savedPhotos)) {
                $item['fotoAset'] = $savedPhotos;
            } else if (!empty($oldPhotos) && empty($item['explicitPhotoEdit'])) {
                $item['fotoAset'] = $oldPhotos;
            } else {
                $item['fotoAset'] = $savedPhotos;
            }
        } else if (!empty($oldPhotos)) {
            $item['fotoAset'] = $oldPhotos;
        }

        // 2. Simpan foto BAST baru (pertahankan foto BAST lama jika payload ringan tidak menyertakan fotoBast)
        if (isset($item['fotoBast']) && is_string($item['fotoBast'])) {
            if (!empty($item['fotoBast'])) {
                $item['fotoBast'] = savePhotoFile($item['fotoBast'], 'foto-bast', $item['id'] . '_bast');
            } else if (!empty($oldBast) && empty($item['explicitPhotoEdit'])) {
                $item['fotoBast'] = $oldBast;
            }
        } else if (!empty($oldBast)) {
            $item['fotoBast'] = $oldBast;
        }

        $nowIso = date('c');
        if (!empty($origCreatedAt)) {
            $item['createdAt'] = $origCreatedAt;
        } else if (empty($item['createdAt'])) {
            $item['createdAt'] = $nowIso;
        }
        $item['updatedAt'] = $nowIso;

        if ($found) {
            foreach ($asets as $i => $a) {
                if ($a['id'] === $item['id']) {
                    // Timpa data lama secara presisi dengan data editan terbaru
                    $merged = array_merge($a, $item);
                    if (($item['statusVerifikasi'] ?? '') === 'sedang_diproses') {
                        unset($merged['nomorSKVerifikasi'], $merged['diverifikasiOleh'], $merged['tanggalVerifikasi'], $merged['catatanVerifikasi']);
                        $merged['statusVerifikasi'] = 'sedang_diproses';
                    }
                    $asets[$i] = $merged;
                    break;
                }
            }
        } else {
            array_unshift($asets, $item);
        }

        enforceUniqueNomorRegistersPhp($asets, $db['desas'] ?? [], $item['id']);
        foreach ($asets as $a) {
            if (($a['id'] ?? '') === $item['id']) {
                $item = $a;
                break;
            }
        }

        $db['asets'] = $asets;
        saveDatabase($dbFile, $db);
        releaseDbLock($lockFp);
        echo json_encode([
            'status' => 'success',
            'message' => 'Aset berhasil diperbarui dan disimpan permanen di cPanel',
            'aset' => $item,
            'totalAset' => count($asets)
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

        $lockFp = acquireDbLock($dbFile);
        $db = getDatabase($dbFile) ?: [];
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
        releaseDbLock($lockFp);
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
