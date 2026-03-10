-- Profiles table to store user profile information
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  picture_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function to sync auth.users data into profiles on signup or login
CREATE OR REPLACE FUNCTION public.handle_auth_user_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, picture_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(EXCLUDED.name, profiles.name),
    email = COALESCE(EXCLUDED.email, profiles.email),
    picture_url = COALESCE(EXCLUDED.picture_url, profiles.picture_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users for new signups and profile updates (e.g. Google OAuth)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_change();

-- Backfill profiles for existing users
INSERT INTO public.profiles (id, name, email, picture_url)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
  email,
  COALESCE(raw_user_meta_data->>'avatar_url', raw_user_meta_data->>'picture')
FROM auth.users
ON CONFLICT (id) DO NOTHING;
