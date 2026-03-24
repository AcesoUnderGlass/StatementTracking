import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import SubmitArticle from './pages/SubmitArticle';
import QuotesBrowser from './pages/QuotesBrowser';
import People from './pages/People';
import PersonProfile from './pages/PersonProfile';
import Admin from './pages/Admin';

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
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/quotes" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/submit" element={<SubmitArticle />} />
            <Route path="/quotes" element={<QuotesBrowser />} />
            <Route path="/people" element={<People />} />
            <Route path="/people/:id" element={<PersonProfile />} />
            <Route path="/admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
