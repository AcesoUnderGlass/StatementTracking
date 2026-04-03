import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import Layout from './components/Layout';
import QuotesHome from './pages/QuotesHome';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const SubmitArticle = lazy(() => import('./pages/SubmitArticle'));
const QuotesBrowser = lazy(() => import('./pages/QuotesBrowser'));
const People = lazy(() => import('./pages/People'));
const PersonProfile = lazy(() => import('./pages/PersonProfile'));
const Admin = lazy(() => import('./pages/Admin'));
const BulkSubmit = lazy(() => import('./pages/BulkSubmit'));
const ReviewQueue = lazy(() => import('./pages/ReviewQueue'));
const FeedHarvest = lazy(() => import('./pages/FeedHarvest'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
          <Routes>
            <Route path="/" element={<QuotesHome />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/submit" element={<SubmitArticle />} />
              <Route path="/quotes" element={<QuotesBrowser />} />
              <Route path="/people" element={<People />} />
              <Route path="/people/:id" element={<PersonProfile />} />
              <Route path="/bulk-submit" element={<BulkSubmit />} />
              <Route path="/feed-harvest" element={<FeedHarvest />} />
              <Route path="/review" element={<ReviewQueue />} />
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Analytics />
    </QueryClientProvider>
  );
}
