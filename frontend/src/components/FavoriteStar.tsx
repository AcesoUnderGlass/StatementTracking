import { Star } from 'lucide-react';
import { useMe } from '../auth/useMe';
import { useFavoriteIds, useToggleFavorite } from '../auth/useFavorites';

interface Props {
  quoteId: number;
  size?: number;
  className?: string;
  /**
   * Disable the click handler's `e.stopPropagation()` call. Useful
   * when the parent surface doesn't have a click target of its own
   * (e.g. the QuoteDetail page).
   */
  bubble?: boolean;
}

export default function FavoriteStar({
  quoteId,
  size = 16,
  className = '',
  bubble = false,
}: Props) {
  const { me } = useMe();
  const { ids } = useFavoriteIds();
  const toggle = useToggleFavorite();

  if (!me) return null;

  const isFavorited = ids.has(quoteId);

  return (
    <button
      type="button"
      aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
      aria-pressed={isFavorited}
      onClick={(e) => {
        if (!bubble) e.stopPropagation();
        toggle.mutate({ quoteId, next: !isFavorited });
      }}
      className={`inline-flex items-center justify-center rounded p-1 transition-colors hover:bg-amber-50 ${
        isFavorited ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'
      } ${className}`}
    >
      <Star
        size={size}
        strokeWidth={1.75}
        fill={isFavorited ? 'currentColor' : 'none'}
      />
    </button>
  );
}
