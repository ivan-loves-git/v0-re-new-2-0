-- Create tasks table for V1.0 launch task management
-- This table allows the team to track project tasks with owners, dependencies, and status

CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,

  -- Ownership & Assignment
  owner_id UUID REFERENCES auth.users(id),
  owner_name TEXT,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'blocked', 'completed')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),

  -- Timeline
  expected_start_date DATE,
  expected_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,

  -- Dependencies (array of task IDs this task depends on)
  depends_on UUID[] DEFAULT '{}',

  -- Categorization
  stream TEXT CHECK (stream IN ('questionnaire', 'emails', 'branding', 'testing', 'go_live')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Notes for task updates
  notes TEXT
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner ON public.tasks(owner_id);
CREATE INDEX IF NOT EXISTS idx_tasks_stream ON public.tasks(stream);
CREATE INDEX IF NOT EXISTS idx_tasks_expected_end ON public.tasks(expected_end_date);

-- Enable Row Level Security
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Authenticated users can perform all operations
CREATE POLICY "Authenticated users can view all tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete tasks"
  ON public.tasks FOR DELETE
  TO authenticated
  USING (true);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_tasks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_updated_at_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tasks_updated_at();

-- Auto-set actual_start_date when status changes to in_progress
CREATE OR REPLACE FUNCTION set_task_actual_start()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'in_progress' AND OLD.status = 'pending' AND NEW.actual_start_date IS NULL THEN
    NEW.actual_start_date = CURRENT_DATE;
  END IF;
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.actual_end_date IS NULL THEN
    NEW.actual_end_date = CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tasks_auto_dates_trigger
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION set_task_actual_start();
