import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../../types';
import { api } from '../services/api';

interface AppContextType {
  currentUser: User | null;
  users: User[];
  setCurrentUser: (user: User) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  selectedBugId: string | null;
  setSelectedBugId: (id: string | null) => void;
  navigateToBug: (id: string) => void;
  navigateBackToBugs: () => void;
  pendingReviewsCount: number;
  refreshReviewCount: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTabState] = useState<string>(() => {
    const path = window.location.pathname.replace(/^\//, '');
    if (path.includes('manager/reviews')) return 'manager/reviews';
    if (path.includes('modules')) return 'modules';
    if (path.includes('bugs')) return 'bugs';
    return 'dashboard';
  });
  const [selectedBugId, setSelectedBugId] = useState<string | null>(() => {
    const path = window.location.pathname.replace(/^\//, '');
    if (path.startsWith('bugs/')) {
      const parts = path.split('/');
      return parts[1] || null;
    }
    return null;
  });
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(2);

  // Sync with browser URL
  const setActiveTab = (tab: string) => {
    setSelectedBugId(null);
    setActiveTabState(tab);
    window.history.pushState(null, '', `/${tab}`);
  };

  const navigateToBug = (id: string) => {
    setSelectedBugId(id);
    setActiveTabState('bugs');
    window.history.pushState(null, '', `/bugs/${id}`);
  };

  const navigateBackToBugs = () => {
    setSelectedBugId(null);
    setActiveTabState('bugs');
    window.history.pushState(null, '', '/bugs');
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/^\//, '');
      if (path.includes('manager/reviews')) {
        setActiveTabState('manager/reviews');
        setSelectedBugId(null);
      } else if (path.includes('modules')) {
        setActiveTabState('modules');
        setSelectedBugId(null);
      } else if (path.startsWith('bugs/')) {
        setActiveTabState('bugs');
        const parts = path.split('/');
        setSelectedBugId(parts[1] || null);
      } else if (path.includes('bugs')) {
        setActiveTabState('bugs');
        setSelectedBugId(null);
      } else {
        setActiveTabState('dashboard');
        setSelectedBugId(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const refreshReviewCount = async () => {
    try {
      const reviews = await api.getReviews();
      const pending = reviews.filter(r => r.status === 'pending').length;
      setPendingReviewsCount(pending);
    } catch {
      // fallback
    }
  };

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const userList = await api.getUsers();
        setUsers(userList);
        if (userList.length > 0 && !currentUser) {
          // Default to Manager Sarah Connor for hackathon review demo, or Alex Rivera
          const defaultUser = userList.find(u => u.role === 'manager') || userList[0];
          setCurrentUser(defaultUser);
        }
      } catch (err) {
        console.error('Failed to load users:', err);
      }
    };
    loadUsers();
    refreshReviewCount();
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        setCurrentUser,
        activeTab,
        setActiveTab,
        selectedBugId,
        setSelectedBugId,
        navigateToBug,
        navigateBackToBugs,
        pendingReviewsCount,
        refreshReviewCount,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};
