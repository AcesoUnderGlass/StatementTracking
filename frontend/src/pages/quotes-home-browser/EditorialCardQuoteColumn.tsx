import type { QuoteWithDetails } from '../../types';

const EditorialCardQuoteColumn = ({quote}:{quote: QuoteWithDetails}) => {
  return (
    <div
      className="bg-white transition-all duration-300 flex flex-col justify-center px-3 pt-5 pb-5 md:px-6"
    >
        <p className="text-sm leading-relaxed pr-0 md:pr-3 md:text-base" style={{ fontFamily: 'Lora, serif', color: '#2d2a26' }}
        >
          &ldquo;{quote.quote_text}&rdquo;
        </p>
    </div>
  );
};

export default EditorialCardQuoteColumn;
