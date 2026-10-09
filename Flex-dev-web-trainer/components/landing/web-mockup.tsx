import Image from 'next/image'
import { cn } from '@/lib/utils'

const WEB_IMAGE_SRC = '/finalweb.png'

type WebMockupProps = {
  className?: string
}

export function WebMockup({ className = '' }: WebMockupProps) {
  return (
    <Image
      src={WEB_IMAGE_SRC}
      alt="FlexPT dashboard on desktop"
      width={1536}
      height={1024}
      unoptimized
      sizes="67vw"
      className={cn('h-auto w-full max-w-[1536px] object-contain', className)}
    />
  )
}
