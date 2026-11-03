'use client';

import Image from 'next/image';

import { Wordmark } from './Wordmark';

/** Official woven logo mark + wordmark (WANDERLOOM in English, «واندرلوم» in Arabic). */
export function BrandMark({
  size = 40,
  wordmarkClassName = 'text-xl sm:text-2xl text-[#1C2E3A]',
  showWordmark = true,
}: {
  size?: number;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-2.5" dir="ltr">
      <Image
        src="/brand/wanderloom-mark.png"
        alt=""
        width={size}
        height={size}
        priority
        className="shrink-0 object-contain"
        style={{ width: size, height: size }}
      />
      {showWordmark ? <Wordmark className={wordmarkClassName} /> : null}
    </span>
  );
}
