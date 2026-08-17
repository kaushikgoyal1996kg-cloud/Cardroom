import { markTutorialSeen } from '../lib/tutorial';
import type { GuideGameId } from '../platform/games/gameGuides';
import { GameGuideContent } from './GameGuideContent';
import { ChromeIcon } from '../platform/components/ChromeIcon';
import './RulesModal.css';
import './TutorialModal.css';

interface Props {
  gameId: GuideGameId;
  onClose: () => void;
}

export function TutorialModal({ gameId, onClose }: Props) {
  function finish() {
    markTutorialSeen(gameId);
    onClose();
  }

  return (
    <div className="rules-overlay" onClick={finish}>
      <div className="rules-panel panel tutorial-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-panel__header">
          <div>
            <p className="rules-panel__eyebrow">First time at this table</p>
            <h2>Rules &amp; How to Play</h2>
          </div>
          <button className="rules-close btn btn-ghost" onClick={finish} aria-label="Close game guide">
            <ChromeIcon name="close" />
          </button>
        </div>
        <GameGuideContent gameId={gameId} onFinish={finish} finishLabel="Enter table" showSkip />
      </div>
    </div>
  );
}
