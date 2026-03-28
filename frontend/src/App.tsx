import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SubmitArticle from './pages/SubmitArticle';
import QuotesBrowser from './pages/QuotesBrowser';
import QuotesHome from './pages/QuotesHome';
import People from './pages/People';
import PersonProfile from './pages/PersonProfile';
import Admin from './pages/Admin';
import BulkSubmit from './pages/BulkSubmit';
import ReviewQueue from './pages/ReviewQueue';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<QuotesHome />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/submit" element={<SubmitArticle />} />
            <Route path="/quotes" element={<QuotesBrowser />} />
            <Route path="/people" element={<People />} />
            <Route path="/people/:id" element={<PersonProfile />} />
            <Route path="/bulk-submit" element={<BulkSubmit />} />
            <Route path="/review" element={<ReviewQueue />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
