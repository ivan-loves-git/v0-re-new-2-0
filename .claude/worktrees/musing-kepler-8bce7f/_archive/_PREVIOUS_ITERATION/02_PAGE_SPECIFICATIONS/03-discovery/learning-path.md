# Page Specification: Learning Path

**Route:** `/discovery/learning-path`
**Section:** Discovery
**Authentication Required:** Yes

---

## Purpose

Display personalized learning recommendations based on user's readiness assessment gaps and acquisition criteria. Provides curated courses, articles, and resources to build knowledge and prepare for acquisition journey.

---

## Layout Structure

Page with personalized header and course card grid

```
┌─────────────────────────────────────┐
│  [← Back to Discovery]              │
│  ─────────────────────────────────  │
│                                     │
│  Your Personalized Learning Path    │
│  Based on your readiness gaps and   │
│  acquisition criteria               │
│                                     │
│  ┌──────────────────────────────┐  │
│  │ Priority Courses (3)          │  │
│  │ ┌────┐ ┌────┐ ┌────┐         │  │
│  │ │Fin │ │Due │ │Ops │         │  │
│  │ └────┘ └────┘ └────┘         │  │
│  └──────────────────────────────┘  │
│                                     │
│  Recommended for You                │
│  ┌────────────┐ ┌────────────┐    │
│  │ Course 1   │ │ Course 2   │    │
│  │ [Progress] │ │ [Start]    │    │
│  └────────────┘ └────────────┘    │
│                                     │
│  All Courses (12)                   │
│  [Filter: All Topics ▾]             │
│  ┌────────────┐ ┌────────────┐    │
│  │ Course...  │ │ Course...  │    │
│  └────────────┘ └────────────┘    │
└─────────────────────────────────────┘
```

---

## Key Components

### Personalized Header
- **Headline:** "Your Personalized Learning Path"
- **Subheadline:** Dynamically generated based on readiness results
  - Example: "Based on your readiness assessment, we recommend strengthening operational and financial knowledge."
- **Progress Summary:**
  - Courses started: X
  - Courses completed: Y
  - Total learning hours: Z
  - Badge/Achievement (optional): "🎓 Completed 3 courses!"

### Priority Courses Section
**"Start Here" Recommendations (Top 3):**
- Personalized based on readiness gaps
- **Course Cards:**
  - Course thumbnail image
  - Course title
  - Brief description (1 sentence)
  - Why recommended: "Addresses your [financial/operational/personal] readiness gap"
  - Duration (e.g., "2 hours")
  - Difficulty (Beginner, Intermediate, Advanced)
  - CTA: "Start Course" or "Continue" (if in progress)
- Visual priority indicator (badge: "Priority")

**Priority Logic:**
- If financial gap → "Financial Modeling for Acquisitions"
- If operational gap → "Operational Due Diligence"
- If personal gap → "Building Family Support for Entrepreneurship"

### Recommended Courses Section
**"Recommended for You" (5-10 courses):**
- Filtered based on:
  - Readiness gaps (lower priority than top 3)
  - Acquisition criteria (industry-specific courses)
  - Journey stage (Explorer → intro courses, Searcher → advanced)
- **Course Cards (Standard):**
  - Thumbnail image
  - Title
  - Description (2-3 sentences)
  - Duration, Difficulty, Topic tags
  - Progress bar (if started)
  - CTA: "Start" / "Continue" / "Retake"

### All Courses Section
**Full Course Catalog (Filterable):**
- **Filters:**
  - Topic: All / Financial / Operational / Legal / Personal / Industry-Specific
  - Difficulty: All / Beginner / Intermediate / Advanced
  - Duration: All / <1 hour / 1-3 hours / 3+ hours
  - Status: All / Not Started / In Progress / Completed
- **Sort:**
  - Relevance (default)
  - Newest
  - Popular
  - Duration (short to long)
- **Course Grid:** 2-3 columns, standard course cards

### Course Card Components
**Standard Course Card:**
- Thumbnail (16:9 ratio)
- Topic badge (top-right corner): "Financial" / "Operational" / etc.
- Title (H3)
- Description (2-3 lines, truncated)
- Metadata row:
  - Duration: "2h 30min"
  - Lessons: "8 lessons"
  - Difficulty: Badge (Beginner/Intermediate/Advanced)
