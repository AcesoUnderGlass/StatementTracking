import PersonTypeahead from './PersonTypeahead';
import type { PersonCreate, SpeakerType } from '../types';

export interface QuoteCardData {
  speaker_name: string;
  speaker_title: string | null;
  speaker_type: SpeakerType | null;
  quote_text: string;
  context: string | null;
  approved: boolean;
  person_id: number | null;
  new_person: PersonCreate | null;
}

interface Props {
  data: QuoteCardData;
  index: number;
  onChange: (index: number, updated: Partial<QuoteCardData>) => void;
  onDelete: (index: number) => void;
}

export default function QuoteCard({ data, index, onChange, onDelete }: Props) {
  return (
    <div
      className={`border rounded-xl p-5 transition-all ${
        data.approved
          ? 'border-blue-200 bg-white shadow-sm'
          : 'border-slate-200 bg-slate-50 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 mr-4">
          <PersonTypeahead
            initialName={data.speaker_name}
            defaultType={data.speaker_type || undefined}
            selectedPersonId={data.person_id}
            hasAssignment={!!(data.person_id || data.new_person)}
            onSelect={(personId) =>
              onChange(index, { person_id: personId, new_person: null })
            }
            onCreateNew={(person) =>
              onChange(index, { new_person: person, person_id: null })
            }
            onClear={() =>
              onChange(index, { person_id: null, new_person: null })
            }
          />
          {data.speaker_title && (
            <p className="text-xs text-slate-400 mt-1">{data.speaker_title}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => onChange(index, { approved: !data.approved })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              data.approved
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-red-100 text-red-700 hover:bg-red-200'
            }`}
          >
            {data.approved ? 'Approved' : 'Excluded'}
          </button>
          <button
            onClick={() => onDelete(index)}
            className="px-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Remove quote"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Quote
          </label>
          <textarea
            value={data.quote_text}
            onChange={(e) => onChange(index, { quote_text: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Context
          </label>
          <textarea
            value={data.context || ''}
            onChange={(e) => onChange(index, { context: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-y"
          />
        </div>
      </div>
    </div>
  );
}
