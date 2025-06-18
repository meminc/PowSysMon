#!/bin/bash

# Frontend Setup Script for Grid Monitoring System
# This script creates the complete frontend folder structure and files

echo "🚀 Setting up frontend structure for Grid Monitoring System..."

# Create main directories
echo "📁 Creating directory structure..."

# App directories
mkdir -p src/app/\(auth\)/login
mkdir -p src/app/\(dashboard\)/{elements/{new,\[id\]},map,analytics/{reports,real-time},topology,events/\[id\],import-export,settings/{users/\[id\],profile}}

# Component directories
mkdir -p src/components/{ui/{form,charts},layout,grid,map,topology,analytics,events,common}

# Hooks directories
mkdir -p src/hooks/api

# Lib directories
mkdir -p src/lib/{api,utils,config,types}

# Store directory
mkdir -p src/stores

# Styles directory
mkdir -p src/styles

# Public directories
mkdir -p public/{images/{element-icons,backgrounds},data}

echo "✅ Directory structure created"

# Create files
echo "📝 Creating files..."

# Root layout
cat > src/app/layout.js << 'EOF'
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Grid Monitoring System',
  description: 'Real-time power grid monitoring and analysis',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
EOF

# Providers
cat > src/app/providers.js << 'EOF'
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { useState } from 'react';

export default function Providers({ children }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
EOF

# Auth layout
cat > src/app/\(auth\)/layout.js << 'EOF'
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      {children}
    </div>
  );
}
EOF

# Login page
cat > src/app/\(auth\)/login/page.js << 'EOF'
export default function LoginPage() {
  return <div>Login Page</div>;
}
EOF

# Dashboard layout
cat > src/app/\(dashboard\)/layout.js << 'EOF'
import Header from '@/components/layout/header';
import Sidebar from '@/components/layout/sidebar';

export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
EOF

# Dashboard page
cat > src/app/\(dashboard\)/page.js << 'EOF'
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p>Welcome to Grid Monitoring System</p>
    </div>
  );
}
EOF

# Elements pages
cat > src/app/\(dashboard\)/elements/page.js << 'EOF'
export default function ElementsPage() {
  return <div>Elements List</div>;
}
EOF

cat > src/app/\(dashboard\)/elements/\[id\]/page.js << 'EOF'
export default function ElementDetailPage({ params }) {
  return <div>Element Detail: {params.id}</div>;
}
EOF

cat > src/app/\(dashboard\)/elements/new/page.js << 'EOF'
export default function NewElementPage() {
  return <div>Create New Element</div>;
}
EOF

# Map page
cat > src/app/\(dashboard\)/map/page.js << 'EOF'
export default function MapPage() {
  return <div>Network Map</div>;
}
EOF

# Analytics pages
cat > src/app/\(dashboard\)/analytics/page.js << 'EOF'
export default function AnalyticsPage() {
  return <div>Analytics Dashboard</div>;
}
EOF

cat > src/app/\(dashboard\)/analytics/reports/page.js << 'EOF'
export default function ReportsPage() {
  return <div>Analytics Reports</div>;
}
EOF

cat > src/app/\(dashboard\)/analytics/real-time/page.js << 'EOF'
export default function RealTimeMonitorPage() {
  return <div>Real-time Monitoring</div>;
}
EOF

# Topology page
cat > src/app/\(dashboard\)/topology/page.js << 'EOF'
export default function TopologyPage() {
  return <div>Network Topology</div>;
}
EOF

# Events pages
cat > src/app/\(dashboard\)/events/page.js << 'EOF'
export default function EventsPage() {
  return <div>Events & Alarms</div>;
}
EOF

cat > src/app/\(dashboard\)/events/\[id\]/page.js << 'EOF'
export default function EventDetailPage({ params }) {
  return <div>Event Detail: {params.id}</div>;
}
EOF

# Import/Export page
cat > src/app/\(dashboard\)/import-export/page.js << 'EOF'
export default function ImportExportPage() {
  return <div>Import/Export Data</div>;
}
EOF

# Settings pages
cat > src/app/\(dashboard\)/settings/page.js << 'EOF'
export default function SettingsPage() {
  return <div>System Settings</div>;
}
EOF

cat > src/app/\(dashboard\)/settings/users/page.js << 'EOF'
export default function UsersPage() {
  return <div>User Management</div>;
}
EOF

cat > src/app/\(dashboard\)/settings/users/\[id\]/page.js << 'EOF'
export default function UserDetailPage({ params }) {
  return <div>User Detail: {params.id}</div>;
}
EOF

cat > src/app/\(dashboard\)/settings/profile/page.js << 'EOF'
export default function ProfilePage() {
  return <div>User Profile</div>;
}
EOF

# Components - UI
cat > src/components/ui/button.js << 'EOF'
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const Button = forwardRef(({ className, variant = 'primary', size = 'md', ...props }, ref) => {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg',
  };

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
});

Button.displayName = 'Button';

export default Button;
EOF

