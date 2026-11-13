
import { useState } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  FileSignature,
} from 'lucide-react';
import api from '../services/api';

export default function Login({ onLogin }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', {
        email,
        password,
      });

      onLogin(response.data);
    } catch (err) {
      setError(
        err.response?.data?.detail ||
        'Login failed. Please check your email and password.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 text-white flex-col justify-between p-14">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <FileSignature size={28} />
          </div>
          <span className="text-2xl font-bold">SecureSign</span>
        </div>

        <div>
          <div className="bg-blue-500/10 text-blue-300 inline-flex p-4 rounded-2xl mb-7">
            <ShieldCheck size={42} />
          </div>
          <h1 className="text-5xl font-bold leading-tight">
            Documents signed.<br />
            Business simplified.
          </h1>
          <p className="text-slate-400 text-lg mt-6 max-w-md">
            A secure and simple platform to manage documents,
            send signing invitations and track every signature.
          </p>
        </div>

        <p className="text-slate-500 text-sm">
          © 2026 SecureSign. All rights reserved.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-2 mb-12 lg:hidden">
            <ShieldCheck className="text-blue-600" size={30} />
            <span className="text-2xl font-bold text-slate-900">
              SecureSign
            </span>
          </div>

          <div className="mb-9">
            <div className="bg-blue-50 text-blue-600 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <Lock size={24} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900">
              Welcome back
            </h2>
            <p className="text-slate-500 mt-2">
              Sign in to access your admin dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Email address
            </label>

            <div className="relative mb-6">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                className="w-full border border-slate-200 rounded-xl py-3.5 pl-12 pr-4 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
            </div>

            <div className="flex justify-between mb-2">
              <label className="text-sm font-semibold text-slate-700">
                Password
              </label>
            </div>

            <div className="relative mb-7">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full border border-slate-200 rounded-xl py-3.5 pl-12 pr-12 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold py-3.5 rounded-xl transition"
            >
              {loading ? 'Signing in...' : 'Sign in to dashboard'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-400 mt-10">
            Protected administrator access
          </p>
        </div>
      </div>
    </div>
  );
}
