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

-- 같이 갈 사람/장터 게시판은 카카오 로그인 사용자만 글을 쓸 수 있게 제한한다.
-- auth.jwt()의 app_metadata.provider는 클라이언트가 조작할 수 없는 서버 발급 값이라 이걸로 검사한다.
create or replace function public.is_kakao_session() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'kakao';
$$;

drop policy if exists "posts read" on public.posts;
drop policy if exists "posts insert" on public.posts;
drop policy if exists "posts admin update" on public.posts;
drop policy if exists "posts admin delete" on public.posts;

create policy "posts read" on public.posts for select using (true);
-- 로그인 사용자는 본인 user_id로만, 유동은 user_id를 null로 남겨야 통과된다.
-- 같이 갈 사람/장터 태그는 카카오 로그인 세션일 때만 허용한다.
create policy "posts insert" on public.posts for insert to anon, authenticated
  with check (
    (user_id is null or auth.uid() = user_id)
    and (tag not in ('같이 갈 사람', '장터') or public.is_kakao_session())
  );
-- 관리자거나 본인 글일 때 수정/삭제 가능 (유동 글의 삭제는 아래 비밀번호 RPC로 별도 처리).
-- 수정 시 태그를 같이 갈 사람/장터로 바꾸는 것도 카카오 세션이 아니면 막는다 (관리자는 예외).
create policy "posts admin update" on public.posts for update to authenticated
  using (public.is_admin() or auth.uid() = user_id)
  with check (
    public.is_admin()
    or (auth.uid() = user_id and (tag not in ('같이 갈 사람', '장터') or public.is_kakao_session()))
  );
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

-- 닉네임 옆에 카카오 마크를 보여주기 위한 플래그. 클라이언트가 값을 넣는 게 아니라
-- 아래 트리거가 작성 시점의 실제 로그인 세션(JWT)을 보고 서버에서 채워 넣는다.
alter table public.posts add column if not exists is_kakao boolean not null default false;
alter table public.comments add column if not exists is_kakao boolean not null default false;

create or replace function public.set_kakao_flag() returns trigger
language plpgsql set search_path = public as $$
begin
  new.is_kakao := public.is_kakao_session();
  return new;
end;
$$;

drop trigger if exists trg_set_kakao_post on public.posts;
create trigger trg_set_kakao_post before insert on public.posts
  for each row execute function public.set_kakao_flag();

drop trigger if exists trg_set_kakao_comment on public.comments;
create trigger trg_set_kakao_comment before insert on public.comments
  for each row execute function public.set_kakao_flag();

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

-- 유동 글도 비밀번호만 맞으면 수정할 수 있게. anon에는 posts update RLS 정책이 아예 없어서
-- (직접 update는 auth.uid() = user_id 조건이라 유동 글엔 항상 실패) 이 RPC로만 우회 허용한다.
create or replace function public.edit_post_with_password(
  p_id bigint, p_password text, p_tag text, p_author text, p_title text, p_content text,
  p_team text default null, p_rating numeric default null
) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
begin
  -- 유동은 카카오 세션일 수 없으니, 이 RPC로 같이 갈 사람/장터 태그를 다는 건 항상 막는다.
  if p_tag in ('같이 갈 사람', '장터') then
    raise exception '카카오 로그인 사용자만 작성할 수 있는 게시판입니다.';
  end if;
  select guest_password into v_hash from public.posts where id = p_id;
  if v_hash is null then
    return false;
  end if;
  if v_hash = crypt(p_password, v_hash) then
    update public.posts set
      tag = p_tag, author = p_author, title = p_title, content = p_content,
      team = p_team, rating = coalesce(p_rating, rating)
    where id = p_id;
    return true;
  end if;
  return false;
end;
$$;
grant execute on function public.edit_post_with_password(bigint, text, text, text, text, text, text, numeric) to anon, authenticated;

-- 공지 기능에 쓰는 컬럼. 아래 select 권한 목록에 포함되므로 그보다 먼저 생성해야 한다.
alter table public.posts add column if not exists is_notice boolean not null default false;

-- 유동 비밀번호 해시는 클라이언트에 내려가면 안 된다 (select * 로 그대로 노출되고 있었다).
-- 테이블 단위 select를 걷어내고 guest_password를 뺀 컬럼 단위로만 준다. app.js도 select('*') 대신 컬럼을 명시한다.
revoke select on public.posts from anon, authenticated;
grant select (id, created_at, tag, author, title, content, team, user_id,
              album_title, album_artist, album_cover, rating, views, recs, is_notice, is_kakao)
  on public.posts to anon, authenticated;
revoke select on public.comments from anon, authenticated;
grant select (id, created_at, post_id, parent_id, author, content, user_id, is_kakao)
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

-- 앨범 평가 별점을 0.5 단위로 매길 수 있도록 정수 -> 소수(1자리) 컬럼으로 변경.
alter table public.posts alter column rating type numeric(2,1) using rating::numeric(2,1);

-- 공지 기능: 전체 게시판 상단 고정. 일반 insert/update로는 못 건드리게 관리자 전용 RPC로만 설정한다.
create or replace function public.set_notice(p_id bigint, p_is_notice boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  update public.posts set is_notice = p_is_notice where id = p_id;
end;
$$;
revoke execute on function public.set_notice(bigint, boolean) from public, anon;
grant execute on function public.set_notice(bigint, boolean) to authenticated;

notify pgrst, 'reload schema';
