import { useState } from 'react';
import { gameGuide, type GuideGameId } from '../platform/games/gameGuides';

interface Props {
  gameId: GuideGameId;
  onFinish: () => void;
  finishLabel?: string;
  showSkip?: boolean;
}

export function GameGuideContent({ gameId, onFinish, finishLabel = 'Back to game', showSkip = false }: Props) {
  const guide = gameGuide(gameId);
  const [step, setStep] = useState(0);
  const slide = guide.slides[step];
  const isLast = step === guide.slides.length - 1;

  return (
    <>
      <div className="tutorial-modal__gamebar">
        <div>
          <p className="tutorial-modal__game">{guide.gameName}</p>
          <p className="tutorial-modal__subtitle">{guide.subtitle}</p>
        </div>
        <span className="tutorial-modal__count" aria-label={`Slide ${step + 1} of ${guide.slides.length}`}>
          {String(step + 1).padStart(2, '0')} / {String(guide.slides.length).padStart(2, '0')}
        </span>
      </div>

      <div className="tutorial-modal__slide">
        <div className="tutorial-modal__medallion" aria-hidden="true">
          {String(step + 1).padStart(2, '0')}
        </div>
        <p className="tutorial-modal__eyebrow">{slide.eyebrow}</p>
        <h3 className="tutorial-modal__title">{slide.title}</h3>
        <p className="tutorial-modal__body">{slide.body}</p>
        {slide.points && (
          <ul className="tutorial-modal__points">
            {slide.points.map((point) => <li key={point}>{point}</li>)}
          </ul>
        )}
      </div>

      <div className="tutorial-modal__dots" aria-hidden="true">
        {guide.slides.map((_, i) => (
          <span key={i} className={`tutorial-modal__dot ${i === step ? 'tutorial-modal__dot--active' : ''}`} />
        ))}
      </div>

      <div className="tutorial-modal__actions">
        {showSkip && (
          <button className="btn btn-ghost tutorial-modal__skip" onClick={onFinish}>
            Skip guide
          </button>
        )}
        <div className="tutorial-modal__nav">
          {step > 0 && (
            <button className="btn btn-ghost" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
          )}
          <button className="btn btn-primary" onClick={isLast ? onFinish : () => setStep((s) => s + 1)}>
            {isLast ? finishLabel : 'Next'}
          </button>
        </div>
      </div>
    </>
  );
}
