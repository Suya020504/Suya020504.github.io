/* Portfolio admin: what can be edited and how (one entry per content.json section).
   Field types: text · url · date · textarea · bool · number · select · multi · lines · tags · ref · object · objects · image · file · gallery
   Fields not listed here are kept as they are (shown under "기타 필드"); keys starting with "_" are never shown. */
(function () {
  'use strict';
  var TIER = [['grand', '대상급 (🥇)'], ['top', '최우수급 (🏆)'], ['excellent', '우수급 (🥈)'], ['org', '장려·입선·기관장상 (🥉🎖️🏅)']];
  var EVIDENCE = [['result', '결과 발표'], ['press', '보도'], ['call', '공고'], ['none', '없음']];
  var LINK_TYPE = [['demo', '데모'], ['repo', '저장소'], ['notion', 'Notion'], ['blog', '블로그'], ['slides', '발표자료'], ['evidence', '근거']];
  var link = [{ k: 'label', l: '이름', t: 'text' }, { k: 'url', l: '주소', t: 'url' }];

  window.ADMIN_SCHEMA = [
    {
      key: 'awards', label: '수상', icon: '🏆', help: '상격이 확정된 수상만 넣어요. 결과를 기다리는 대회는 \'결과 대기\'에 넣으세요.',
      title: function (x) { return x.award || '(상 이름 없음)'; },
      sub: function (x) { return [x.date, x.project, x.competition].filter(Boolean).join(' · '); },
      make: function () { return { id: '', date: '', project: '', award: '', tier: 'org', competition: '', organizer: '', evidenceUrl: '', evidenceType: 'result', verifiedPublicly: true, note: '' }; },
      fields: [
        { k: 'id', l: 'ID (영문 소문자·하이픈, 고유)', t: 'text', req: true, slug: true, hint: '예: on-jibung' },
        { k: 'date', l: '수상일', t: 'date', req: true },
        { k: 'project', l: '작품·팀 이름', t: 'text', req: true },
        { k: 'award', l: '상 이름', t: 'text', req: true, hint: '예: 대상 · 과학기술정보통신부장관상' },
        { k: 'tier', l: '등급', t: 'select', options: TIER },
        { k: 'competition', l: '대회 이름', t: 'text' },
        { k: 'organizer', l: '주최·주관', t: 'text' },
        { k: 'organizerUrl', l: '주최 사이트', t: 'url' },
        { k: 'projectId', l: '연결 프로젝트', t: 'ref', ref: 'projects' },
        { k: 'short', l: '한 줄 설명', t: 'text' },
        { k: 'note', l: '메모 (사이트에 표시)', t: 'textarea' },
        { k: 'evidenceUrl', l: '근거 링크', t: 'url' },
        { k: 'evidenceType', l: '근거 종류', t: 'select', options: EVIDENCE },
        { k: 'evidenceMore', l: '추가 근거 링크', t: 'objects', fields: link },
        { k: 'verifiedPublicly', l: '공개 자료로 확인됨', t: 'bool' },
        { k: 'statusLabel', l: '상태 표시 (선택)', t: 'text', hint: '예: 시상 예정 · 비워 두면 표시 안 함' },
        { k: 'ceremonyDate', l: '시상식 날짜 (선택)', t: 'date' }
      ]
    },
    {
      key: 'awardsPending', label: '결과 대기', icon: '⏳', help: '결과를 기다리는 대회예요. 결과가 나오면 여기서 지우고 \'수상\'에 추가하세요.',
      title: function (x) { return x.project || '(이름 없음)'; },
      sub: function (x) { return [x.status, x.competition].filter(Boolean).join(' · '); },
      make: function () { return { project: '', competition: '', status: '', short: '', note: '', state: 'in_progress' }; },
      fields: [
        { k: 'project', l: '작품·팀 이름', t: 'text', req: true },
        { k: 'competition', l: '대회 이름', t: 'text' },
        { k: 'state', l: '단계', t: 'select', options: [['in_progress', '심사 진행 중'], ['result_pending', '결과 발표 대기'], ['award_confirmed', '수상 확정 · 상격 미정']] },
        { k: 'status', l: '상태 문구', t: 'text', hint: '예: 본선 진출' },
        { k: 'short', l: '짧은 일정', t: 'text', hint: '예: 본선 11.24–25 · AI 에이전트 개발·시연' },
        { k: 'note', l: '설명', t: 'textarea' },
        { k: 'date', l: '날짜 (선택)', t: 'date' },
        { k: 'projectId', l: '연결 프로젝트', t: 'ref', ref: 'projects' },
        { k: 'evidenceUrl', l: '공고·근거 링크', t: 'url' }
      ]
    },
    {
      key: 'projects', label: '프로젝트', icon: '📁', help: '사례 페이지가 하나씩 만들어져요. \'대표\'에 체크하면 첫 화면 레일에도 나와요.',
      title: function (x) { return x.title || '(제목 없음)'; },
      sub: function (x) { return [x.period, x.domain, x.status].filter(Boolean).join(' · '); },
      make: function () { return { id: '', title: '', titleEn: '', featured: false, category: ['data'], domain: '', period: '', team: '', role: '', contribution: '', summary: '', problem: '', approach: [], decisions: [], results: [], kpis: [], stack: [], aiUse: '', limits: '', status: '', links: [] }; },
      fields: [
        { k: 'id', l: 'ID (주소에 쓰임, 영문·하이픈, 고유)', t: 'text', req: true, slug: true, hint: '예: wind-map → /projects/wind-map/' },
        { k: 'title', l: '제목', t: 'text', req: true },
        { k: 'titleEn', l: '영문 제목', t: 'text' },
        { k: 'summary', l: '한 줄 소개', t: 'text', req: true },
        { k: 'featured', l: '대표 프로젝트 (첫 화면)', t: 'bool' },
        { k: 'order', l: '순서 (작을수록 앞)', t: 'number' },
        { k: 'category', l: '분야', t: 'multi', options: [['data', '데이터 분석'], ['ai', 'AI 서비스 기획'], ['mvp', 'MVP 구현'], ['public', '공공·정책']] },
        { k: 'icon', l: '아이콘 이모지 (선택)', t: 'text', hint: '예: 🚒' },
        { k: 'domain', l: '분야 키워드', t: 'text', hint: '예: 관광 · 소방안전' },
        { k: 'period', l: '기간', t: 'text', hint: '예: 2026.07–09' },
        { k: 'team', l: '팀', t: 'text' },
        { k: 'role', l: '내 역할', t: 'text' },
        { k: 'roleBadge', l: '역할 배지 (선택)', t: 'text' },
        { k: 'contribution', l: '내 기여', t: 'textarea' },
        { k: 'status', l: '현재 상태', t: 'text' },
        { k: 'award', l: '수상 표시', t: 'text' },
        { k: 'awardId', l: '연결 수상', t: 'ref', ref: 'awards' },
        { k: 'problem', l: '문제', t: 'textarea' },
        { k: 'approach', l: '접근 (한 줄에 하나)', t: 'lines' },
        { k: 'decisions', l: '핵심 판단 (한 줄에 하나)', t: 'lines' },
        { k: 'results', l: '결과 (한 줄에 하나)', t: 'lines' },
        { k: 'kpis', l: '숫자 지표', t: 'objects', fields: [{ k: 'label', l: '이름', t: 'text' }, { k: 'value', l: '값', t: 'text' }, { k: 'note', l: '설명', t: 'text' }] },
        { k: 'stack', l: '도구 (쉼표로 구분)', t: 'tags' },
        { k: 'aiUse', l: 'AI 활용', t: 'textarea' },
        { k: 'limits', l: '한계와 다음 단계', t: 'textarea' },
        { k: 'links', l: '링크', t: 'objects', fields: link.concat([{ k: 'type', l: '종류', t: 'select', options: LINK_TYPE }]) },
        { k: 'video', l: '영상', t: 'object', fields: [
          { k: 'src', l: '영상 파일 (mp4, 90MB 이하)', t: 'file', folder: 'assets_src/video', accept: 'video/mp4', store: 'name' },
          { k: 'caption', l: '설명', t: 'text' },
          { k: 'poster', l: '표지 이미지 경로', t: 'text', hint: '예: media/<id>/01-cover.webp' }] },
        { k: '__gallery', l: '사진·화면 (첫 번째 = 카드 표지)', t: 'gallery' },
        { k: 'image', l: '공유 이미지 원본 (선택)', t: 'text' },
        { k: 'slides', l: '발표자료 페이지 번호 (쉼표)', t: 'tags', numeric: true }
      ]
    },
    {
      key: 'press', label: '보도', icon: '📰', help: '같은 프로젝트의 기사는 하나의 묶음으로 보여요. \'대표 기사\'를 켠 기사가 묶음 맨 위에 나와요.',
      title: function (x) { return x.displayTitle || x.title || '(제목 없음)'; },
      sub: function (x) { return [x.date, x.outlet, x.project].filter(Boolean).join(' · '); },
      make: function () { return { date: '', outlet: '', title: '', displayTitle: '', url: '', project: '', award: '', mentions: 'name', summary: '', alsoAt: [] }; },
      fields: [
        { k: 'date', l: '보도일', t: 'date', req: true },
        { k: 'outlet', l: '매체', t: 'text', req: true },
        { k: 'title', l: '기사 원제목', t: 'text', req: true },
        { k: 'displayTitle', l: '표시 제목 (팀원 실명이 있으면 바꿔 적기)', t: 'text' },
        { k: 'url', l: '기사 주소', t: 'url', req: true },
        { k: 'project', l: '프로젝트 이름', t: 'text' },
        { k: 'projectId', l: '연결 프로젝트', t: 'ref', ref: 'projects' },
        { k: 'awardId', l: '연결 수상', t: 'ref', ref: 'awards' },
        { k: 'award', l: '수상 표시', t: 'text' },
        { k: 'summary', l: '요약', t: 'textarea' },
        { k: 'lead', l: '대표 기사', t: 'bool' },
        { k: 'mentions', l: '내 이름 언급', t: 'select', options: [['name', '이름이 나옴'], ['team', '팀만 나옴']] },
        { k: 'photo', l: '대표 사진', t: 'object', fields: [
          { k: 'src', l: '사진', t: 'image', folder: 'media/press', maxW: 1200 },
          { k: 'credit', l: '출처 (사진: …)', t: 'text' },
          { k: 'alt', l: '사진 설명 (대체 텍스트)', t: 'text' },
          { k: 'pos', l: '자르는 위치 (선택)', t: 'text', hint: '예: 50% 20% (세로 사진의 얼굴 위치)' }] },
        { k: 'alsoAt', l: '같은 소식을 실은 매체', t: 'objects', fields: [{ k: 'outlet', l: '매체', t: 'text' }, { k: 'url', l: '주소', t: 'url' }, { k: 'date', l: '날짜', t: 'date' }, { k: 'title', l: '제목', t: 'text' }] }
      ]
    },
    {
      key: 'talks', label: '발표 일정', icon: '🎤', help: '오늘 이후 날짜만 사이트에 보여요. 지난 발표는 지우지 않아도 자동으로 숨겨져요.',
      title: function (x) { return x.title || '(제목 없음)'; },
      sub: function (x) { return [x.date, x.event].filter(Boolean).join(' · '); },
      make: function () { return { date: '', title: '', event: '', type: '본선', desc: '', upcoming: true }; },
      fields: [
        { k: 'date', l: '날짜', t: 'date', req: true },
        { k: 'dateLabel', l: '날짜 옆 문구 (선택)', t: 'text', hint: '예: 11.24–25 (1박 2일)' },
        { k: 'title', l: '제목', t: 'text', req: true },
        { k: 'event', l: '대회·행사', t: 'text' },
        { k: 'type', l: '종류', t: 'text', hint: '예: 본선 · 결선 · 데모데이' },
        { k: 'role', l: '내 역할', t: 'text' },
        { k: 'desc', l: '설명', t: 'textarea' },
        { k: 'projectId', l: '연결 프로젝트', t: 'ref', ref: 'projects' },
        { k: 'link', l: '관련 링크', t: 'url' },
        { k: 'upcoming', l: '예정', t: 'bool' }
      ]
    },
    {
      key: 'updates', label: '최근 소식', icon: '🔔', help: '수상 섹션의 \'최근 소식\' 목록이에요. 최신 날짜가 위로 가요.',
      title: function (x) { return x.text || '(내용 없음)'; },
      sub: function (x) { return x.date || ''; },
      make: function () { return { date: '', text: '', type: 'award', link: '' }; },
      fields: [
        { k: 'date', l: '날짜', t: 'date', req: true },
        { k: 'text', l: '내용', t: 'textarea', req: true },
        { k: 'type', l: '종류', t: 'select', options: [['award', '수상'], ['finalist', '본선 진출'], ['selected', '선정·합격'], ['program', '프로그램'], ['ongoing', '진행 중']] },
        { k: 'link', l: '원문 링크', t: 'url' }
      ]
    },
    {
      key: 'experience', label: '활동', icon: '💼', help: '활동 타임라인이에요. 기간에 \'현재\'가 있으면 \'진행 중\' 표시가 붙어요.',
      title: function (x) { return x.title || '(제목 없음)'; },
      sub: function (x) { return [x.period, x.org].filter(Boolean).join(' · '); },
      make: function () { return { period: '', title: '', org: '', role: '', desc: '' }; },
      fields: [
        { k: 'period', l: '기간', t: 'text', req: true, hint: '예: 2026.09 – 현재' },
        { k: 'title', l: '활동 이름', t: 'text', req: true },
        { k: 'org', l: '기관', t: 'text' },
        { k: 'role', l: '역할', t: 'text' },
        { k: 'desc', l: '설명', t: 'textarea' },
        { k: 'link', l: '링크', t: 'url' },
        { k: 'highlight', l: '교육 섹션 대표 카드 (교육 봉사일 때)', t: 'bool' }
      ]
    },
    {
      key: 'education', label: '교육·수료', icon: '🎓', help: '\'대표 카드\'를 켠 항목이 교육 섹션 위쪽 카드로 나와요(전체에서 3개까지).',
      title: function (x) { return x.program || '(과정 없음)'; },
      sub: function (x) { return [x.date, x.org, x.status].filter(Boolean).join(' · '); },
      make: function () { return { date: '', program: '', org: '', status: '수료' }; },
      fields: [
        { k: 'date', l: '수료일', t: 'date', req: true },
        { k: 'program', l: '과정 이름', t: 'text', req: true },
        { k: 'org', l: '기관', t: 'text' },
        { k: 'status', l: '상태', t: 'text', hint: '예: 교육 우수 수료 (2026.10.02–11.06)' },
        { k: 'highlight', l: '대표 카드', t: 'bool' }
      ]
    },
    {
      key: 'certifications', label: '자격', icon: '📜',
      title: function (x) { return x.name || '(이름 없음)'; },
      sub: function (x) { return [x.date, x.issuer].filter(Boolean).join(' · '); },
      make: function () { return { name: '', issuer: '', date: '', note: '' }; },
      fields: [
        { k: 'name', l: '자격 이름', t: 'text', req: true },
        { k: 'issuer', l: '발급 기관', t: 'text' },
        { k: 'date', l: '취득일', t: 'date' },
        { k: 'note', l: '메모', t: 'text' },
        { k: 'highlight', l: '대표 카드', t: 'bool' }
      ]
    },
    {
      key: 'ongoing', label: '진행 중', icon: '⏱️', help: '아직 끝나지 않은 과정·활동이에요. 수료하면 지우고 \'교육·수료\'에 추가하세요.',
      title: function (x) { return x.name || '(이름 없음)'; },
      sub: function (x) { return [x.org, x.role].filter(Boolean).join(' · '); },
      make: function () { return { name: '', org: '', role: '', note: '' }; },
      fields: [
        { k: 'name', l: '이름', t: 'text', req: true },
        { k: 'org', l: '기관', t: 'text' },
        { k: 'role', l: '역할·상태', t: 'text', hint: '예: 수강 중 (2026.09–)' },
        { k: 'note', l: '메모', t: 'text' },
        { k: 'highlight', l: '대표 카드', t: 'bool' }
      ]
    },
    {
      key: 'heroBadges', label: '첫 화면 배지', icon: '✨', help: '첫 화면 이름 아래의 수상 배지예요.',
      title: function (x) { return x.label || '(문구 없음)'; },
      sub: function (x) { return x.awardId || ''; },
      make: function () { return { label: '', awardId: '', href: '', tone: 'top' }; },
      fields: [
        { k: 'label', l: '문구', t: 'text', req: true },
        { k: 'awardId', l: '연결 수상', t: 'ref', ref: 'awards' },
        { k: 'href', l: '링크', t: 'text', hint: '예: #award-on-jibung' },
        { k: 'tone', l: '색', t: 'select', options: [['grand', '대상 (금색)'], ['top', '최우수 (하늘)']] }
      ]
    },
    {
      key: 'profile', label: '프로필', icon: '👤', kind: 'object', help: '이름·소개·연락처예요. 전화번호와 주소는 넣지 마세요.',
      fields: [
        { k: 'nameKo', l: '이름', t: 'text', req: true },
        { k: 'nameEn', l: '영문 이름', t: 'text' },
        { k: 'headline', l: '한 줄 소개', t: 'text' },
        { k: 'headlineEn', l: '영문 한 줄 소개', t: 'text' },
        { k: 'roles', l: '역할 (한 줄에 하나)', t: 'lines' },
        { k: 'intro', l: '소개 문단 (한 줄에 한 문장)', t: 'lines' },
        { k: 'email', l: '이메일', t: 'text' }
      ]
    },
    {
      key: 'sections', label: '섹션 문구', icon: '🧩', kind: 'map', help: '각 섹션의 작은 제목·제목·설명이에요.',
      fields: [
        { k: 'kicker', l: '작은 제목 (영문)', t: 'text' },
        { k: 'title', l: '제목', t: 'text' },
        { k: 'summary', l: '설명', t: 'textarea' }
      ]
    }
  ];
})();
