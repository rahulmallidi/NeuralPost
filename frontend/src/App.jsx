import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Explore from './pages/Explore';
import Post from './pages/Post';
import Blog from './pages/Blog';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import DashboardOverview from './pages/Dashboard/Overview';
import DashboardPosts from './pages/Dashboard/Posts';
import DashboardEditor from './pages/Dashboard/Editor';
import DashboardAnalytics from './pages/Dashboard/Analytics';
import SearchInsights from './pages/Dashboard/SearchInsights';

function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>
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
      </main>
    </div>
  );
}
