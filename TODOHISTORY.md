# 프로젝트 히스토리 (TODOHISTORY)

## 프로젝트 개요
**Sound Design Atlas**: 사운드 디자인 지식을 시각적인 노드(Node) 기반 그래프로 보여주고 탐색할 수 있는 위키/아틀라스 웹사이트.
- **주요 기술 스택**: React, Vite, react-force-graph-2d, react-markdown

## 🚀 주요 구현 완료 기능 및 히스토리

### 1. 마크다운 기반 데이터 파싱 (`scripts/generateGraph.js`)
- `public/content/` 폴더 내의 마크다운(`.md`) 파일들을 읽어 그래프 노드 데이터(`graphData.json`)로 자동 변환하는 시스템 구축.
- Frontmatter(YAML) 속성을 파싱하여 `title`(노드 이름), `group`(카테고리), `val`(크기), `links`(노드 간 연결) 속성 추출.

### 2. 메인 UI 및 레이아웃 (`src/App.jsx`)
- **좌측 사이드바**: 검색창 및 섹터(카테고리) 리스트 구현. 특정 섹터 클릭 시 해당 그룹의 노드만 하이라이트(강조)되는 기능.
- **중앙 캔버스 (`GraphCanvas`)**: 2D 인터랙티브 노드 그래프 시각화.
- **우측 디테일 패널 (`MarkdownRenderer`)**: 노드 클릭 시 우측에서 슬라이드되며 나타나는 정보 패널. 해당 마크다운 파일의 내용을 렌더링.

### 3. 버그 수정 및 사용성 개선 (최근 커밋 기반)
- **그래프 상호작용 개선**: 그래프 내 노드 드래그 관련 다수의 버그 픽스 (`drag_bug1` ~ `drag_bug4`).
- **마크다운/콘텐츠 렌더링**: 옵시디언(Obsidian) 환경 대응(`obsidian`) 및 링크 클릭/업로드 관련 버그 해결 (`link_test`, `upload_bug`).
- **UI 디테일**: 제목 수정 방법 개선, 우클릭 이미지 관련 처리 (`rightclick_image`).

### 4. 최근 진행 내역 (사운드 아카이빙 구조화 및 최적화)
- **3D 캔버스 성능 최적화 (`GraphCanvas.jsx`)**: 
  - 화면 프레임 드랍(렉) 현상 해결을 위해 파티클 및 구름(Clouds) 렌더링 수를 최적화하고, 컴포넌트 언마운트 시 Three.js Geometry 및 Material을 메모리에서 해제(Dispose)하는 클린업 로직 추가.
- **강연 자료 아카이빙(옵시디언) 구조 확립**: 
  - `public/content/강연리뷰/cedec_강연자료/[강연명]` 폴더 번들 구조 확립.
  - 대규모 미디어 파일(164개)을 해당 문서의 `media/` 폴더 내로 완벽히 격리하여 아카이빙하는 워크플로우 구성.
  - CEDEC 2022 '별의 커비 디스커버리' 사운드 강연 (83장) 텍스트 전문 번역 및 마크다운 이식 완료.
- **PPTX to Markdown 자동화 스크립트 개발 (`scripts/pptx-archiver/pptx-to-md.cjs`)**:
  - 무거운 PPTX 파일을 드라이브 환경 충돌 없이 백그라운드에서 분석하기 위해, 외부 npm 라이브러리에 의존하지 않는(Zero-Dependency) 순수 Node.js + PowerShell 스크립트 구축.
  - PPTX 내부 XML 매핑을 추적해 이미지를 1:1로 자동 추출하고, Gemini API를 통해 발표자 노트를 한국어로 자동 번역해 옵시디언 마크다운으로 조립해 주는 맞춤형 유틸리티 완성.

---
*💡 이 파일은 그동안 진행해오신 작업의 큰 흐름을 파악하기 위해 작성되었습니다.*
