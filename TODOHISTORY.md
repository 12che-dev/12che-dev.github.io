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

---
*💡 이 파일은 그동안 진행해오신 작업의 큰 흐름을 파악하기 위해 작성되었습니다.*
