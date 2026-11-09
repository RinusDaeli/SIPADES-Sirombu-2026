import React from 'react';
import { Aset, PermohonanVerifikasi, PengesahanLaporan } from '../types';
import { CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export type VerificationStatusType = 'sudah_diverifikasi' | 'sedang_diproses' | 'belum_diverifikasi' | 'perlu_perbaikan';

export interface VerificationStatusInfo {
  status: VerificationStatusType;
  label: string;
  badgeFullClass: string;
  dotClass: string;
  iconColor: string;
  iconType: 'check' | 'clock' | 'alert';
  description: string;
}

/**
 * Resolves the visual verification status for an asset.
 * Prioritizes explicit status on asset, permohonan verifikasi (mutasi/penghapusan),
 * and pengesahan laporan, with sensible heuristic for standard assets.
 */
export function getAsetVerificationStatus(
  aset: Aset,
  verifikasiList: PermohonanVerifikasi[] = [],
  pengesahanList: PengesahanLaporan[] = []
): VerificationStatusInfo {
  // 1. Explicit statusVerifikasi set on the asset record
  if (aset.statusVerifikasi === 'perlu_perbaikan') {
    return {
      status: 'perlu_perbaikan',
      label: 'Perlu Perbaikan',
      badgeFullClass: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-xs shadow-rose-500/10',
      dotClass: 'bg-rose-400 animate-pulse',
      iconColor: 'text-rose-400',
      iconType: 'alert',
      description: aset.catatanVerifikasi
        ? `Catatan Kecamatan: ${aset.catatanVerifikasi}`
        : 'Aset dikembalikan oleh Tim Kecamatan untuk perbaikan dokumen/foto',
    };
  }

  if (aset.statusVerifikasi === 'sedang_diproses') {
    return {
      status: 'sedang_diproses',
      label: 'Sedang Diproses',
      badgeFullClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-xs shadow-amber-500/10',
      dotClass: 'bg-amber-400 animate-pulse',
      iconColor: 'text-amber-400',
      iconType: 'clock',
      description: 'Sedang dalam proses verifikasi / telaah berkas oleh Tim Kecamatan',
    };
  }

  if (aset.statusVerifikasi === 'sudah_diverifikasi') {
    return {
      status: 'sudah_diverifikasi',
      label: 'Sudah Diverifikasi',
      badgeFullClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-500/10',
      dotClass: 'bg-emerald-400',
      iconColor: 'text-emerald-400',
      iconType: 'check',
      description: aset.catatanVerifikasi
        ? `Diverifikasi: ${aset.catatanVerifikasi}`
        : 'Aset telah diverifikasi dan disahkan oleh Tim Monitoring Kecamatan Sirombu',
    };
  }

  if (aset.statusVerifikasi === 'belum_diverifikasi') {
    return {
      status: 'belum_diverifikasi',
      label: 'Belum Diverifikasi',
      badgeFullClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-xs',
      dotClass: 'bg-amber-400',
      iconColor: 'text-amber-400',
      iconType: 'clock',
      description: 'Menunggu verifikasi oleh Tim Monitoring Kecamatan',
    };
  }

  // 2. Pending mutasi or penghapusan verification request
  const hasPendingVerif = verifikasiList.some(
    (v) => v.asetId === aset.id && v.status === 'menunggu_verifikasi'
  );
  if (hasPendingVerif || aset.status === 'mutasi_diajukan' || aset.status === 'terhapus_diajukan') {
    return {
      status: 'sedang_diproses',
      label: 'Sedang Diproses',
      badgeFullClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-xs shadow-amber-500/10',
      dotClass: 'bg-amber-400 animate-pulse',
      iconColor: 'text-amber-400',
      iconType: 'clock',
      description: 'Permohonan / verifikasi aset sedang diproses oleh Tim Admin Kecamatan',
    };
  }

  // 3. Approved verification request (mutasi / penghapusan disetujui)
  const hasApprovedVerif = verifikasiList.some(
    (v) => v.asetId === aset.id && v.status === 'disetujui'
  );
  if (hasApprovedVerif) {
    return {
      status: 'sudah_diverifikasi',
      label: 'Sudah Diverifikasi',
      badgeFullClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-500/10',
      dotClass: 'bg-emerald-400',
      iconColor: 'text-emerald-400',
      iconType: 'check',
      description: 'Telah diverifikasi dan disahkan oleh Kecamatan Sirombu',
    };
  }

  // 4. Annual report approval by kecamatan
  const isPengesahanDisetujui = pengesahanList.some(
    (p) => p.desaId === aset.desaId && p.tahun === aset.tahunPerolehan && p.status === 'disetujui'
  );
  if (isPengesahanDisetujui) {
    return {
      status: 'sudah_diverifikasi',
      label: 'Sudah Diverifikasi',
      badgeFullClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-500/10',
      dotClass: 'bg-emerald-400',
      iconColor: 'text-emerald-400',
      iconType: 'check',
      description: 'Laporan tahunan aset desa telah disahkan oleh Kecamatan Sirombu',
    };
  }

  // 5. Default for all pre-existing baseline assets:
  // "untuk sekarang, semua aset yang sudah ada, prosesnya sudah verifikasi"
  return {
    status: 'sudah_diverifikasi',
    label: 'Sudah Diverifikasi',
    badgeFullClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 shadow-xs shadow-emerald-500/10',
    dotClass: 'bg-emerald-400',
    iconColor: 'text-emerald-400',
    iconType: 'check',
    description: aset.diverifikasiOleh
      ? `Diverifikasi oleh ${aset.diverifikasiOleh}`
      : 'Aset telah diverifikasi fisik dan dokumen sah oleh Tim Kecamatan Sirombu',
  };
}

interface AsetVerificationBadgeProps {
  statusInfo: VerificationStatusInfo;
  className?: string;
  showIcon?: boolean;
  showDot?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const AsetVerificationBadge: React.FC<AsetVerificationBadgeProps> = ({
  statusInfo,
  className = '',
  showIcon = true,
  showDot = true,
  size = 'sm',
}) => {
  const iconSizeClass = size === 'lg' ? 'w-4 h-4' : size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const dotSizeClass = size === 'lg' ? 'w-2 h-2' : size === 'md' ? 'w-1.5 h-1.5' : 'w-1.5 h-1.5';
  const paddingClass =
    size === 'lg'
      ? 'px-3 py-1.5 text-xs'
      : size === 'md'
      ? 'px-2.5 py-1 text-[11px]'
      : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full transition-all shrink-0 select-none ${paddingClass} ${statusInfo.badgeFullClass} ${className}`}
      title={statusInfo.description}
    >
      {showDot && <span className={`rounded-full shrink-0 ${dotSizeClass} ${statusInfo.dotClass}`} />}
      {showIcon && (
        <>
          {statusInfo.iconType === 'check' && (
            <CheckCircle2 className={`${iconSizeClass} ${statusInfo.iconColor} shrink-0`} />
          )}
          {statusInfo.iconType === 'clock' && (
            <Clock className={`${iconSizeClass} ${statusInfo.iconColor} shrink-0`} />
          )}
          {statusInfo.iconType === 'alert' && (
            <AlertCircle className={`${iconSizeClass} ${statusInfo.iconColor} shrink-0`} />
          )}
        </>
      )}
      <span className="truncate whitespace-nowrap">{statusInfo.label}</span>
    </span>
  );
};
