-- Campus Green Ideas Board schema
-- Run this complete script in Supabase Dashboard -> SQL Editor.
-- The backend uses the server-only service-role key and checks user/role permissions itself.
-- RLS is enabled as a defense-in-depth barrier; no public table policies are granted.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  role text not null default 'student' check (role in ('student','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 5 and 120),
  description text not null check (char_length(trim(description)) between 20 and 2000),
  category text not null check (category in ('Waste & Recycling','Energy Saving','Water Conservation','Green Spaces','Sustainable Transport','Other')),
  status text not null default 'submitted' check (status in ('submitted','under_review','planned','in_progress','implemented','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint votes_one_per_user_per_idea unique (idea_id,user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 2 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists ideas_created_at_idx on public.ideas(created_at desc);
create index if not exists ideas_category_status_idx on public.ideas(category,status);
create index if not exists ideas_user_id_idx on public.ideas(user_id);
create index if not exists votes_idea_id_idx on public.votes(idea_id);
create index if not exists comments_idea_created_idx on public.comments(idea_id,created_at);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
drop trigger if exists ideas_set_updated_at on public.ideas;
create trigger ideas_set_updated_at before update on public.ideas
for each row execute function public.set_updated_at();

-- Create a profile for each Supabase Auth user. Role always starts as student;
-- user metadata cannot choose their role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chosen_name text;
begin
  chosen_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
                          nullif(split_part(new.email, '@', 1), ''),
                          'Campus member');
  insert into public.profiles (id, display_name, role)
  values (new.id, left(chosen_name,80), 'student')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.ideas enable row level security;
alter table public.votes enable row level security;
alter table public.comments enable row level security;
-- No anon/authenticated policies are intentionally created. All data operations
-- go through Express, which verifies the Supabase access token and enforces roles.

-- After creating the administrator account through Supabase Authentication,
-- run a separate command in SQL Editor (replace the email if needed):
-- update public.profiles p set role = 'admin'
-- from auth.users u where p.id = u.id and lower(u.email) = lower('mrec@gmail.com');
