import QuotesHomeBrowser from './quotes-home-browser/QuotesHomeBrowser';

export default function QuotesHome() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="overflow-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <QuotesHomeBrowser />
        </div>
      </main>
    </div>
  );
}
