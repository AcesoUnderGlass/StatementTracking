import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link2, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchSpeakerSources } from '../../api/client';

const SpeakerSourcesList = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['speaker-sources'],
    queryFn: fetchSpeakerSources,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const pillRowsRef = useRef<HTMLDivElement>(null);

  const speakerRows = data?.speakers ?? [];
  const totalQuotes = data?.total_quotes ?? 0;
  const totalSources = speakerRows.reduce((acc, row) => acc + row.source_count, 0);
  const sortedSpeakerRows = [...speakerRows].sort((a, b) => {
    if (b.source_count !== a.source_count) return b.source_count - a.source_count;
    if (b.quote_count !== a.quote_count) return b.quote_count - a.quote_count;
    return a.name.localeCompare(b.name);
  });

  useEffect(() => {
    const pillRowsElement = pillRowsRef.current;
    if (!pillRowsElement) return;
    setHasOverflow(pillRowsElement.scrollHeight > pillRowsElement.clientHeight + 1);
  }, [sortedSpeakerRows.length, isExpanded]);

  if (isLoading || speakerRows.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex w-full justify-between items-center">
        <p className="text-xs mb-2 flex" style={{ color: '#8a8070' }}>
          {speakerRows.length} {speakerRows.length === 1 ? 'speaker' : 'speakers'}, {totalSources} {totalSources === 1 ? 'source' : 'sources'}, {totalQuotes} {totalQuotes === 1 ? 'quote' : 'quotes'}
        </p>
        <button
          type="button"
          className="text-xs mt-2"
          style={{ color: '#6b6050' }}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Show less' : 'Show all'}
        </button>
      </div>
      <div
        ref={pillRowsRef}
        className="flex flex-wrap gap-2 text-sm"
        style={{ fontFamily: 'Lora, serif', color: '#2d2a26', maxHeight: isExpanded ? undefined : 64, overflow: 'hidden' }}
      >
        {sortedSpeakerRows.map((speakerRow) => (
          <div
            key={speakerRow.person_id}
            className="rounded-sm px-2 py-1 flex gap-2 font-sans"
            style={{ background: '#f4efe6' }}
          >
            <Link to={`/people/${speakerRow.person_id}`} className="hover:underline font-semibold">
              {speakerRow.name}
            </Link>{' '}
            <span className="inline-flex items-center gap-0.5 opacity-60 text-xs font-medium">{speakerRow.quote_count} ({speakerRow.source_count})</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SpeakerSourcesList;
