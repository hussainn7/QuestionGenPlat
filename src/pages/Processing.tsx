
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navigation from '../components/Navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Clock, FileText, Brain, Download, X } from 'lucide-react';

interface ProcessingState {
  filename: string;
  questionLanguage: string;
  explanationLanguage: string;
  numberOfQuestions: string;
  outputFormat: string;
}

interface ProcessStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  icon: React.ReactNode;
}

const Processing: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ProcessingState;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(180); // 3 minutes
  const [logs, setLogs] = useState<string[]>([]);

  const steps: ProcessStep[] = [
    {
      id: 'upload',
      title: 'File Uploaded',
      description: 'Document has been successfully uploaded',
      status: 'completed',
      icon: <FileText className="h-5 w-5" />
    },
    {
      id: 'extract',
      title: 'Extracting Content',
      description: 'Reading and parsing document content',
      status: currentStep >= 1 ? 'completed' : currentStep === 0 ? 'in-progress' : 'pending',
      icon: <Brain className="h-5 w-5" />
    },
    {
      id: 'analyze',
      title: 'Analyzing Topics',
      description: 'Identifying key topics and concepts',
      status: currentStep >= 2 ? 'completed' : currentStep === 1 ? 'in-progress' : 'pending',
      icon: <Brain className="h-5 w-5" />
    },
    {
      id: 'generate',
      title: 'Generating Questions',
      description: 'Creating questions and explanations',
      status: currentStep >= 3 ? 'completed' : currentStep === 2 ? 'in-progress' : 'pending',
      icon: <Brain className="h-5 w-5" />
    },
    {
      id: 'finalize',
      title: 'Finalizing',
      description: 'Formatting output and preparing download',
      status: currentStep >= 4 ? 'completed' : currentStep === 3 ? 'in-progress' : 'pending',
      icon: <Download className="h-5 w-5" />
    }
  ];

  useEffect(() => {
    if (!state) {
      navigate('/dashboard');
      return;
    }

    const simulateProgress = () => {
      const intervals = [
        { step: 0, time: 2000, progress: 20 },
        { step: 1, time: 3000, progress: 40 },
        { step: 2, time: 4000, progress: 60 },
        { step: 3, time: 5000, progress: 80 },
        { step: 4, time: 2000, progress: 100 }
      ];

      let totalTime = 0;
      intervals.forEach(({ step, time, progress: stepProgress }, index) => {
        totalTime += time;
        setTimeout(() => {
          setCurrentStep(step + 1);
          setProgress(stepProgress);
          setEstimatedTime(prev => Math.max(0, prev - time / 1000));
          
          const stepName = steps[step].title;
          setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${stepName} ✓`]);
          
          if (index === intervals.length - 1) {
            setTimeout(() => {
              navigate('/results', {
                state: {
                  ...state,
                  questionsGenerated: parseInt(state.numberOfQuestions) - Math.floor(Math.random() * 100),
                  topicsDetected: Math.floor(Math.random() * 20) + 5
                }
              });
            }, 1000);
          }
        }, totalTime);
      });
    };

    simulateProgress();
  }, [state, navigate]);

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!state) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Processing Document</h1>
          <p className="text-gray-600 mt-2">Generating questions from {state.filename}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Progress Section */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Generation Progress</CardTitle>
                <CardDescription>
                  Processing your document and generating {state.numberOfQuestions} questions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Overall Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>

                {estimatedTime > 0 && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Clock className="h-4 w-4" />
                    <span>Estimated time remaining: {formatTime(estimatedTime)}</span>
                  </div>
                )}

                <div className="space-y-3">
                  {steps.map((step, index) => (
                    <div
                      key={step.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg ${
                        step.status === 'completed'
                          ? 'bg-green-50 border border-green-200'
                          : step.status === 'in-progress'
                          ? 'bg-blue-50 border border-blue-200'
                          : 'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-center w-8 h-8 rounded-full ${
                          step.status === 'completed'
                            ? 'bg-green-500 text-white'
                            : step.status === 'in-progress'
                            ? 'bg-blue-500 text-white animate-pulse'
                            : 'bg-gray-300 text-gray-500'
                        }`}
                      >
                        {step.status === 'completed' ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          step.icon
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{step.title}</p>
                        <p className="text-sm text-gray-600">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={handleCancel}
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel Job
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Settings & Logs */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Job Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">File</p>
                  <p className="text-sm text-gray-600">{state.filename}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Questions</p>
                  <p className="text-sm text-gray-600">{state.numberOfQuestions}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Question Language</p>
                  <p className="text-sm text-gray-600">{state.questionLanguage}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Output Format</p>
                  <p className="text-sm text-gray-600">{state.outputFormat.toUpperCase()}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Processing Log</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {logs.map((log, index) => (
                    <p key={index} className="text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded">
                      {log}
                    </p>
                  ))}
                  {logs.length === 0 && (
                    <p className="text-sm text-gray-500 italic">Processing started...</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Processing;
