import { Link } from 'react-router-dom';
import type { QuoteWithDetails } from '../../types';

const EditorialCardPersonColumn = ({quote}:{quote: QuoteWithDetails}) => {
  const dateSaidFormatted = quote.date_said
    ? new Date(quote.date_said).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : null;

  return (
    <div
      className="bg-white transition-all duration-300 flex flex-col justify-center px-3 pt-5 pb-5 md:px-4 shadow-sm max-md:shadow-none"
    >
      <div className="min-w-0" style={{ fontFamily: 'Playfair Display, serif' }}>
        {quote.person ? (
          <Link
            to={`/people/${quote.person.id}`}
            className="font-semibold hover:underline block"
            style={{ color: '#1a1a2e' }}
            onClick={(e) => e.stopPropagation()}
          >
            {quote.person.name}
          </Link>
        ) : (
          <span style={{ color: '#6b6560' }}>Unknown</span>
        )}
        {quote.person?.role && (
          <p className="text-sm mt-1" style={{ color: '#4a4540' }}>
            {quote.person.role}
          </p>
        )}
        {dateSaidFormatted && (
          <p className="text-sm mt-1 opacity-50">
            {dateSaidFormatted}
          </p>
        )}
      </div>
    </div>
  );
};

export default EditorialCardPersonColumn;
