import { useRef, useState } from 'react';
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up';
import Heart from 'lucide-react/dist/esm/icons/heart';
import Sparkles from 'lucide-react/dist/esm/icons/sparkles';
import './MobileOnboarding.css';

interface MobileOnboardingProps {
  onSignIn: () => void;
}

const SLIDES = [
  {
    icon: TrendingUp,
    bars: [34, 58, 42, 72, 60, 88],
    title: 'Data stories, beautifully told',
    body: 'Chartsuno turns raw numbers into charts worth sharing — designed, not defaulted.',
  },
  {
    icon: Heart,
    bars: [62, 44, 78, 56, 90, 70],
    title: 'A feed of live charts',
    body: 'See what the community is publishing. Like your favorites, save the keepers, share the best.',
  },
  {
    icon: Sparkles,
    bars: [28, 66, 48, 84, 58, 96],
    title: 'Create with AI',
    body: 'Paste data, a screenshot, or just a prompt — get a publishable chart in seconds.',
  },
] as const;

// First-launch onboarding: three swipeable value-prop slides ending in an
// account requirement before entering the app.
export function MobileOnboarding({ onSignIn }: MobileOnboardingProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    setActiveIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  const scrollTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const isLastSlide = activeIndex === SLIDES.length - 1;

  return (
    <div className="onboard" role="dialog" aria-label="Welcome to Chartsuno">
      <header className="onboard__top">
        <span className="onboard__brand"><img src="/favicon.svg" width="32" height="32" alt="" />Chartsuno</span>
        <button type="button" className="onboard__skip" onClick={onSignIn}>
          Sign in
        </button>
      </header>

      <div className="onboard__track" ref={trackRef} onScroll={handleScroll}>
        {SLIDES.map((slide) => (
          <section key={slide.title} className="onboard__slide">
            <div className="onboard__visual" aria-hidden="true">
              <div className="onboard__bars">
                {slide.bars.map((height, barIndex) => (
                  <span
                    key={barIndex}
                    className="onboard__bar"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
              <span className="onboard__visual-icon">
                <slide.icon size={22} />
              </span>
            </div>
            <h2 className="onboard__title">{slide.title}</h2>
            <p className="onboard__body">{slide.body}</p>
          </section>
        ))}
      </div>

      <div className="onboard__dots" role="group" aria-label="Onboarding progress">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            aria-current={index === activeIndex ? 'step' : undefined}
            aria-label={`Slide ${index + 1}`}
            className={`onboard__dot ${index === activeIndex ? 'onboard__dot--active' : ''}`}
            onClick={() => scrollTo(index)}
          />
        ))}
      </div>

      <footer className="onboard__cta">
        {isLastSlide ? (
          <>
            <button type="button" className="onboard__btn onboard__btn--primary" onClick={onSignIn}>
              Create an account
            </button>
            <button type="button" className="onboard__btn onboard__btn--ghost" onClick={onSignIn}>
              Already have an account? Sign in
            </button>
          </>
        ) : (
          <button
            type="button"
            className="onboard__btn onboard__btn--primary"
            onClick={() => scrollTo(activeIndex + 1)}
          >
            Continue
          </button>
        )}
      </footer>
    </div>
  );
}
