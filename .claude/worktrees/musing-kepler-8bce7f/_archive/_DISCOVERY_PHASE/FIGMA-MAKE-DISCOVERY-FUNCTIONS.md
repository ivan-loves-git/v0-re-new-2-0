# Figma Make Prompt - Add Discovery Functionality

## Functionality Update

```
Build this following engineering best practices:
- Write all code to WCAG AA accessibility standards
- Create and use reusable components throughout
- Use semantic HTML and proper component architecture
- Avoid absolute positioning; use flexbox/grid layouts
- Build actual code components, not image SVGs
- Keep code clean, maintainable, and well-structured

Add data persistence and progress tracking to the Discovery section:

## 1. CREATE DATA STORAGE SYSTEM

Add a localStorage-based storage system for user data:

Create a new file: utils/discoveryStorage.js with these functions:

```javascript
// Save quiz answers
export const saveQuizAnswers = (answers) => {
  localStorage.setItem('renew_quiz_answers', JSON.stringify(answers));
  updateDiscoveryProgress();
};

// Get quiz answers
export const getQuizAnswers = () => {
  const saved = localStorage.getItem('renew_quiz_answers');
  return saved ? JSON.parse(saved) : {};
};

// Check if quiz is completed
export const isQuizCompleted = () => {
  const answers = getQuizAnswers();
  return Object.keys(answers).length >= 15; // or your total question count
};

// Calculate quiz scores
export const calculateQuizScores = () => {
  const answers = getQuizAnswers();

  // Financial score calculation
  let financialScore = 0;
  // Add logic based on questions q1-q5

  // Experience score calculation
  let experienceScore = 0;
  // Add logic based on questions q6-q10

  // Personal score calculation
  let personalScore = 0;
  // Add logic based on questions q11-q15

  const overallScore = Math.round((financialScore + experienceScore + personalScore) / 3);

  return {
    overall: overallScore,
    financial: financialScore,
    experience: experienceScore,
    personal: personalScore,
    isReady: overallScore >= 70
  };
};

// Save Lead de Cadrage data
export const saveCriteriaData = (step, data) => {
  const existing = getCriteriaData();
  const updated = { ...existing, [step]: data };
  localStorage.setItem('renew_criteria', JSON.stringify(updated));
  updateDiscoveryProgress();
};

// Get all criteria data
export const getCriteriaData = () => {
  const saved = localStorage.getItem('renew_criteria');
  return saved ? JSON.parse(saved) : {};
};

// Check if criteria is completed
export const isCriteriaCompleted = () => {
  const criteria = getCriteriaData();
  // Check if all 7 steps have data
  const requiredSteps = ['industry', 'geography', 'financial', 'size', 'structure', 'characteristics', 'timeline'];
  return requiredSteps.every(step => criteria[step] && Object.keys(criteria[step]).length > 0);
};

// Save consultation booking
export const saveConsultationBooking = (bookingData) => {
  localStorage.setItem('renew_consultation', JSON.stringify(bookingData));
  updateDiscoveryProgress();
};

// Get consultation booking
export const getConsultationBooking = () => {
  const saved = localStorage.getItem('renew_consultation');
  return saved ? JSON.parse(saved) : null;
};

// Check if consultation is booked
export const isConsultationBooked = () => {
  return getConsultationBooking() !== null;
};

// Calculate overall Discovery progress
export const getDiscoveryProgress = () => {
  const quizDone = isQuizCompleted();
  const criteriaDone = isCriteriaCompleted();
  const consultationDone = isConsultationBooked();

  let percentage = 0;
  if (quizDone) percentage += 33;
  if (criteriaDone) percentage += 33;
  if (consultationDone) percentage += 34;

  return {
    percentage,
    quizCompleted: quizDone,
    criteriaCompleted: criteriaDone,
    consultationBooked: consultationDone
  };
};

// Update progress (call this after any save)
const updateDiscoveryProgress = () => {
  const progress = getDiscoveryProgress();
  // Trigger a custom event that components can listen to
  window.dispatchEvent(new CustomEvent('discoveryProgressUpdate', { detail: progress }));
};

// Clear all Discovery data (for testing or reset)
export const clearDiscoveryData = () => {
  localStorage.removeItem('renew_quiz_answers');
  localStorage.removeItem('renew_criteria');
  localStorage.removeItem('renew_consultation');
  updateDiscoveryProgress();
};
```

## 2. UPDATE DISCOVERY HUB PAGE (Discovery.tsx)

Modify the Discovery component to use real progress data:

```javascript
import React, { useState, useEffect } from 'react';
import { getDiscoveryProgress, getQuizAnswers, getCriteriaData } from '../utils/discoveryStorage';

