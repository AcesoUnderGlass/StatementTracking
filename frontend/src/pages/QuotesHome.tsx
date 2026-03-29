import QuotesHomeBrowser from './quotes-home-browser/QuotesHomeBrowser';

export default function QuotesHome() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="overflow-auto">
        <div className="max-w-5xl mx-auto px-2 md:px-6 py-8">
          <QuotesHomeBrowser />
        </div>
      </main>
    </div>
  );
}
