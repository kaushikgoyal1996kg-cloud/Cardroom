import { useMemo, useState } from 'react';
import { variantsFor, type VariantFamily } from '../games/variantCatalog';
import './GameVariantGallery.css';

interface Props {
  family: VariantFamily;
}

export function GameVariantGallery({ family }: Props) {
  const variants = variantsFor(family);
  const groups = useMemo(() => [...new Set(variants.map((variant) => variant.group))], [variants]);
  const [group, setGroup] = useState(groups[0]);
  const visible = variants.filter((variant) => variant.group === group);
  const title = family === 'POKER' ? 'Poker tables' : 'Teen Patti variants';

  return (
    <section className="variant-gallery" aria-label={title}>
      <header className="variant-gallery__header">
        <div>
          <span className="variant-gallery__eyebrow">Private-table formats planned for The Card Room</span>
          <h3>{title}</h3>
        </div>
        <span className="variant-gallery__count">{variants.length} formats</span>
      </header>

      <div className="variant-gallery__tabs" role="tablist" aria-label={`${title} groups`}>
        {groups.map((name) => (
          <button
            type="button"
            key={name}
            role="tab"
            aria-selected={name === group}
            className={name === group ? 'is-active' : ''}
            onClick={() => setGroup(name)}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="variant-gallery__grid">
        {visible.map((variant) => (
          <article className="variant-tile" key={variant.id}>
            <div className="variant-tile__topline">
              <strong>{variant.name}</strong>
              {variant.shortName && <span>{variant.shortName}</span>}
            </div>
            <p className="variant-tile__meta">{variant.meta}</p>
            <p>{variant.description}</p>
            {variant.note && <small>{variant.note}</small>}
          </article>
        ))}
      </div>
    </section>
  );
}
