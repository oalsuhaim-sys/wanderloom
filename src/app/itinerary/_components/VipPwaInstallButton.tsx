'use client';

import PwaInstallButton from '@/components/PwaInstallButton';

type Props = {
  className?: string;
  label?: string;
};

/** زر تثبيت PWA — للمسارات العامة والعميل */
export default function VipPwaInstallButton({
  className = '',
  label = 'تثبيت تطبيق Wanderloom',
}: Props) {
  return <PwaInstallButton className={className} label={label} variant="default" />;
}
