// Network utility functions
export const checkNetworkConnectivity = async (): Promise<boolean> => {
  try {
    // Simple network check by trying to fetch a small resource
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors'
    });
    return true;
  } catch (error) {
    console.error('Network connectivity check failed:', error);
    return false;
  }
};

export const isNetworkError = (error: any): boolean => {
  const errorMessage = error?.message?.toLowerCase() || '';
  const networkKeywords = [
    'network',
    'fetch',
    'timeout',
    'connection',
    'unreachable',
    'failed to fetch',
    'net::err_',
    'cloudflare',
    'challenge'
  ];
  
  return networkKeywords.some(keyword => errorMessage.includes(keyword));
};

export const getNetworkErrorMessage = (error: any): string => {
  if (isNetworkError(error)) {
    return 'Network connection issue detected. Please check your internet connection and try again.';
  }
  return error?.message || 'An unexpected error occurred.';
}; 