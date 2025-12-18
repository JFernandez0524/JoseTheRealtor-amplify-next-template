// app/(protected)/upload/NotificationCenter.tsx
'use client';

import { useState, useEffect } from 'react';
import { client } from '@/app/utils/aws/data/frontEndClient';
import type { Schema } from '@/amplify/data/resource';
import { FaBell, FaExclamationCircle, FaCheckCircle } from 'react-icons/fa'; // 🟢 Updated to react-icons

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<
    Schema['Notification']['type'][]
  >([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const sub = client.models.Notification.observeQuery().subscribe({
      next: ({ items }) =>
        setNotifications(
          items.sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
        ),
    });
    return () => sub.unsubscribe();
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div className='relative'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='relative p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors'
      >
        <FaBell size={22} />
        {unreadCount > 0 && (
          <span className='absolute top-0 right-0 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold'>
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className='absolute right-0 mt-2 w-85 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-[500px] overflow-y-auto'>
          <div className='p-3 border-b border-gray-100 font-bold text-sm text-gray-700'>
            Upload Status Logs
          </div>
          {notifications.length === 0 ? (
            <div className='p-6 text-center text-gray-400 text-sm italic'>
              No recent activity
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-4 border-b border-gray-50 transition-colors ${n.isRead ? 'opacity-60' : 'bg-blue-50/40'}`}
              >
                <div className='flex items-start gap-3'>
                  {n.type === 'ERROR' ? (
                    <FaExclamationCircle
                      className='text-red-500 mt-1 shrink-0'
                      size={18}
                    />
                  ) : (
                    <FaCheckCircle
                      className='text-green-500 mt-1 shrink-0'
                      size={18}
                    />
                  )}
                  <div className='flex-1'>
                    <p className='text-sm font-bold text-gray-800 leading-tight'>
                      {n.title}
                    </p>
                    <p className='text-xs text-gray-600 mt-1.5 whitespace-pre-wrap leading-relaxed'>
                      {n.message}
                    </p>
                    <p className='text-[10px] text-gray-400 mt-2 font-medium'>
                      {new Date(n.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
