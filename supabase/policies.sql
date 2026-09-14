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
-- 파라미터 하나(p_release_type)를 끝에 추가하면 시그니처가 달라져서 create or
-- replace로는 기존 8개짜리 오버로드가 안 지워지고 남는다. 먼저 지우고 새로 만든다.
drop function if exists public.edit_post_with_password(bigint, text, text, text, text, text, text, numeric);
create or replace function public.edit_post_with_password(
  p_id bigint, p_password text, p_tag text, p_author text, p_title text, p_content text,
  p_team text default null, p_rating numeric default null, p_release_type text default null
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
      team = p_team, rating = coalesce(p_rating, rating), release_type = coalesce(p_release_type, release_type)
    where id = p_id;
    return true;
  end if;
  return false;
end;
$$;
grant execute on function public.edit_post_with_password(bigint, text, text, text, text, text, text, numeric, text) to anon, authenticated;

-- 공지 기능에 쓰는 컬럼. 아래 select 권한 목록에 포함되므로 그보다 먼저 생성해야 한다.
alter table public.posts add column if not exists is_notice boolean not null default false;

-- 게시물 목록에 댓글 수를 보여주기 위한 컬럼. views/recs와 같은 패턴으로 실제 댓글
-- insert/delete 시점에 트리거로 갱신하고(아래), 매번 댓글을 세는 쿼리를 날리지 않는다.
alter table public.posts add column if not exists comment_count integer not null default 0;

-- 앨범 평가 게시판을 싱글/EP/정규 3개로 나누기 위한 발매 형태 컬럼.
alter table public.posts add column if not exists release_type text;
alter table public.posts drop constraint if exists posts_release_type_check;
alter table public.posts add constraint posts_release_type_check
  check (release_type is null or release_type in ('싱글', 'EP', '정규'));

-- 유동 비밀번호 해시는 클라이언트에 내려가면 안 된다 (select * 로 그대로 노출되고 있었다).
-- 테이블 단위 select를 걷어내고 guest_password를 뺀 컬럼 단위로만 준다. app.js도 select('*') 대신 컬럼을 명시한다.
revoke select on public.posts from anon, authenticated;
grant select (id, created_at, tag, author, title, content, team, user_id,
              album_title, album_artist, album_cover, rating, views, recs, is_notice, is_kakao, comment_count, release_type)
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

-- 추천곡 게시판: 같은 닉네임으로 또 추천곡을 올리면 새 글을 만들지 않고 그
-- 닉네임의 기존 글에 이어 붙인다("닉네임이 같으면 같은 사람" — 원래 카카오톡
-- 오픈채팅방 공지의 규칙을 글쓰기 화면에도 그대로 적용). 유동 글이라 원래
-- 비밀번호를 모르고도 이어 붙일 수 있어야 하므로(예: 가져온 초기 데이터에는
-- 무작위 비밀번호가 걸려 있다) 비밀번호 검증 없이 닉네임만으로 병합하되,
-- 이번에 입력한 비밀번호로 갱신해서 이후로는 작성자 본인이 그 비밀번호로
-- 수정/삭제할 수 있게 한다. 커버는 기존에 없을 때만 새로 채운다(이미 있으면
-- 유지). 로그인 사용자의 글(user_id 기반)에는 적용하지 않는다 — 그쪽은 실제
-- 계정으로 식별되니 닉네임 텍스트 일치로 섞을 이유가 없다.
create or replace function public.upsert_recommend_post(
  p_author text, p_title text, p_content text, p_password text,
  p_album_title text default null, p_album_artist text default null, p_album_cover text default null
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint;
begin
  select id into v_id from public.posts
    where tag = '추천곡' and user_id is null and author = p_author
    order by id limit 1;

  if v_id is not null then
    -- trg_hash_post_password는 insert에만 걸려있어 update에는 안 타므로 여기서 직접 해시한다.
    update public.posts set
      content = content || E'\n' || p_content,
      guest_password = crypt(p_password, gen_salt('bf', 10)),
      album_title = coalesce(album_title, p_album_title),
      album_artist = coalesce(album_artist, p_album_artist),
      album_cover = coalesce(album_cover, p_album_cover)
    where id = v_id;
    return jsonb_build_object('id', v_id, 'appended', true);
  end if;

  -- insert는 trg_hash_post_password 트리거가 자동으로 해시해주므로 평문 그대로 넣는다.
  -- 여기서 또 해시해서 넣으면 트리거가 그 해시값을 다시 해시해버려(이중 해시) 저장된
  -- 비밀번호로 로그인/삭제가 영영 안 되는 버그가 생긴다(실제로 겪은 버그).
  insert into public.posts (tag, author, title, content, guest_password, album_title, album_artist, album_cover)
  values ('추천곡', p_author, p_title, p_content, p_password, p_album_title, p_album_artist, p_album_cover)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'appended', false);
end;
$$;
revoke execute on function public.upsert_recommend_post(text, text, text, text, text, text, text) from public;
grant execute on function public.upsert_recommend_post(text, text, text, text, text, text, text) to anon, authenticated;

-- 회원 탈퇴: 개인정보(계정)는 즉시 파기하되, 다른 이용자와의 대화 맥락이 남아있는
-- 게시물/댓글 본문 자체는 유지하고 계정 연결만 끊는다(유동 글처럼 남음).
-- auth.users를 직접 지워야 해서 SECURITY DEFINER로 만든다 (클라이언트는 anon key로
-- auth 스키마에 직접 접근 못 하므로 이 RPC가 유일한 탈퇴 경로다).
create or replace function public.delete_own_account() returns void
language plpgsql security definer set search_path = public, auth as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요합니다.';
  end if;
  delete from public.post_recommendations where user_id = v_uid;
  update public.posts set user_id = null where user_id = v_uid;
  update public.comments set user_id = null where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;

-- 댓글 수 카운트: 댓글 insert/delete 시 posts.comment_count를 갱신한다. 남의 글에 댓글을
-- 다는 게 대부분이라 posts update RLS(본인 글만 허용)에 걸리므로 security definer로 우회한다.
create or replace function public.bump_comment_count() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_comment_count_ins on public.comments;
create trigger trg_comment_count_ins after insert on public.comments
  for each row execute function public.bump_comment_count();

drop trigger if exists trg_comment_count_del on public.comments;
create trigger trg_comment_count_del after delete on public.comments
  for each row execute function public.bump_comment_count();

-- 트리거가 생기기 전에 이미 달려 있던 댓글들의 수를 한 번 맞춰준다. 이후로는
-- 위 트리거가 실시간으로 관리하므로, 이 문장은 몇 번을 다시 실행해도 항상
-- 실제 댓글 수와 같은 값으로 재계산될 뿐이라 안전하다.
update public.posts p set comment_count = (
  select count(*) from public.comments c where c.post_id = p.id
);

-- release_type 컬럼을 새로 만들면서, 컬럼이 생기기 전에 이미 올라온 앨범 평가
-- 글들에 발매 형태를 한 번 채워준다. iTunes trackCount(1~3=싱글, 4~6=EP, 7+=정규)
-- 기준으로 실제 확인한 값이다 — album_title/album_artist가 정확히 일치하는
-- 글에만 적용되므로, 이후 같은 앨범이 다시 올라와도(글 자체가 신규 INSERT라 이
-- UPDATE 대상이 아니게 되므로) 문제없이 다시 실행할 수 있다.
update public.posts set release_type = 'EP' where album_artist = 'DORI' and album_title = 'Melotherapy - EP';
update public.posts set release_type = 'EP' where album_artist = 'DORI' and album_title = 'Sofie - EP';
update public.posts set release_type = '싱글' where album_artist = 'HANRORO' and album_title = 'Let Me Love My Youth - Single';
update public.posts set release_type = '정규' where album_artist = 'Silica Gel' and album_title = 'Ballad of You';
update public.posts set release_type = '정규' where album_artist = 'JANNABI' and album_title = 'Legend';
update public.posts set release_type = '정규' where album_artist = 'Wunderhorse' and album_title = 'Cub';
update public.posts set release_type = '정규' where album_artist = 'Damons year' and album_title = 'HEADACHE.';
update public.posts set release_type = '정규' where album_artist = 'St. Vincent' and album_title = 'Strange Mercy';
update public.posts set release_type = '정규' where album_artist = 'JUNGWOO' and album_title = 'Cloud Cuckoo Land';
update public.posts set release_type = 'EP' where album_artist = 'Meaningful Stone' and album_title = 'COBALT - EP';
update public.posts set release_type = 'EP' where album_artist = 'wave to earth' and album_title = 'summer flows 0.02 - EP';
update public.posts set release_type = '정규' where album_artist = 'wave to earth' and album_title = '0.1 flaws and all.';
update public.posts set release_type = '정규' where album_artist = 'Radiohead' and album_title = 'OK Computer';
update public.posts set release_type = '정규' where album_artist = 'SE SO NEON' and album_title = 'Nonadaptation';
update public.posts set release_type = '정규' where album_artist = 'HYUKOH' and album_title = '23';
update public.posts set release_type = '정규' where album_artist = 'The Black Skirts' and album_title = 'TEAM BABY';
update public.posts set release_type = '정규' where album_artist = 'Silica Gel' and album_title = 'POWER ANDRE 99';
update public.posts set release_type = '정규' where album_artist = 'Say Sue Me' and album_title = 'Where We Were Together';
update public.posts set release_type = '정규' where album_artist = 'Broccoli you too' and album_title = 'Graduation';
update public.posts set release_type = '정규' where album_artist = 'THORNAPPLE' and album_title = 'Enlightenment';
update public.posts set release_type = '정규' where album_artist = 'The Black Skirts' and album_title = '201 (Special Edition)';
update public.posts set release_type = 'EP' where album_artist = 'Shin Hae Gyeong' and album_title = 'My Reversible Reaction - EP';
update public.posts set release_type = 'EP' where album_artist = 'ADOY' and album_title = 'CATNIP - EP';
update public.posts set release_type = '정규' where album_artist = 'Sultan of the Disco' and album_title = 'The Golden Age';
update public.posts set release_type = '정규' where album_artist = 'Parannoul' and album_title = 'To See the Next Part of the Dream';
update public.posts set release_type = '정규' where album_artist = 'Sister''s Barbershop' and album_title = 'Most Ordinary Existence';
update public.posts set release_type = '정규' where album_artist = '250' and album_title = 'PPONG';
update public.posts set release_type = '정규' where album_artist = 'Kim Sawol' and album_title = 'Suzanne';
update public.posts set release_type = '정규' where album_artist = 'Mot' and album_title = 'Non-Linear';

-- 위 목록에 없는(향후 새로 올라오는) 앨범 평가 글은 일단 "- EP"/"- Single" 제목
-- 표기로 분류하고, 그래도 안 남은 건 정규로 기본 처리한다.
update public.posts set release_type = 'EP' where tag = '앨범 평가' and release_type is null and album_title ilike '%- EP';
update public.posts set release_type = '싱글' where tag = '앨범 평가' and release_type is null and album_title ilike '%- Single';
update public.posts set release_type = '정규' where tag = '앨범 평가' and release_type is null;

-- 추천곡 트랙 커버 검증 캐시: iTunes/유튜브 자동 검색은 가끔 제목만 얼추 비슷한
-- 완전히 무관한 곡을 매칭한다(예: "집토끼 - 라자냐"가 이탈리아 테마 스톡뮤직으로
-- 잘못 매칭됨). 글쓰기 화면에서 검색 결과 중 사용자가 직접 고르면 그 선택을
-- artist|song 키로 여기 저장해두고, 화면에 곡을 보여줄 때(loadRecommendTrackArt)
-- 이 표를 자동 검색보다 먼저 확인해서 한 번 검증된 매칭은 계속 정확하게 뜨게 한다.
-- 추천곡 게시판 자체가 로그인 없이도 자유롭게 쓸 수 있는 신뢰 기반이라, 여기도
-- SECURITY DEFINER 없이 단순 RLS로 공개 읽기/쓰기를 둔다.
create table if not exists public.track_art (
  key text primary key,
  artist text not null,
  song text not null,
  cover text,
  album text,
  duration_ms integer,
  url text,
  created_at timestamptz not null default now()
);
alter table public.track_art add column if not exists url text;
alter table public.track_art enable row level security;
drop policy if exists "track_art read" on public.track_art;
drop policy if exists "track_art insert" on public.track_art;
drop policy if exists "track_art update" on public.track_art;
create policy "track_art read" on public.track_art for select using (true);
create policy "track_art insert" on public.track_art for insert to anon, authenticated with check (true);
create policy "track_art update" on public.track_art for update to anon, authenticated using (true) with check (true);

-- 신고 (앱스토어 심사 지침 1.2): 게시글/댓글 신고를 앱 안에서 접수한다. 로그인 사용자만 넣을 수 있고
-- 읽기는 관리자만(Supabase 대시보드 Table Editor에서 확인). 처리한 신고는 행을 지우면 된다.
create table if not exists public.reports (
  id bigint generated by default as identity primary key,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id bigint not null,
  reason text,
  reporter_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "reports insert" on public.reports;
drop policy if exists "reports admin read" on public.reports;
create policy "reports insert" on public.reports for insert to authenticated
  with check (auth.uid() = reporter_id);
create policy "reports admin read" on public.reports for select to authenticated using (public.is_admin());

notify pgrst, 'reload schema';
