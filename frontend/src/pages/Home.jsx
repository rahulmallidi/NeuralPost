import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../lib/api';
import PostCard from '../components/PostCard';
import { ArrowRight, Cpu, Zap, BarChart2 } from 'lucide-react';

export default function Home() {
  const { data, isLoading } = useQuery({
    queryKey: ['posts-home'],
    queryFn: () => api.get('/posts?limit=6').then(r => r.data),
  });

  return (
    <>
      <Helmet>
        <title>NeuralPost — AI-Powered Blogging Platform</title>
      </Helmet>

      {/* Hero */}
      <section className="bg-gradient-to-br from-blue-50 via-white to-purple-50 border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm mb-6">
            <Cpu className="w-4 h-4" />
            AI-Powered Semantic Search
          </div>
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight mb-4">
            Blogging, powered by<br />
            <span className="text-blue-600">artificial intelligence</span>
          </h1>
          <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-8">
            Write, share, and discover content that understands meaning — not just keywords.
            Built with pgvector, Hugging Face, and real-time analytics.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/register" className="bg-blue-600 text-white px-6 py-3 rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors">
              Start Writing Free
            </Link>
            <Link to="/explore" className="flex items-center gap-1 text-gray-600 hover:text-gray-900 font-medium">
              Explore Posts <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {[
            { icon: <Cpu className="w-6 h-6 text-blue-600" />, title: 'Semantic Search', desc: 'Find posts by meaning, not just keywords. Powered by pgvector HNSW indexing.' },
            { icon: <Zap className="w-6 h-6 text-yellow-500" />, title: 'AI Writing Assistant', desc: 'Get tag suggestions, excerpt generation, and writing improvements powered by Hugging Face.' },
            { icon: <BarChart2 className="w-6 h-6 text-green-500" />, title: 'Real-Time Analytics', desc: 'Track views, read completion rates, traffic sources, and search insights.' },
          ].map(f => (
            <div key={f.title} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
              <div className="mb-3">{f.icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Recent Posts */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Posts</h2>
            <Link to="/explore" className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6).fill(0).map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded mb-3 w-3/4" />
                  <div className="h-3 bg-gray-100 rounded mb-2" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data?.posts?.map(post => <PostCard key={post.id} post={post} />)}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
