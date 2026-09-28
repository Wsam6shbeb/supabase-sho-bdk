-- Enable Row Level Security on candidates.
-- The table already has requester/provider SELECT and requester INSERT policies.
alter table public.candidates enable row level security;
