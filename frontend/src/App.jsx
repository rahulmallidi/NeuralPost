import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';

// Route-level code splitting — each page loads only when navigated to.
// This reduces initial bundle size and improves Lighthouse TTI/FCP.
const Home              = lazy(() => import('./pages/Home'));
const Explore           = lazy(() => import('./pages/Explore'));
const Post              = lazy(() => import('./pages/Post'));
const Blog              = lazy(() => import('./pages/Blog'));
const Login             = lazy(() => import('./pages/Auth/Login'));
const Register          = lazy(() => import('./pages/Auth/Register'));
const DashboardOverview = lazy(() => import('./pages/Dashboard/Overview'));
const DashboardPosts    = lazy(() => import('./pages/Dashboard/Posts'));
const DashboardEditor   = lazy(() => import('./pages/Dashboard/Editor'));
const DashboardAnalytics = lazy(() => import('./pages/Dashboard/Analytics'));
const SearchInsights    = lazy(() => import('./pages/Dashboard/SearchInsights'));

function PageLoader() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-6 h-6 rounded-full border-2 border-amber border-t-transparent animate-spin" />
    </div>
  );
}

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Explore />} />
            <Route path="/blog/:blogSlug" element={<Blog />} />
            <Route path="/blog/:blogSlug/:slug" element={<Post />} />
            <Route path="/posts/:slug" element={<Post />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/dashboard" element={<PrivateRoute><DashboardOverview /></PrivateRoute>} />
            <Route path="/dashboard/posts" element={<PrivateRoute><DashboardPosts /></PrivateRoute>} />
            <Route path="/dashboard/editor" element={<PrivateRoute><DashboardEditor /></PrivateRoute>} />
            <Route path="/dashboard/editor/:id" element={<PrivateRoute><DashboardEditor /></PrivateRoute>} />
            <Route path="/dashboard/analytics" element={<PrivateRoute><DashboardAnalytics /></PrivateRoute>} />
            <Route path="/dashboard/search-insights" element={<PrivateRoute><SearchInsights /></PrivateRoute>} />
          </Routes>
        </Suspense>
      </main>
    </div>
  );
}
