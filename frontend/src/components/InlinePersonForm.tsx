import { useState } from 'react';
import type { PersonCreate, SpeakerType } from '../types';

interface Props {
  defaultName?: string;
  defaultType?: SpeakerType;
  onSave: (person: PersonCreate) => void;
  onCancel: () => void;
}

const PARTIES = ['Democrat', 'Republican', 'Independent', 'Other'];
const CHAMBERS = ['Senate', 'House', 'Executive', 'Other'];
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const IS_ORG_TYPE = (t: SpeakerType) => t === 'think_tank' || t === 'gov_inst';

export default function InlinePersonForm({ defaultName = '', defaultType = 'elected', onSave, onCancel }: Props) {
  const [form, setForm] = useState<PersonCreate>({
    name: defaultName,
    type: defaultType,
    party: null,
    role: null,
    chamber: null,
    state: null,
    employer: null,
  });

  const isOrg = IS_ORG_TYPE(form.type);

  function update(field: string, value: string | null) {
    const next: Partial<PersonCreate> = { [field]: value || null };
    if (field === 'type' && value && IS_ORG_TYPE(value as SpeakerType)) {
      next.party = null;
      next.chamber = null;
      next.state = null;
      next.employer = null;
    }
    setForm((prev) => ({ ...prev, ...next }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3"
    >
      <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        New Speaker
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <input
            type="text"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder={isOrg ? 'Organization name' : 'Full name'}
            className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-sm"
            required
          />
        </div>

        <select
          value={form.type}
          onChange={(e) => update('type', e.target.value)}
          className="px-2.5 py-1.5 border border-slate-300 rounded text-sm"
        >
          <option value="elected">Elected</option>
          <option value="staff">Staff</option>
          <option value="think_tank">Think Tank</option>
          <option value="gov_inst">Gov. Institution</option>
        </select>

        {!isOrg && (
          <select
            value={form.party || ''}
            onChange={(e) => update('party', e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded text-sm"
          >
            <option value="">Party...</option>
            {PARTIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}

        <input
          type="text"
          value={form.role || ''}
          onChange={(e) => update('role', e.target.value)}
          placeholder={isOrg ? 'Description (e.g. Federal Agency)' : 'Role (e.g. Senator)'}
          className="px-2.5 py-1.5 border border-slate-300 rounded text-sm"
        />

        {!isOrg && (
          <>
            <select
              value={form.chamber || ''}
              onChange={(e) => update('chamber', e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-sm"
            >
              <option value="">Chamber...</option>
              {CHAMBERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select
              value={form.state || ''}
              onChange={(e) => update('state', e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-sm"
            >
              <option value="">State...</option>
              {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </>
        )}

        {form.type === 'staff' && (
          <input
            type="text"
            value={form.employer || ''}
            onChange={(e) => update('employer', e.target.value)}
            placeholder="Employer"
            className="px-2.5 py-1.5 border border-slate-300 rounded text-sm"
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 font-medium"
        >
          Create Speaker
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
