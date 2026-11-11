import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Aset } from '../types';
import { getAsetVerificationStatus, AsetVerificationBadge } from '../utils/verificationHelper';
import {
  X,
  Camera,
  FileText,
  Calendar,
  DollarSign,
  Tag,
  MapPin,
  FileCheck2,
  QrCode,
  Maximize2,
  AlertCircle,
  Download,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import { getPhotoUrl, handlePhotoError } from '../utils/photoUrl';

interface AsetDetailModalProps {
  aset: Aset | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenBarcode: (aset: Aset) => void;
}

export const AsetDetailModal: React.FC<AsetDetailModalProps> = ({
  aset,
  isOpen,
  onClose,
  onOpenBarcode,
}) => {
  const { currentUser, batalkanVerifikasiAset } = useApp();
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);
  const [showBatalConfirm, setShowBatalConfirm] = useState<boolean>(false);
  const [isCanceling, setIsCanceling] = useState<boolean>(false);

  if (!isOpen || !aset) return null;

  const isSuperAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin_kecamatan';
  const isVerified = aset.statusVerifikasi === 'sudah_diverifikasi' || (!aset.statusVerifikasi && aset.status === 'aktif');

  const photos = aset.fotoAset && aset.fotoAset.length > 0 ? aset.fotoAset : [];
  const activePhoto = photos[selectedPhotoIndex] || photos[0];

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <>
      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white p-2 rounded-full bg-slate-800/80 cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
            <div className="text-white text-xs sm:text-sm font-semibold bg-slate-900/90 px-4 py-1.5 rounded-full border border-slate-700">
              {lightboxImage.title}
            </div>
            <a
              href={lightboxImage.url}
              download={`${lightboxImage.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-bold text-emerald-300 hover:text-white bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500/40 px-3.5 py-1.5 rounded-full flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
              title="Unduh foto fisik ini dalam resolusi tinggi"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh Foto HD</span>
            </a>
          </div>
          <img
            src={getPhotoUrl(lightboxImage.url)}
            alt={lightboxImage.title}
            onError={handlePhotoError}
            className="max-w-[92vw] max-h-[85vh] object-contain rounded-xl shadow-2xl border border-slate-800"
          />
        </div>
      )}

      {/* Main Detail Modal */}
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-[#0E1526] border border-slate-700 rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto text-slate-100">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header */}
          <div className="flex items-start gap-3 mb-6 pr-8">
            <span className="p-3 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
              <Camera className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {aset.klasifikasi}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  {aset.desaName}
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                  KODE: {aset.kodeAset}
                </span>
                <AsetVerificationBadge statusInfo={getAsetVerificationStatus(aset)} size="sm" />
              </div>
              <h2 className="text-lg font-bold text-white leading-snug">
                {aset.namaAset}
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Photos Gallery & BAST (7 cols) */}
            <div className="lg:col-span-7 space-y-5">
              {/* Foto Fisik Aset */}
              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Foto Fisik Aset ({photos.length} Foto)
                    </h3>
                  </div>
                  {photos.length > 0 && (
                    <span className="text-[11px] text-slate-400">
                      Foto {selectedPhotoIndex + 1} dari {photos.length}
                    </span>
                  )}
                </div>

                {photos.length === 0 ? (
                  <div className="py-12 flex flex-col items-center justify-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-500">
                    <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-xs">Belum ada foto fisik aset diunggah</p>
                  </div>
                ) : (
                  <div>
                    {/* Big Active Photo */}
                    <div className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center aspect-video max-h-[300px]">
                      <img
                        src={getPhotoUrl(activePhoto)}
                        alt={`Foto Aset ${selectedPhotoIndex + 1}`}
                        onError={handlePhotoError}
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxImage({
                            url: activePhoto,
                            title: `Foto Fisik ${selectedPhotoIndex + 1} - ${aset.namaAset}`,
                          })
                        }
                        className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Perbesar</span>
                      </button>
                    </div>

                    {/* Thumbnails */}
                    {photos.length > 1 && (
                      <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
                        {photos.map((p, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedPhotoIndex(idx)}
                            className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all cursor-pointer ${
                              selectedPhotoIndex === idx
                                ? 'border-amber-400 scale-105 shadow-md shadow-amber-400/20'
                                : 'border-slate-800 opacity-60 hover:opacity-100'
                            }`}
                          >
                            <img
                              src={getPhotoUrl(p)}
                              alt={`Thumbnail ${idx + 1}`}
                              onError={handlePhotoError}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Foto BAST Aset kepada Pengguna */}
              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800">
                <div className="flex items-center gap-2 mb-3">
                  <FileCheck2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Foto BAST Aset Kepada Pengguna (Berita Acara Serah Terima)
                  </h3>
                </div>

                {aset.fotoBast ? (
                  <div className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center aspect-video max-h-[200px]">
                    <img
                      src={getPhotoUrl(aset.fotoBast)}
                      alt="Foto BAST Aset kepada Pengguna"
                      onError={handlePhotoError}
                      className="w-full h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          url: aset.fotoBast!,
                          title: `Dokumen BAST Aset Kepada Pengguna - ${aset.namaAset}`,
                        })
                      }
                      className="absolute bottom-3 right-3 p-2 rounded-lg bg-black/70 hover:bg-black/90 text-white text-xs flex items-center gap-1.5 transition-all shadow-lg cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Perbesar Dokumen</span>
                    </button>
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center bg-slate-950/60 rounded-xl border border-dashed border-slate-800 text-slate-500">
                    <FileText className="w-6 h-6 mb-1 opacity-50" />
                    <p className="text-xs">Foto BAST Aset kepada Pengguna belum diunggah</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Asset Details & Quick Actions (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 space-y-3.5 text-xs">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider border-b border-slate-800 pb-2">
                  Informasi Lengkap Aset Tetap
                </h3>

                <div className="space-y-2.5">
                  <div className="flex items-start justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-slate-500" /> Klasifikasi
                    </span>
                    <span className="font-semibold text-white text-right max-w-[180px]">
                      {aset.klasifikasi}
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" /> Nilai Perolehan
                    </span>
                    <span className="font-bold text-emerald-400 font-mono">
                      {formatRupiah(aset.nilaiPerolehan)}
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" /> Tahun Perolehan
                    </span>
                    <span className="font-semibold text-white">
                      {aset.tahunPerolehan} ({aset.sumberDana})
                    </span>
                  </div>

                  <div className="flex items-start justify-between">
                    <span className="text-slate-400">Kondisi Fisik</span>
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        aset.kondisi === 'Baik'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : aset.kondisi === 'Rusak Ringan'
                          ? 'bg-amber-950 text-amber-300 border border-amber-500/40'
                          : 'bg-red-950 text-red-300 border border-red-500/40'
                      }`}
                    >
                      {aset.kondisi}
                    </span>
                  </div>

                  {aset.volume && (
                    <div className="flex items-start justify-between">
                      <span className="text-slate-400">Volume / Luas</span>
                      <span className="font-medium text-slate-200">{aset.volume}</span>
                    </div>
                  )}

                  {aset.lokasi && (
                    <div className="flex items-start justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" /> Lokasi
                      </span>
                      <span className="font-medium text-slate-200 text-right max-w-[180px]">
                        {aset.lokasi}
                      </span>
                    </div>
                  )}

                  {(aset.merk || aset.tipe || aset.nomorSeri) && (
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <div className="text-slate-400 font-medium">Spesifikasi Barang / Aset:</div>
                      <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1 font-mono">
                        {aset.merk && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Merk:</span>
                            <span className="text-emerald-400 font-bold">{aset.merk}</span>
                          </div>
                        )}
                        {aset.tipe && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">Type:</span>
                            <span className="text-slate-200">{aset.tipe}</span>
                          </div>
                        )}
                        {aset.nomorSeri && (
                          <div className="flex justify-between">
                            <span className="text-slate-400 font-sans">No. Seri:</span>
                            <span className="text-amber-300 font-bold">{aset.nomorSeri}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-slate-400 font-medium mb-1">Bukti Kepemilikan:</div>
                    <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-0.5">
                      <div className="font-bold text-amber-300">{aset.bukti.jenis}</div>
                      <div className="text-slate-300">Nomor: {aset.bukti.nomor || '-'}</div>
                      <div className="text-slate-400">Tanggal: {aset.bukti.tanggal || '-'}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <div className="text-slate-400 font-medium mb-1">Status Verifikasi & Validasi:</div>
                    <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-[11px] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Status:</span>
                        <AsetVerificationBadge statusInfo={getAsetVerificationStatus(aset)} size="sm" />
                      </div>
                      {aset.diverifikasiOleh && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Diverifikasi Oleh:</span>
                          <span className="text-emerald-400 font-bold">{aset.diverifikasiOleh}</span>
                        </div>
                      )}
                      {aset.tanggalVerifikasi && (
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400">Tanggal:</span>
                          <span className="text-slate-300 font-mono">{aset.tanggalVerifikasi}</span>
                        </div>
                      )}
                      {aset.catatanVerifikasi && (
                        <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-900">
                          &quot;{aset.catatanVerifikasi}&quot;
                        </div>
                      )}
                    </div>

                    {/* Super Admin / Admin Kecamatan: Batalkan Pengesahan Action */}
                    {isVerified && isSuperAdmin && (
                      <div className="mt-2.5">
                        {!showBatalConfirm ? (
                          <button
                            type="button"
                            onClick={() => setShowBatalConfirm(true)}
                            className="w-full py-1.5 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Batalkan pengesahan aset ini dan kembalikan ke status sedang diproses"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                            <span>Batalkan Pengesahan Aset Ini</span>
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/50 text-[11px] space-y-2 animate-fade-in">
                            <div className="flex items-start gap-1.5 text-rose-200">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                              <span>Batalkan pengesahan dan kembalikan ke antrean verifikasi?</span>
                            </div>
                            <div className="flex justify-end gap-1.5 pt-0.5">
                              <button
                                type="button"
                                disabled={isCanceling}
                                onClick={() => setShowBatalConfirm(false)}
                                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold cursor-pointer"
                              >
                                Batal
                              </button>
                              <button
                                type="button"
                                disabled={isCanceling}
                                onClick={async () => {
                                  setIsCanceling(true);
                                  try {
                                    await batalkanVerifikasiAset(aset.id);
                                    setShowBatalConfirm(false);
                                    onClose();
                                  } finally {
                                    setIsCanceling(false);
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <RotateCcw className={`w-3 h-3 ${isCanceling ? 'animate-spin' : ''}`} />
                                <span>{isCanceling ? 'Memproses...' : 'Ya, Batalkan'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {aset.keterangan && (
                    <div className="pt-2 border-t border-slate-800">
                      <div className="text-slate-400 font-medium mb-1">Keterangan:</div>
                      <p className="text-slate-300 text-[11px] italic bg-slate-950/50 p-2 rounded border border-slate-800">
                        "{aset.keterangan}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Print Barcode Action Button */}
                <div className="pt-4 border-t border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => onOpenBarcode(aset)}
                    className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Cetak Barcode / Label Aset</span>
                  </button>

                  <p className="text-[10px] text-slate-400 text-center">
                    Cetak barcode Code128 & QR code untuk inventaris barang milik desa
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
