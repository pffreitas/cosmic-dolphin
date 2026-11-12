CREATE TABLE public.share_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id text NOT NULL CHECK (char_length(device_id) BETWEEN 1 AND 200),
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);
CREATE UNIQUE INDEX share_keys_active_device ON public.share_keys (user_id, device_id) WHERE revoked_at IS NULL;
ALTER TABLE public.share_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_keys_owner ON public.share_keys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