cat > src/components/ui/card.js << 'EOF'
import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
  return (
    <div
      className={cn('rounded-lg border bg-white p-6 shadow-sm', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('mb-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-lg font-semibold', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('', className)} {...props} />;
}
EOF

# Layout components
cat > src/components/layout/header.js << 'EOF'
'use client';

import { Bell, User } from 'lucide-react';
import Button from '@/components/ui/button';

export default function Header() {
  return (
    <header className="bg-white border-b px-6 py-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Grid Monitoring System</h1>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm">
            <Bell className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="sm">
            <User className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
EOF

cat > src/components/layout/sidebar.js << 'EOF'
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Zap, 
  Map, 
  BarChart3, 
  Network, 
  AlertCircle,
  FileUp,
  Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Elements', href: '/elements', icon: Zap },
  { name: 'Map View', href: '/map', icon: Map },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Topology', href: '/topology', icon: Network },
  { name: 'Events', href: '/events', icon: AlertCircle },
  { name: 'Import/Export', href: '/import-export', icon: FileUp },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r min-h-[calc(100vh-73px)]">
      <nav className="p-4 space-y-1">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                pathname === item.href
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
EOF

# API client
cat > src/lib/api/client.js << 'EOF'
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
EOF

# Utils
cat > src/lib/utils.js << 'EOF'
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date, format = 'PPP') {
  return new Date(date).toLocaleDateString();
}

export function formatNumber(num, decimals = 2) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}
EOF

# Hooks
cat > src/hooks/useAuth.js << 'EOF'
import { create } from 'zustand';
import { useRouter } from 'next/navigation';
import api from '@/lib/api/client';

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user, tokens } = response.data.data;
      
      set({ 
        user, 
        token: tokens.access, 
        isAuthenticated: true,
        isLoading: false 
      });
      
      localStorage.setItem('token', tokens.access);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error?.message || 'Login failed' 
      };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      set({ user: null, token: null, isAuthenticated: false });
      localStorage.removeItem('token');
    }
  },

  checkAuth: () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ token, isAuthenticated: true, isLoading: false });
    } else {
      set({ isLoading: false });
    }
  },
}));

export default function useAuth() {
  const auth = useAuthStore();
  const router = useRouter();

  const requireAuth = () => {
    if (!auth.isAuthenticated && !auth.isLoading) {
      router.push('/login');
    }
  };

  return { ...auth, requireAuth };
}
EOF

cat > src/hooks/api/useElements.js << 'EOF'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';

export function useElements(params = {}) {
  return useQuery({
    queryKey: ['elements', params],
    queryFn: () => api.get('/elements', { params }).then(res => res.data),
  });
}

export function useElement(id) {
  return useQuery({
    queryKey: ['elements', id],
    queryFn: () => api.get(`/elements/${id}`).then(res => res.data),
    enabled: !!id,
  });
}

export function useCreateElement() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => api.post('/elements', data).then(res => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['elements'] });
      toast.success('Element created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Failed to create element');
    },
  });
}
EOF

# Stores
cat > src/stores/uiStore.js << 'EOF'
import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarOpen: true,
  theme: 'light',
  
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setTheme: (theme) => set({ theme }),
}));

export default useUIStore;
EOF

# Styles
cat > src/styles/variables.css << 'EOF'
:root {
  --primary: 220 90% 56%;
  --primary-foreground: 0 0% 100%;
  --secondary: 220 14% 96%;
  --secondary-foreground: 220 9% 46%;
  --success: 142 76% 36%;
  --warning: 38 92% 50%;
  --danger: 0 84% 60%;
  --muted: 220 14% 96%;
  --muted-foreground: 220 9% 46%;
}
EOF

# Update environment variables if .env.local doesn't exist
if [ ! -f ".env.local" ]; then
  cat > .env.local << 'EOF'
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api

# Map Configuration
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3000
EOF
fi

# Update tailwind.config.js
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93bbfd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
EOF

echo "✅ All files created"

echo ""
echo "📦 Installing frontend dependencies..."
echo ""
echo "Run the following command to install all required packages:"
echo ""
echo "npm install @tanstack/react-query @tanstack/react-query-devtools zustand axios leaflet react-leaflet recharts d3 @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select @radix-ui/react-tabs @radix-ui/react-toast framer-motion react-hook-form @hookform/resolvers date-fns socket.io-client clsx tailwind-merge react-hot-toast lucide-react"
echo ""
echo "✨ Frontend setup complete!"
echo ""
echo "Next steps:"
echo "1. Install the dependencies with the command above"
echo "2. Run 'npm run dev' to start the development server"
echo "3. Visit http://localhost:3000 to see your app"
echo ""
echo "The basic structure is ready. You can now start building your components!"
EOF

chmod +x setup-frontend.sh

echo "🎉 Setup script created: setup-frontend.sh"
echo ""
echo "To run it:"
echo "1. chmod +x setup-frontend.sh (already done)"
echo "2. ./setup-frontend.sh"