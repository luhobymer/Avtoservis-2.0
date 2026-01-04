-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own profile" ON users
FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
FOR UPDATE USING (auth.uid() = id);

-- Removed recursive policy that caused infinite recursion
-- CREATE POLICY "Admins can manage users" ON users
-- FOR ALL TO authenticated USING (EXISTS (
--   SELECT 1 FROM users u 
--   WHERE u.id = auth.uid() 
--   AND u.role = 'admin'
-- ));

CREATE POLICY "Enable insert for self-registration" ON users
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Phone number validation constraint
ALTER TABLE users
ADD CONSTRAINT valid_phone_format
CHECK (phone ~ '^(\\+380|0)[0-9]{9}$');

-- Prevent role escalation
CREATE OR REPLACE FUNCTION prevent_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.role = 'admin' AND NEW.role != 'admin' THEN
    RAISE EXCEPTION 'Cannot change admin role';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_role_change
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION prevent_role_change();