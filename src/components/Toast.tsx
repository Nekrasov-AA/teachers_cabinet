'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type ToastProps = {
  message: string;
  type: 'success' | 'error';
  duration?: number;
};

export default function Toast({ message, type, duration = 3000 }: ToastProps) {
  const [show, setShow] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
      // Удаляем query параметр из URL после показа
      setTimeout(() => {
        router.replace(window.location.pathname, { scroll: false });
      }, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, router]);

  if (!show) return null;

  const bgColor = type === 'success' ? 'bg-emerald-500' : 'bg-rose-500';

  return (
    <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in">
      <div
        className={`${bgColor} text-white px-6 py-3 rounded-lg shadow-lg max-w-md`}
      >
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
}
