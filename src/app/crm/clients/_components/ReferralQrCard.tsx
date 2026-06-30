'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'react-qr-code'
import { Download } from 'lucide-react'

import { buildAffiliateReferralUrl } from '@/lib/referral-url'

const QR_FG = '#1c3d27'
const QR_BG = '#ffffff'
const QR_SIZE = 120

type ReferralQrCardProps = {
  referralCode: string
  className?: string
}

function downloadSvgQrAsPng(svg: SVGSVGElement, filename: string, exportSize = 480) {
  const canvas = document.createElement('canvas')
  canvas.width = exportSize
  canvas.height = exportSize
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const svgData = new XMLSerializer().serializeToString(svg)
  const img = new Image()
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const objectUrl = URL.createObjectURL(svgBlob)

  img.onload = () => {
    ctx.fillStyle = QR_BG
    ctx.fillRect(0, 0, exportSize, exportSize)
    ctx.drawImage(img, 0, 0, exportSize, exportSize)
    URL.revokeObjectURL(objectUrl)
    canvas.toBlob((blob) => {
      if (!blob) return
      const link = document.createElement('a')
      const pngUrl = URL.createObjectURL(blob)
      link.href = pngUrl
      link.download = filename
      link.click()
      URL.revokeObjectURL(pngUrl)
    }, 'image/png')
  }
  img.onerror = () => URL.revokeObjectURL(objectUrl)
  img.src = objectUrl
}

/** باركود الإحالة — للملف الكامل أو داخل نافذة منبثقة */
export default function ReferralQrCard({ referralCode, className = '' }: ReferralQrCardProps) {
  const qrWrapRef = useRef<HTMLDivElement>(null)
  const [referralUrl, setReferralUrl] = useState('')

  const code = referralCode.trim()

  useEffect(() => {
    setReferralUrl(buildAffiliateReferralUrl(code))
  }, [code])

  const handleDownload = useCallback(() => {
    const svg = qrWrapRef.current?.querySelector('svg')
    if (!svg) return
    downloadSvgQrAsPng(svg, `wanderloom-referral-${code}.png`)
  }, [code])

  if (!code) return null

  return (
    <div dir="rtl" className={`flex flex-col items-center text-center ${className}`}>
      <div
        ref={qrWrapRef}
        className="rounded-xl border border-stone-100 bg-white p-4 shadow-sm"
        style={{ lineHeight: 0 }}
      >
        {referralUrl ? (
          <QRCode value={referralUrl} size={QR_SIZE} bgColor={QR_BG} fgColor={QR_FG} />
        ) : (
          <div
            className="animate-pulse rounded-lg bg-stone-100"
            style={{ width: QR_SIZE, height: QR_SIZE }}
            aria-hidden
          />
        )}
      </div>

      <button
        type="button"
        onClick={handleDownload}
        disabled={!referralUrl}
        className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-[#D4AF37]/30 bg-[#1E2720] px-4 py-2 text-[11px] font-bold text-[#D4AF37] shadow-sm transition hover:bg-[#162019] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5" aria-hidden />
        تحميل الباركود
      </button>
    </div>
  )
}
