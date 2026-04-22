import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { setToken, setUser } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.register({ username, password, displayName });
      setToken(res.token);
      setUser(res.user);
      toast.success(`Welcome to Matchup, ${res.user.displayName}!`);
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="w-full md:w-1/2 flex flex-col justify-center px-8 md:px-16 lg:px-24 py-12">
        <div className="flex items-center justify-between mb-12">
          <Link to="/" className="text-label text-primary">
            MATCHUP
          </Link>
          <ThemeToggle />
        </div>

        <h1 className="text-headline text-foreground mb-2">Create account.</h1>
        <p className="text-sm text-muted mb-8">Start playing the match.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-6">
            <div className="relative">
              <label className="block text-label-xs text-muted mb-1">
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary-container px-0 py-2 text-foreground font-medium transition-colors outline-none"
                placeholder="Choose a username"
                required
                autoFocus
                minLength={3}
                maxLength={20}
                pattern="^[a-zA-Z0-9_]+$"
              />
              <span className="text-[10px] text-muted">
                Letters, numbers, and underscores only
              </span>
            </div>

            <div className="relative">
              <label className="block text-label-xs text-muted mb-1">
                DISPLAY NAME
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary-container px-0 py-2 text-foreground font-medium transition-colors outline-none"
                placeholder="Your display name"
                required
                maxLength={50}
              />
            </div>

            <div className="relative">
              <label className="block text-label-xs text-muted mb-1">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary-container px-0 py-2 text-foreground font-medium transition-colors outline-none"
                placeholder="Create a password"
                required
                minLength={6}
              />
              <span className="text-[10px] text-muted">
                At least 6 characters
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-[200px] h-[52px] bg-primary-container text-on-primary font-bold uppercase tracking-wide rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Get Started'}
          </button>

          <p className="text-sm text-muted">
            Already have an account?{' '}
            <Link to="/login" className="text-primary font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </form>
      </div>

      <div className="hidden md:flex w-1/2 bg-surface-container items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 pitch-pattern opacity-30" />
        
        <svg
          viewBox="0 0 400 600"
          className="w-full max-w-md opacity-20"
          fill="none"
        >
          <rect
            x="20"
            y="50"
            width="360"
            height="500"
            stroke="hsl(var(--primary-container))"
            strokeWidth="2"
          />
          <line
            x1="20"
            y1="300"
            x2="380"
            y2="300"
            stroke="hsl(var(--primary-container))"
            strokeWidth="1"
          />
          <circle
            cx="200"
            cy="300"
            r="40"
            stroke="hsl(var(--primary-container))"
            strokeWidth="1"
          />
          <rect
            x="100"
            y="50"
            width="200"
            height="100"
            stroke="hsl(var(--primary-container))"
            strokeWidth="1"
          />
          <rect
            x="100"
            y="450"
            width="200"
            height="100"
            stroke="hsl(var(--primary-container))"
            strokeWidth="1"
          />
          <circle
            cx="200"
            cy="50"
            r="15"
            stroke="hsl(var(--primary-container))"
            strokeWidth="1"
          />
        </svg>
      </div>
    </div>
  );
}
