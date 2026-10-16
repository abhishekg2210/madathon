import React from 'react';

interface LoadingSpinnerProps {
  message?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  message = 'Loading data...', 
  className = '' 
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center ${className}`}>
      <div className="relative w-10 h-10">
        <div className="w-10 h-10 rounded-full border-2 border-zinc-200"></div>
        <div className="absolute top-0 left-0 w-10 h-10 rounded-full border-2 border-zinc-950 border-t-transparent animate-spin"></div>
      </div>
      {message && <p className="mt-3 text-sm font-medium text-zinc-600">{message}</p>}
    </div>
  );
};