- Progress bar (if started): "60% complete"
- CTA Button:
  - "Start Course" (not started)
  - "Continue" (in progress)
  - "Review" (completed) + checkmark icon

### Progress Tracking
**Overall Progress Widget (Sidebar or Top):**
- Circular progress: "5 / 20 courses completed"
- Total learning time: "12 hours invested"
- Next milestone: "Complete 3 more to unlock achievement"
- Learning streak: "5 days in a row 🔥" (optional gamification)

---

## Interactive Elements

1. **Course Card Hover:**
   - Slight elevation (shadow increase)
   - "View Details" overlay appears
   - Click card → navigate to course detail page

2. **Filter & Sort:**
   - Dropdown filters update results immediately
   - Smooth fade-in animation for filtered results
   - Show result count: "Showing 8 of 20 courses"

3. **Progress Tracking:**
   - Clicking progress bar → navigate to course at current lesson
   - Completed courses show checkmark and "Review" CTA

4. **Priority Badge:**
   - "Priority" badge on top 3 courses (orange)
   - Tooltip on hover: "Recommended based on your readiness gaps"

5. **Course Preview:**
   - Click "Preview" → modal with course intro video and curriculum
   - Can start course from modal

6. **Bookmarking:**
   - Bookmark icon on each card
   - Save courses to "My Saved Courses" list (optional feature)

---

## Navigation

### FROM
- Discovery Hub (`/discovery`) - "View Learning Path" button
- Readiness Results (`/discovery/results`) - "Take These Courses" recommendation
- Dashboard (`/dashboard`) - "Continue Learning" widget
- Resources Library (`/resources/library`) - "View Your Learning Path" link

### TO
- Course Detail Page (`/resources/courses/{courseId}`) - Click course card
- Resources Library (`/resources/library`) - "Browse All Resources" link
- Discovery Hub (`/discovery`) - "Back to Discovery" link
- Consultation Booking (`/discovery/consultation`) - "Discuss Your Path" CTA

---

## Content

**Personalized Header Examples:**

**High Readiness (66+):**
- "Your Personalized Learning Path"
- "You're well-prepared! These courses will refine your skills and fill remaining gaps."

**Medium Readiness (41-65):**
- "Your Personalized Learning Path"
- "Based on your readiness assessment, we recommend strengthening [category] knowledge over the next 3-6 months."

**Low Readiness (0-40):**
- "Your Personalized Learning Path"
- "Start here to build foundational knowledge for acquisition entrepreneurship."

**Priority Course Explanations:**
- "Addresses your financial readiness gap (score: 60/100)"
- "Recommended for your target industry: [Healthcare]"
- "Critical skill for first-time acquirers"

**Course Descriptions (Examples):**

1. **"Financial Modeling for Acquisitions"**
   - "Learn to build financial models, evaluate EBITDA, and determine fair valuation for target businesses."
   - Duration: 2h 30min | Difficulty: Intermediate | 8 lessons

2. **"Operational Due Diligence Essentials"**
   - "Master the process of vetting operations, processes, and teams during due diligence."
   - Duration: 1h 45min | Difficulty: Beginner | 6 lessons

3. **"Financing Your First Acquisition"**
   - "Understand financing options: bank loans, seller financing, SBA, and investor equity."
   - Duration: 1h 15min | Difficulty: Beginner | 5 lessons

---

## States

### 1. Initial Load
- Show personalized header with readiness summary
- Priority courses section (top 3)
- Recommended courses section (5-10)
- All courses grid (collapsed, expandable)

### 2. No Readiness Assessment Completed
- Generic header: "Explore Our Course Library"
- No priority section (show popular courses instead)
- Show all courses grid

### 3. No Priority Courses
- If user has high readiness (90+) and no gaps
- Message: "You're highly prepared! Explore advanced topics:"
- Show advanced/specialized courses

### 4. Course In Progress
- Progress bar shows % complete
- "Continue" CTA instead of "Start"
- Clicking navigates to current lesson

### 5. Course Completed
- Checkmark icon on card
- "Review" CTA
- Celebrate completion: "Completed! 🎉"

