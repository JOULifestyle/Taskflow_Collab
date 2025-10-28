import React from 'react';

const NotificationBanner = ({ onEnable, onDismiss }) => {
  return (
    <div className="fixed bottom-0 inset-x-0 pb-2 sm:pb-5">
      <div className="max-w-screen-xl mx-auto px-2 sm:px-6 lg:px-8">
        <div className="p-2 rounded-lg bg-blue-600 shadow-lg sm:p-3">
          <div className="flex items-center justify-between flex-wrap">
            <div className="w-0 flex-1 flex items-center">
              <span className="flex p-2 rounded-lg bg-blue-800">
                🔔
              </span>
              <p className="ml-3 font-medium text-white truncate">
                <span className="md:hidden">
                  Enable notifications for updates
                </span>
                <span className="hidden md:inline">
                  Enable notifications to receive real-time updates about your tasks
                </span>
              </p>
            </div>
            <div className="mt-2 flex-shrink-0 w-full sm:mt-0 sm:w-auto">
              <div className="rounded-md shadow-sm space-x-3">
                <button
                  onClick={onEnable}
                  className="flex items-center justify-center px-4 py-2 border border-transparent text-sm leading-5 font-medium rounded-md text-blue-600 bg-white hover:text-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150"
                >
                  Enable
                </button>
                <button
                  onClick={onDismiss}
                  className="flex items-center justify-center px-4 py-2 border border-transparent text-sm leading-5 font-medium rounded-md text-white bg-blue-800 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition ease-in-out duration-150"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationBanner;