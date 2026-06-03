import { cn } from '@/lib/utils'
import { PhoneMockup } from '@/components/landing/phone-mockup'
import { WebMockup } from '@/components/landing/web-mockup'

type HeroMockupCarouselProps = {
  className?: string
}

/**
 * Layered tablet + phone in one aspect box. Below 900px sizes scale up together
 * via shared % offsets so their relative positions stay consistent.
 */
export function HeroMockupCarousel({ className = '' }: HeroMockupCarouselProps) {
  return (
    <div
      className={cn(
        'landing-mockup-shell mx-auto w-full max-w-[26rem] overflow-visible pb-12 sm:max-w-[32rem] sm:pb-14 md:max-w-[38rem]',
        'min-[900px]:max-w-none min-[900px]:pb-0',
        className
      )}
    >
      <div
        className={cn(
          'landing-mockup-stage relative mx-auto aspect-[5/3] w-full overflow-visible [perspective:1200px]',
          'min-[900px]:max-h-[min(70dvh,40rem)]'
        )}
        aria-label="FlexPT on desktop and mobile"
      >
        <WebMockup className="landing-mockup-web absolute z-0 h-auto object-contain drop-shadow-md" />

        <div className="landing-mockup-phone hero-phone-slot absolute z-10 max-w-[941px] [transform:rotateY(-14deg)_rotateZ(2deg)]">
          <PhoneMockup />
        </div>
      </div>
    </div>
  )
}