export function Discovery({ onNavigate, isPremium = false }) {
  const [progress, setProgress] = useState(getDiscoveryProgress());

  useEffect(() => {
    // Listen for progress updates
    const handleProgressUpdate = (event) => {
      setProgress(event.detail);
    };

    window.addEventListener('discoveryProgressUpdate', handleProgressUpdate);

    // Check progress on mount
    setProgress(getDiscoveryProgress());

    return () => {
      window.removeEventListener('discoveryProgressUpdate', handleProgressUpdate);
    };
  }, []);

  // Use real progress data
  const completionPercentage = progress.percentage;
  const readinessCompleted = progress.quizCompleted;
  const criteriaCompleted = progress.criteriaCompleted;
  const consultationBooked = progress.consultationBooked;

  // Update the progress bar to use real percentage
  // Update the checkmarks to use real completion status
  // Update button text based on completion (Start/View Results, Build/Edit Criteria)

  return (
    // ... existing JSX with updated variables
  );
}
```

## 3. UPDATE READINESS QUIZ (ReadinessQuiz.tsx)

Add save functionality to the quiz:

```javascript
import React, { useState, useEffect } from 'react';
import { saveQuizAnswers, getQuizAnswers } from '../utils/discoveryStorage';

export function ReadinessQuiz({ onNavigate }) {
  // Load saved answers on mount
  const [answers, setAnswers] = useState(() => getQuizAnswers());

  // Auto-save when answers change
  useEffect(() => {
    if (Object.keys(answers).length > 0) {
      saveQuizAnswers(answers);
    }
  }, [answers]);

  const handleAnswer = (value) => {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);
    saveQuizAnswers(newAnswers); // Save immediately
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setShowHelp(false);
    } else {
      // Quiz completed - save and navigate to results
      saveQuizAnswers(answers);
      onNavigate('readiness-results');
    }
  };

  // Add "Continue Quiz" vs "Start Quiz" logic
  const hasExistingAnswers = Object.keys(answers).length > 0;

  // If returning user, start from last unanswered question
  const findFirstUnanswered = () => {
    for (let i = 0; i < questions.length; i++) {
      if (!answers[questions[i].id]) {
        return i;
      }
    }
    return 0;
  };

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(
    hasExistingAnswers ? findFirstUnanswered() : 0
  );

  // Rest of component...
}
```

## 4. UPDATE LEAD DE CADRAGE FORM

Add save functionality to each step:

```javascript
import React, { useState, useEffect } from 'react';
import { saveCriteriaData, getCriteriaData } from '../utils/discoveryStorage';

export function LeadDeCadrage({ onNavigate }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState(() => getCriteriaData());

  // Save data for current step
  const saveStepData = (stepName, data) => {
    saveCriteriaData(stepName, data);
    setFormData(prev => ({ ...prev, [stepName]: data }));
  };

  // Handle next step
  const handleNext = () => {
    // Save current step data
    const stepNames = ['industry', 'geography', 'financial', 'size', 'structure', 'characteristics', 'timeline'];
    saveStepData(stepNames[currentStep - 1], getCurrentStepData());

    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    } else {
      // Form complete
      onNavigate('discovery');
    }
  };

  // Handle previous step
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Auto-save on field changes
  const handleFieldChange = (fieldName, value) => {
    const stepName = getCurrentStepName();
    const currentStepData = formData[stepName] || {};
    const updatedStepData = { ...currentStepData, [fieldName]: value };
    saveStepData(stepName, updatedStepData);
  };

  // Check if user has existing data and offer to continue or start fresh
  const hasExistingData = Object.keys(formData).length > 0;

  return (
    // Form UI with step indicator and fields
    // Each field onChange calls handleFieldChange
    // Previous/Next buttons call respective handlers
    // Show "Continue where you left off" if hasExistingData
  );
}
```

## 5. CREATE RESULTS PAGE

Create a new Results component that uses saved quiz data:

```javascript
import React, { useEffect, useState } from 'react';
import { calculateQuizScores, getQuizAnswers } from '../utils/discoveryStorage';

