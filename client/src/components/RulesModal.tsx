import type { GuideGameId } from '../platform/games/gameGuides';
import { GameGuideContent } from './GameGuideContent';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './RulesModal.css';
import './TutorialModal.css';

export function RulesModal({ gameId, onClose }: { gameId: GuideGameId; onClose: () => void }) {
  return (
    <div className="rules-overlay" onClick={onClose}>
      <div className="rules-panel panel tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel__header">
          <div>
            <p className="rules-panel__eyebrow">Game guide</p>
            <h2>Rules &amp; How to Play</h2>
          </div>
          <button className="btn btn-ghost rules-close" onClick={onClose} aria-label="Close game guide">
            <ChromeIcon name="close" />
          </button>
        </div>
        <GameGuideContent gameId={gameId} onFinish={onClose} />
      </div>
    </div>
  );
}
