import Image from 'next/image'
import { cn } from '@/lib/utils'

const PHONE_IMAGE_SRC = '/dashmockupv1.png'

type PhoneMockupProps = {
  className?: string
}

export function PhoneMockup({ className = '' }: PhoneMockupProps) {
  return (
    <Image
      src={PHONE_IMAGE_SRC}
      alt="FlexPT dashboard on mobile"
      width={941}
      height={1672}
      priority
      unoptimized
      sizes="(max-width: 1024px) 38vw, 392px"
      className={cn('block h-auto w-full max-w-[941px] object-contain', className)}
    />
  )
}
