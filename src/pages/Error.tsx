
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';

interface ErrorState {
  title?: string;
  message?: string;
  details?: string;
}

const Error: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const errorState = location.state as ErrorState;

  const defaultError = {
    title: 'Something went wrong',
    message: 'An unexpected error occurred while processing your request.',
    details: 'Please try again or contact support if the problem persists.'
  };

  const error = errorState || defaultError;

  const handleRetry = () => {
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <Card className="border-red-200">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <CardTitle className="text-2xl text-red-900">
              {error.title}
            </CardTitle>
            <CardDescription className="text-red-700">
              {error.message}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              {error.details}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={handleRetry}
                className="flex items-center space-x-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={handleGoBack}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Go Back</span>
              </Button>
            </div>
            
            <div className="mt-8 p-4 bg-gray-50 rounded-lg">
              <h3 className="font-medium text-gray-900 mb-2">Common Issues:</h3>
              <ul className="text-sm text-gray-600 space-y-1 text-left">
                <li>• File format not supported (only PDF and DOCX allowed)</li>
                <li>• File size too large (maximum 50MB)</li>
                <li>• Network connection issues</li>
                <li>• Server temporarily unavailable</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Error;