export function ReadinessResults({ onNavigate }) {
  const [scores, setScores] = useState(null);

  useEffect(() => {
    // Calculate scores from saved answers
    const calculatedScores = calculateQuizScores();
    setScores(calculatedScores);
  }, []);

  if (!scores) {
    return <div>Calculating your results...</div>;
  }

  const getReadinessLevel = (score) => {
    if (score < 40) return 'Not Ready';
    if (score < 70) return 'Getting Ready';
    return 'Ready to Acquire';
  };

  const getColorClass = (score) => {
    if (score < 40) return 'text-red-500';
    if (score < 70) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div>
      {/* Overall Score Circle */}
      <div className="text-center mb-8">
        <div className="relative inline-flex items-center justify-center w-48 h-48">
          <svg className="transform -rotate-90 w-48 h-48">
            <circle cx="96" cy="96" r="80" stroke="#E5E7EB" strokeWidth="16" fill="none" />
            <circle
              cx="96" cy="96" r="80"
              stroke={scores.overall < 40 ? '#EF4444' : scores.overall < 70 ? '#F59E0B' : '#10B981'}
              strokeWidth="16"
              fill="none"
              strokeDasharray={`${2 * Math.PI * 80}`}
              strokeDashoffset={`${2 * Math.PI * 80 * (1 - scores.overall / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute">
            <div className={`text-5xl font-bold ${getColorClass(scores.overall)}`}>
              {scores.overall}
            </div>
            <div className="text-sm text-gray-600">
              {getReadinessLevel(scores.overall)}
            </div>
          </div>
        </div>
      </div>

      {/* Category Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Financial Readiness Card */}
        <CategoryCard
          title="Financial Readiness"
          score={scores.financial}
          strengths={getFinancialStrengths(scores.financial)}
          gaps={getFinancialGaps(scores.financial)}
          actions={getFinancialActions(scores.financial)}
        />

        {/* Similar for Experience and Personal cards */}
      </div>

      {/* Action Plan */}
      <div className="mt-8 p-6 bg-blue-50 border-l-4 border-blue-500">
        <h3 className="text-lg font-semibold mb-4">Your Action Plan</h3>
        <ol className="space-y-2">
          {!scores.criteriaCompleted && (
            <li>1. Define your acquisition criteria</li>
          )}
          <li>{scores.criteriaCompleted ? '1' : '2'}. Address your top readiness gaps</li>
          <li>{scores.criteriaCompleted ? '2' : '3'}. Begin your personalized learning path</li>
          {scores.overall >= 70 && (
            <li>{scores.criteriaCompleted ? '3' : '4'}. Start browsing deals</li>
          )}
        </ol>
      </div>

      {/* CTAs */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => onNavigate('criteria')}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg"
        >
          Define Your Criteria
        </button>
        <button
          onClick={() => onNavigate('learning')}
          className="px-6 py-3 border border-gray-300 rounded-lg"
        >
          Start Learning Path
        </button>
      </div>
    </div>
  );
}
```

## 6. ADD NAVIGATION UPDATES

Update your main App.tsx or navigation handler to properly route between pages and check completion status:

```javascript
// In your navigation handler
const handleNavigation = (page) => {
  switch(page) {
    case 'readiness-results':
      // Check if quiz is completed first
      if (!isQuizCompleted()) {
        alert('Please complete the quiz first');
        return;
      }
      setCurrentPage('results');
      break;
    case 'criteria':
      setCurrentPage('lead-de-cadrage');
      break;
    // ... other cases
  }
};
```

## 7. ADD VISUAL FEEDBACK

Add loading states and success messages:

```javascript
// Add toast notifications for saves
const showSaveNotification = () => {
  // Show a small toast: "Progress saved"
  const toast = document.createElement('div');
  toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50';
  toast.textContent = 'Progress saved';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
};

// Call after each save operation
```

## TESTING THE FUNCTIONALITY

Add these test buttons to your Discovery page during development:

```javascript
// Developer tools (remove in production)
<div className="fixed bottom-4 left-4 space-x-2">
  <button onClick={() => {
    clearDiscoveryData();
    window.location.reload();
  }} className="px-3 py-1 bg-red-500 text-white text-sm rounded">
    Reset All Data
  </button>
  <button onClick={() => {
    console.log('Quiz:', getQuizAnswers());
    console.log('Criteria:', getCriteriaData());
    console.log('Progress:', getDiscoveryProgress());
  }} className="px-3 py-1 bg-blue-500 text-white text-sm rounded">
    Log Data
  </button>
</div>
```

This implementation will:
1. Save all quiz answers to localStorage
2. Save all Lead de Cadrage form data
3. Calculate and display real progress percentages
4. Update the progress bar dynamically
5. Show checkmarks when sections are completed
6. Allow users to continue where they left off
7. Calculate readiness scores based on actual answers
```