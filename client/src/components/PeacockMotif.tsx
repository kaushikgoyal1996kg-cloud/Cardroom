/**
 * Legacy component name kept to avoid a broad import churn. The visual itself
 * is now the approved Card Room doorway/table emblem, replacing the old
 * concentric-eye mark everywhere this component is still used.
 */
export function PeacockMotif({ size = 64 }: { size?: number }) {
  return (
    <img
      src="/brand/card-room-emblem.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      className="card-room-motif"
      style={{ borderRadius: '22%', objectFit: 'cover' }}
    />
  );
}
