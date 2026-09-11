-- Supabase SQL Editor에서 1회 실행. 실행 후 index.html(rpc 호출 버전)을 배포한다.
-- posts 테이블: 읽기는 누구나, 글 작성은 로그인 사용자, 수정/삭제는 관리자만.
-- 조회수/추천수는 클라이언트가 직접 update하지 않고 아래 RPC로만 +1 한다.

alter table public.posts enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'bkseungah010223@gmail.com';
$$;

-- 유동(비로그인) 글쓰기를 지원하기 위해 posts에도 user_id가 필요하다.
alter table public.posts
  add column if not exists user_id uuid references auth.users(id);

drop policy if exists "posts read" on public.posts;
drop policy if exists "posts insert" on public.posts;
drop policy if exists "posts admin update" on public.posts;
drop policy if exists "posts admin delete" on public.posts;

create policy "posts read" on public.posts for select using (true);
-- 로그인 사용자는 본인 user_id로만, 유동은 user_id를 null로 남겨야 통과된다.
create policy "posts insert" on public.posts for insert to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);
-- 관리자거나 본인 글일 때 수정/삭제 가능 (유동 글의 삭제는 아래 비밀번호 RPC로 별도 처리).
create policy "posts admin update" on public.posts for update to authenticated
  using (public.is_admin() or auth.uid() = user_id) with check (public.is_admin() or auth.uid() = user_id);
create policy "posts admin delete" on public.posts for delete to authenticated
  using (public.is_admin() or auth.uid() = user_id);

drop function if exists public.increment_views(bigint);
create function public.increment_views(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update public.posts set views = coalesce(views, 0) + 1 where id = p_id;
$$;

drop function if exists public.increment_recs(bigint);
create function public.increment_recs(p_id bigint) returns void
language sql security definer set search_path = public as $$
  update public.posts set recs = coalesce(recs, 0) + 1 where id = p_id;
$$;

-- comments 테이블: 읽기는 누구나, 작성은 로그인 사용자(본인 user_id로만) 또는 유동, 삭제는 작성자 또는 관리자.
alter table public.comments
  add column if not exists user_id uuid references auth.users(id);

alter table public.comments enable row level security;

drop policy if exists "comments read" on public.comments;
drop policy if exists "comments insert" on public.comments;
drop policy if exists "comments delete" on public.comments;

create policy "comments read" on public.comments for select using (true);
create policy "comments insert" on public.comments for insert to anon, authenticated
  with check (user_id is null or auth.uid() = user_id);
create policy "comments delete" on public.comments for delete to authenticated using (auth.uid() = user_id or public.is_admin());

-- 유동(비로그인) 글쓰기: 디씨처럼 닉네임 + 비밀번호로 작성하고, 같은 비밀번호로 본인이 삭제할 수 있게 한다.
-- 비밀번호는 평문 저장하지 않고 트리거에서 bcrypt로 해시한 뒤 저장한다.
create extension if not exists pgcrypto with schema extensions;

alter table public.posts add column if not exists guest_password text;
alter table public.comments add column if not exists guest_password text;

create or replace function public.hash_guest_password() returns trigger
language plpgsql set search_path = public, extensions as $$
begin
  if new.guest_password is not null and new.guest_password <> '' then
    new.guest_password := crypt(new.guest_password, gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_post_password on public.posts;
create trigger trg_hash_post_password before insert on public.posts
  for each row execute function public.hash_guest_password();

drop trigger if exists trg_hash_comment_password on public.comments;
create trigger trg_hash_comment_password before insert on public.comments
  for each row execute function public.hash_guest_password();

-- 비밀번호 검증 + 삭제는 SECURITY DEFINER로, 해시값을 클라이언트에 노출하지 않고 서버 안에서만 비교한다.
create or replace function public.delete_post_with_password(p_id bigint, p_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
begin
  select guest_password into v_hash from public.posts where id = p_id;
  if v_hash is null then
    return false;
  end if;
  if v_hash = crypt(p_password, v_hash) then
    delete from public.posts where id = p_id;
    return true;
  end if;
  return false;
end;
$$;

create or replace function public.delete_comment_with_password(p_id bigint, p_password text)
returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
begin
  select guest_password into v_hash from public.comments where id = p_id;
  if v_hash is null then
    return false;
  end if;
  if v_hash = crypt(p_password, v_hash) then
    delete from public.comments where id = p_id;
    return true;
  end if;
  return false;
end;
$$;

grant execute on function public.delete_post_with_password(bigint, text) to anon, authenticated;
grant execute on function public.delete_comment_with_password(bigint, text) to anon, authenticated;

-- 유동 비밀번호 해시는 클라이언트에 내려가면 안 된다 (select * 로 그대로 노출되고 있었다).
-- 테이블 단위 select를 걷어내고 guest_password를 뺀 컬럼 단위로만 준다. app.js도 select('*') 대신 컬럼을 명시한다.
revoke select on public.posts from anon, authenticated;
grant select (id, created_at, tag, author, title, content, team, user_id,
              album_title, album_artist, album_cover, rating, views, recs)
  on public.posts to anon, authenticated;
revoke select on public.comments from anon, authenticated;
grant select (id, created_at, post_id, parent_id, author, content, user_id)
  on public.comments to anon, authenticated;

-- 로그인 사용자 추천: 1인 1회. 기록 테이블은 API에서 직접 못 건드리고 아래 RPC(security definer)만 쓴다.
create table if not exists public.post_recommendations (
  post_id bigint not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_recommendations enable row level security;
revoke all on public.post_recommendations from anon, authenticated;

create or replace function public.toggle_recommendation(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'login required';
  end if;
  -- 이미 추천했으면 PK 위반 에러가 나고, 클라이언트는 그걸 "이미 추천한 게시글" 로 표시한다.
  insert into public.post_recommendations (post_id, user_id) values (p_id, auth.uid());
  update public.posts set recs = coalesce(recs, 0) + 1 where id = p_id;
end;
$$;
revoke execute on function public.toggle_recommendation(bigint) from public, anon;
grant execute on function public.toggle_recommendation(bigint) to authenticated;

notify pgrst, 'reload schema';