### 6. Empty State (All Filters Applied)
- No courses match filters
- Message: "No courses found. Try adjusting your filters."
- CTA: "Clear Filters"

### 7. Loading
- Skeleton screens for course cards
- "Loading your learning path..."

---

## Edge Cases

### Readiness Assessment Not Completed
- Can still view courses (generic recommendations)
- Banner: "Complete readiness assessment for personalized recommendations"
- CTA: "Take Assessment"

### Criteria Not Built Yet
- Can still view courses
- No industry-specific recommendations yet
- Banner: "Build your acquisition criteria for industry-specific courses"

### No Courses Started
- Empty progress widget
- Message: "Start your first course to track progress!"
- Highlight priority courses

### All Courses Completed
- Celebration screen: "You've completed the entire learning path! 🎓"
- CTA: "Book Consultation" / "Start Searching for Deals"
- Show "Advanced Topics" or "Stay Updated" section

### Course Archived/Removed
- If user has progress on archived course
- Show in "My Courses" with note: "This course is no longer available"
- Suggest replacement course

---

## Accessibility

- **Keyboard Navigation:**
  - Tab through course cards
  - Enter to open course
  - Arrow keys to navigate filters

- **Screen Reader:**
  - Announce personalized recommendations
  - Read course titles, descriptions, metadata
  - Announce progress updates
  - Describe filter changes ("Showing 8 of 20 courses")

- **Color Contrast:** 4.5:1 minimum

- **ARIA:**
  - `role="region"` on priority section with `aria-label="Priority courses"`
  - `role="list"` on course grid
  - `role="listitem"` on each course card
  - `aria-label` on filter dropdowns
  - `aria-live="polite"` for filter result updates

---

## Analytics

**Events:**
1. "learning_path_viewed"
2. "priority_course_clicked" (course_id)
3. "recommended_course_clicked" (course_id)
4. "course_filter_applied" (filter_type, value)
5. "course_started" (course_id, source: "priority" / "recommended" / "all")
6. "course_bookmarked" (course_id)
7. "consultation_clicked_from_learning_path"

**Metrics to Track:**
- Priority course engagement (% clicking top 3)
- Course completion rates by topic
- Filter usage patterns
- Time spent on learning path page
- Conversion: learning path → course started

---

## Technical Notes

**API Endpoint:** `GET /api/discovery/learning-path`

**Response (200):**
```json
{
  "personalization": {
    "readinessScore": 68,
    "gaps": ["financial", "operational"],
    "criteria": {
      "industry": ["Healthcare", "Professional Services"],
      "stage": "explorer"
    }
  },
  "priorityCourses": [
    {
      "id": "course-fin-01",
      "title": "Financial Modeling for Acquisitions",
      "description": "...",
      "thumbnail": "https://...",
      "duration": 150,
      "lessons": 8,
      "difficulty": "intermediate",
      "topic": "financial",
      "progress": 0,
      "whyRecommended": "Addresses your financial readiness gap (score: 60/100)",
      "url": "/resources/courses/financial-modeling"
    }
  ],
  "recommendedCourses": [...],
  "allCourses": [...],
  "progress": {
    "coursesStarted": 2,
    "coursesCompleted": 1,
    "totalHours": 3.5,
    "streak": 5
  }
}
```

**Course Progress Update:** `POST /api/resources/courses/{courseId}/progress`

**Payload:**
```json
{
  "lessonId": "lesson-3",
  "percentComplete": 60
}
```

**Personalization Algorithm:**
- Readiness gaps → priority courses
- Acquisition criteria (industry) → industry-specific courses
- Journey stage → difficulty level filtering
- User behavior → collaborative filtering (similar users' paths)

---

## Design System References

**Components:** Card, Badge, Progress Bar, Filter Dropdown, Button
**Colors:** Primary `#2D65F8`, Warning `#F59E0B` (priority badge), Success `#10B981` (completed)
**Typography:** H1 36px Bold (headline), H3 20px Bold (course titles), Body 14px Regular
**Spacing:** Card grid gap 24px, section padding 48px
**Card:** Border-radius 12px, shadow on hover

---

*Version: 1.0 | Updated: 2025-11-12 | Status: Ready for Development*
