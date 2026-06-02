import { cn } from '@/lib/utils'
import { PhoneMockup } from '@/components/landing/phone-mockup'
import { WebMockup } from '@/components/landing/web-mockup'

type HeroMockupCarouselProps = {
  className?: string
}

/**
 * One relative box (fills the hero graphics flex child). Tablet + phone are
 * absolutely positioned inside it using % of this box — not a second flex row.
 */
export function HeroMockupCarousel({ className = '' }: HeroMockupCarouselProps) {
  return (
    <div
      className={cn(
        'relative mx-auto aspect-[5/3] w-full max-w-[44rem] overflow-visible [perspective:1200px] md:max-w-none',
        className
      )}
      aria-label="FlexPT on desktop and mobile"
    >
      {/* Tablet */}
      <WebMockup className="absolute bottom-[-6%] left-[-16%] z-0 h-auto w-[138%] max-h-[110%] object-contain drop-shadow-md sm:bottom-[-5%] sm:left-[-13%] sm:w-[132%] sm:max-h-[108%] md:bottom-[-4%] md:left-[-10%] md:w-[122%] md:max-h-[107%]" />

      {/* Phone */}
      <div className="hero-phone-slot absolute top-[22%] right-[-7%] z-10 w-[46%] max-w-[941px] [transform:rotateY(-14deg)_rotateZ(2deg)] sm:top-[20%] sm:right-[-6%] sm:w-[42%] md:top-[18%] md:right-[-4%] md:w-[38%]">
        <PhoneMockup />
      </div>
    </div>
  )
}
