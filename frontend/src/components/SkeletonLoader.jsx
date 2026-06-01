import React from 'react';

/**
 * 高質感骨架屏占位組件 (Skeleton Loader)
 * 嚴格遵循 rules.md 規範，當資料加載中時，提供高級流光波紋效果以防畫面留白。
 */
export const SkeletonLoader = ({ type = 'card', count = 1 }) => {
  const renderSkeleton = () => {
    switch (type) {
      case 'card':
        return (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <div className="h-6 w-24 rounded-md animate-shimmer"></div>
              <div className="h-4 w-12 rounded-md animate-shimmer"></div>
            </div>
            <div className="flex justify-center py-4">
              <div className="h-28 w-28 rounded-full animate-shimmer"></div>
            </div>
            <div className="h-8 w-32 mx-auto rounded-md animate-shimmer"></div>
          </div>
        );
      case 'gauge':
        return (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4 flex flex-col items-center">
            <div className="h-6 w-32 rounded-md animate-shimmer"></div>
            <div className="h-24 w-44 rounded-t-full animate-shimmer mt-4"></div>
            <div className="h-8 w-24 rounded-md animate-shimmer mt-2"></div>
          </div>
        );
      case 'bar':
        return (
          <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
            <div className="h-6 w-40 rounded-md animate-shimmer"></div>
            <div className="space-y-3 pt-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center space-x-3">
                  <div className="h-4 w-28 rounded-md animate-shimmer"></div>
                  <div className="h-6 flex-grow rounded-md animate-shimmer"></div>
                  <div className="h-4 w-12 rounded-md animate-shimmer"></div>
                </div>
              ))}
            </div>
          </div>
        );
      case 'table':
        return (
          <div className="space-y-3">
            <div className="h-8 w-full rounded-md animate-shimmer"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-full rounded-md animate-shimmer"></div>
            ))}
          </div>
        );
      default:
        return <div className="h-20 w-full rounded-md animate-shimmer"></div>;
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx}>{renderSkeleton()}</div>
      ))}
    </div>
  );
};
