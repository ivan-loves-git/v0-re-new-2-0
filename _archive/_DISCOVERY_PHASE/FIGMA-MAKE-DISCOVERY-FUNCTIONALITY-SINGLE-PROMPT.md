# Single Figma Make Prompt - Add Discovery Data Persistence

```
Build this following engineering best practices:
- Write all code to WCAG AA accessibility standards
- Create and use reusable components throughout
- Use semantic HTML and proper component architecture
- Avoid absolute positioning; use flexbox/grid layouts
- Build actual code components, not image SVGs
- Keep code clean, maintainable, and well-structured

Add data persistence and functional progress tracking to the Discovery section:

1. CREATE STORAGE UTILITIES
Create utils/discoveryStorage.js with functions to save/retrieve quiz answers, Lead de Cadrage data, and consultation bookings using localStorage. Include functions: saveQuizAnswers(), getQuizAnswers(), isQuizCompleted(), saveCriteriaData(), getCriteriaData(), isCriteriaCompleted(), getDiscoveryProgress() that returns percentage and completion status for each section.

2. UPDATE DISCOVERY HUB
In Discovery.tsx, import the storage utilities and replace hardcoded false values with real data:
- Replace readinessCompleted with isQuizCompleted()
- Replace criteriaCompleted with isCriteriaCompleted()
- Calculate real completionPercentage from saved data
- Update progress bar to show actual progress
- Change button text: "Start Quiz" vs "View Results" based on completion
- Change button text: "Build Criteria" vs "Edit Criteria" based on completion

3. UPDATE READINESS QUIZ
In ReadinessQuiz.tsx:
- Load saved answers on mount using getQuizAnswers()
- Save answers after each question using saveQuizAnswers()
- If user has existing answers, start from first unanswered question
- Add "Save & Continue Later" functionality that actually saves
- On completion, navigate to results page

4. ADD RESULTS PAGE CALCULATION
Create ReadinessResults.tsx that:
- Calculates scores from saved quiz answers
- Financial score: Average of questions q1-q5 (convert to 0-100 scale)
- Experience score: Average of questions q6-q10 (convert to 0-100 scale)
- Personal score: Average of questions q11-q15 (convert to 0-100 scale)
- Overall score: Average of three categories
- Display circular progress chart with color: red (0-40), yellow (41-70), green (71-100)
- Show strengths and gaps for each category
- Display action plan based on scores

5. CREATE LEAD DE CADRAGE FORM
Create LeadDeCadrage.tsx with 7-step form that:
- Saves data for each step to localStorage using saveCriteriaData()
- Loads existing data on mount using getCriteriaData()
- Auto-saves on every field change
- Shows current step with progress indicator (1 of 7)
- Allows navigation between steps with Previous/Next
- Updates Discovery progress when any step is saved

Step data structure to save:
- Step 1 'industry': {industries: [], businessModel: ''}
- Step 2 'geography': {regions: [], willingToRelocate: false, maxDistance: 0}
- Step 3 'financial': {priceMin: 0, priceMax: 0, revenueMin: 0, revenueMax: 0, ebitdaMin: 0, cashAvailable: 0}
- Step 4 'size': {employeesMin: 0, employeesMax: 0, yearsMin: 0, customerBase: ''}
- Step 5 'structure': {transactionTypes: [], sellerStay: '', financing: []}
- Step 6 'characteristics': {growth: '', technology: '', recurringRevenue: 0}
- Step 7 'timeline': {whenToAcquire: '', status: '', alertsEnabled: false, alertFrequency: ''}

6. SCORE CALCULATION LOGIC
For quiz scoring, use this logic:
- Multiple choice about capital/experience: Map to points (first option=20, second=40, third=60, fourth=80, fifth=100)
- Yes/No questions: Yes=100 points, No=0 points
- Scale questions (1-5): Multiply by 20 to get percentage
- Category score = average of questions in that category

7. ADD PROGRESS EVENT SYSTEM
After any save operation, dispatch custom event:
window.dispatchEvent(new CustomEvent('discoveryProgressUpdate', { detail: getDiscoveryProgress() }))

Discovery.tsx listens to this event and updates the progress bar and checkmarks in real-time.

8. ADD VISUAL FEEDBACK
Show brief "Progress saved" toast notification when data is saved (2 second duration, bottom-right position).

9. NAVIGATION GUARDS
Before navigating to results page, check isQuizCompleted(). If false, show alert "Please complete the quiz first."
Before showing deals, check isCriteriaCompleted(). If false, show message "Please complete your acquisition criteria first."

IMPLEMENTATION ORDER:
1. Create storage utilities file first
2. Update Discovery hub to read real data
3. Update Quiz to save answers
4. Create Results page with calculations
5. Create Lead de Cadrage form
6. Test full flow end-to-end

The progress bar should update dynamically as users complete each section, and all data should persist across page refreshes using localStorage.
```