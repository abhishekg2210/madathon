import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ToastProvider } from './components/common/Toast';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ModulesPage } from './pages/ModulesPage';
import { BugsPage } from './pages/BugsPage';
import { ManagerReviewsPage } from './pages/ManagerReviewsPage';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();

  const renderCurrentPage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'modules':
        return <ModulesPage />;
      case 'bugs':
        return <BugsPage />;
      case 'manager/reviews':
        return <ManagerReviewsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <Layout>{renderCurrentPage()}</Layout>;
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
};

export default App;
