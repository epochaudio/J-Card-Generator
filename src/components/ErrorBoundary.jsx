import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled React rendering error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-lg border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold text-red-600">界面渲染失败</h1>
            <p className="mt-2 text-sm text-gray-600">
              应用遇到了一个未处理的渲染错误。可以刷新页面恢复，如果问题持续出现，再检查控制台日志。
            </p>
            <pre className="mt-4 max-h-48 overflow-auto rounded bg-gray-900 p-3 text-xs text-red-200">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500"
            >
              重新加载
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
