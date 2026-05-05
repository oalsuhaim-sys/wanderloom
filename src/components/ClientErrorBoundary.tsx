'use client';

import React from 'react';

type Props = {
  children: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
};

type State = {
  hasError: boolean;
};

export class ClientErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[ClientErrorBoundary] render failure:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto my-8 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-right">
          <div className="text-sm font-black text-red-900">{this.props.fallbackTitle ?? 'حدث خطأ غير متوقع'}</div>
          <p className="mt-1 text-xs font-bold text-red-700">
            {this.props.fallbackMessage ?? 'تعذر عرض الصفحة حالياً. حاول تحديث الصفحة مرة أخرى.'}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

