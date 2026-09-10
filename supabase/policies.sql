-- Supabase SQL Editor에서 1회 실행. 실행 후 index.html(rpc 호출 버전)을 배포한다.
-- posts 테이블: 읽기는 누구나, 글 작성은 로그인 사용자, 수정/삭제는 관리자만.
-- 조회수/추천수는 클라이언트가 직접 update하지 않고 아래 RPC로만 +1 한다.

alter table public.posts enable row level security;

create or replace function public.is_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'bkseungah010223@gmail.com';
$$;

drop policy if exists "posts read" on public.posts;
drop policy if exists "posts insert" on public.posts;
drop policy if exists "posts admin update" on public.posts;
drop policy if exists "posts admin delete" on public.posts;

create policy "posts read" on public.posts for select using (true);
create policy "posts insert" on public.posts for insert to authenticated with check (true);
create policy "posts admin update" on public.posts for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "posts admin delete" on public.posts for delete to authenticated using (public.is_admin());

create or replace function public.increment_views(post_id bigint) returns void
language sql security definer set search_path = public as $$
  update public.posts set views = coalesce(views, 0) + 1 where id = post_id;
$$;

create or replace function public.increment_recs(post_id bigint) returns void
language sql security definer set search_path = public as $$
  update public.posts set recs = coalesce(recs, 0) + 1 where id = post_id;
$$;
