# Dcross_web_egov

# Dcross 프로젝트 환경 설정 및 실행 매뉴얼

본 프로젝트는 **전자정부 표준프레임워크(eGovFrame) 5.0**과 **React**가 통합된 환경입니다. 팀원들은 아래 절차에 따라 개발 환경을 구성해 주시기 바랍니다.

## 1. 필수 소프트웨어 설치

### 1.1 전자정부 표준프레임워크 개발환경 (IDE)
- **버전**: v5.0.0 (Windows 64bit)
- **다운로드**: [egovframe.go.kr](https://www.egovframe.go.kr/home/sub.do?menuNo=94) -> 개발환경 5.0 다운로드
- **설치**: 압축 해제 후 `eclipse/eclipse.exe` 실행

### 1.2 Node.js 설치
- **버전**: v22.15.0 이상 (LTS 버전 추천)
- **다운로드**: [nodejs.org](https://nodejs.org/)
- **확인**: 터미널(CMD)에서 `node -v`, `npm -v` 명령어로 설치 확인

### 1.3 SVN 플러그인 (Eclipse)
- Eclipse 내 `Help` -> `Eclipse Marketplace` -> **Subversive** 또는 **Subclipse** 검색 후 설치

---

## 2. 프로젝트 다운로드 (SVN Checkout)

1. Eclipse의 `SVN Repositories` 뷰에서 새 리포지토리 추가
2. **URL**: https://desktop-nptddem/svn/Dcross_web_egov
3. **리포지토리 명**: `Dcross_web_egov`
4. 프로젝트 선택 후 `Check out` 실행

---

## 3. 프로젝트 초기 설정

### 3.1 DB 접속 정보 파일 생성
src/main/resources/application-local.yml 파일을 직접 만들어야 합니다.

```yaml
# src/main/resources/application-local.yml
spring:
  datasource:
    url: jdbc:oracle:thin:@{서버IP}:{포트}/{서비스명}
    username: DB계정
    password: DB비밀번호
실제 값 예시 (application-local.yml.example 파일 참고):
```

```yaml
spring:
  datasource:
    url: jdbc:oracle:thin:@210.109.111.140:1309/orcl
    username: DACOS309
    password: 비밀번호
```
    
### 3.3 Maven 프로젝트 인식 & 업데이트
1. 프로젝트 우클릭 -> `Configure` -> `Convert to Maven Project` (이미 되어있다면 생략)
2. 프로젝트 우클릭 -> `Maven` -> `Update Project...` -> `Force Update of Snapshots/Releases` 체크 후 OK
3. (중요) 이클립스에서 프로젝트 선택 후 **F5 (Refresh)** 실행

### 3.2 리액트 의존성 설치 (최초 1회)
- Maven 빌드 시 자동으로 수행되지만, 수동으로 하려면:
  - `src/main/frontend` 폴더에서 터미널 열기 (cd C:\eGovFrameDev-5.0.0-Windows-64bit\workspace-egov\Dcross_web_backend\src\main\frontend)
  - `npm install` 실행

---

## 4. 실행 방법

### 4.1 전체 통합 실행 (백엔드 + 프런트엔드)
본 프로젝트는 자바 서버에서 리액트를 함께 서비스하도록 설정되어 있습니다.
1. `Dcross_web_backend` 프로젝트 우클릭 -> **Run As -> Spring Boot App** (또는 Server 실행)
2. **접속 주소**: `http://localhost:8081` (또는 지정된 포트)

### 4.2 리액트 개발 모드 (Hot-Reload 필요 시)
리액트 코드를 수정하면서 바로 확인하고 싶을 때 사용합니다.
1. `src/main/frontend` 폴더에서 터미널 열기
2. `npm start` 실행
3. **접속 주소**: `http://localhost:3000` (백엔드로 자동 프록시 연결됨)

---

## 5. 참고 사항

- **로그 확인**: 톰캣/이클립스 Console 창에서 확인 가능 (logger.info , logger.error, logger.debug 등 사용가능)
- **자동 재시작**: `spring-boot-devtools`가 포함되어 있어 자바 파일 수정 시 서버가 자동 재시작됩니다. (Eclipse의 `Project -> Build Automatically` 필수)
- **정적 리소스**: 리액트 빌드 결과물은 자동으로 `src/main/resources/static`으로 배포됩니다.


# Dcross 프로젝트 개발 가이드

## 1. 전자정부프레임워크 v5.0으로 바꾼 이유?

### 전자정부프레임워크(eGovFrame) + Spring Boot
기존 프로젝트가 전자정부프레임워크3.6.xx 기반이었습니다. 전자정부프레임워크는 Spring MVC 위에서 동작하는데, 여기에 **Spring Boot를 함께 사용**한 이유는 다음과 같습니다:

| 항목 | 기존 eGovFrame 단독 | eGovFrame + Spring Boot |
|------|--------------------|-----------------------|
| 서버 실행 | Tomcat 별도 설치·배포 | `Run as Spring Boot App` 한 번에 실행 |
| 설정 파일 | XML 위주 (복잡) | `application.yml` 한 곳에 통합 |
| DB 설정 | DataSource 빈 직접 등록 | 자동 설정(Auto Configuration) |
| 개발 속도 | 느림 | 코드 수정 시 자동 재시작(DevTools) |

> **결론**: eGovFrame의 표준을 유지하면서 Spring Boot의 편의성을 더해, 개발 생산성을 높였습니다.

### React (프론트엔드)
기존 Node.js(Express) 기반 서버사이드 렌더링을 React 클라이언트 사이드로 전환했습니다.

- **컴포넌트 재사용**: 한 번 만든 UI 조각을 여러 화면에서 재사용 가능
- **상태 관리**: 로그인 정보, 탭 상태 등을 앱 전체에서 쉽게 공유
- **백엔드 분리**: Spring Boot는 API만 제공, 화면(UI)은 React가 담당 → 역할이 명확

---

## 2. 프로젝트 전체 구조

```
Dcross_web_backend/
├── src/main/java/com/dacos/
│   ├── Application.java            ← Spring Boot 진입점 (main 메서드)
│   ├── config/
│   │   ├── DatabaseConfig.java     ← Oracle DB + MyBatis 설정
│   │   ├── WebConfig.java          ← CORS, 정적 파일 경로, Jackson 설정
│   │   └── SpaForwardController.java ← React 새로고침 지원
│   ├── common/
│   │   ├── ApiResponse.java        ← 표준 JSON 응답 형식
│   │   ├── BusinessException.java  ← 비즈니스 예외 (401, 404 등)
│   │   └── GlobalExceptionHandler.java ← 전역 에러 처리
│   ├── auth/                       ← 로그인/인증 모듈
│   │   ├── AuthController.java
│   │   ├── AuthService.java
│   │   ├── dto/ (LoginRequest, UserDto)
│   │   └── mapper/ (AuthMapper.java)
│   ├── newcar/                     ← 신차 등록 모듈
│   │   ├── NewcarController.java
│   │   ├── NewcarService.java
│   │   ├── dto/ (NewcarSearchRequest, NewcarDto)
│   │   └── mapper/ (NewcarMapper.java)
│   └── code/                       ← 공통 코드/대리점 모듈
│       ├── CodeController.java
│       ├── CodeService.java
│       └── mapper/ (CodeMapper.java)
│
├── src/main/resources/
│   ├── application.yml             ← DB 연결 정보, MyBatis 설정
│   ├── mapper/
│   │   ├── AuthMapper.xml          ← SQL 쿼리 (MyBatis)
│   │   ├── NewcarMapper.xml
│   │   └── CodeMapper.xml
│   └── static/                     ← React 빌드 결과물 (index.html 등)
│
└── src/main/frontend/              ← React 소스 코드
    └── src/
        ├── App.js                  ← 라우터 설정 (화면 URL 등록)
        ├── context/
        │   ├── AuthContext.jsx     ← 로그인 상태 전역 관리
        │   └── TabContext.jsx      ← 탭 상태 전역 관리
        ├── components/
        │   ├── LoginPage.jsx
        │   ├── common/
        │   │   ├── ErpSection.jsx  ← [공통] 섹션 박스 컴포넌트
        │   │   └── ErpField.jsx    ← [공통] 라벨+입력 한 줄 컴포넌트
        │   ├── layout/
        │   │   └── Layout.jsx      ← 상단 메뉴 + 탭 + 콘텐츠 영역
        │   └── newcar/
        │       ├── NewcarList.jsx  ← 신규신청현황 화면
        │       └── NewcarRequest.jsx ← 신규신청 등록/수정 화면
        └── pages/
            └── HomePage.jsx
```

---

## 3. 백엔드 API 요청/응답 규칙

### 요청 형식
모든 API URL은 `/api/` 로 시작합니다.

```
GET  /api/codes/{groupId}       → 공통 코드 조회
GET  /api/companies             → 대리점 목록 조회
POST /api/newcar/list           → 신차 목록 조회
GET  /api/newcar/detail/{id}    → 신차 상세 조회
POST /api/login                 → 로그인
```

### 응답 형식
```json
// 성공
{ "success": true, "data": { ... } }
{ "success": true, "list": [ ... ] }

// 실패
{ "success": false, "message": "에러 메시지" }
```

---

## 4. 새 화면 추가하는 방법

### Step 1: 백엔드 API 추가 (Java)

```
1. src/main/java/com/dacos/ 에 새 패키지 생성 (예: mortgage/)
2. DTO 클래스 생성 (dto/ 폴더)
3. Mapper 인터페이스 생성 (mapper/ 폴더)
4. resources/mapper/ 에 XML 파일 생성 (SQL 작성)
5. Service 클래스 생성
6. Controller 클래스 생성 (@RestController, @RequestMapping("/api/..."))
```

**컨트롤러 예시 (try-catch 없이 깔끔하게)**
```java
@RestController
@RequestMapping("/api")
public class MyController {
    @Autowired
    private MyService myService;

    @GetMapping("/my-data")
    public ResponseEntity<Map<String, Object>> getData() {
        List<Map<String, Object>> list = myService.getData();
        return ResponseEntity.ok(ApiResponse.withKey("list", list));
    }
}
// 에러는 GlobalExceptionHandler가 자동으로 처리합니다.
```

### Step 2: 프론트엔드 화면 추가 (React)

**1) 새 JSX 파일 생성**
```
src/components/[모듈명]/새화면.jsx
```

**2) App.js에 라우트(URL) 등록**
```jsx
// App.js 에 추가
import 새화면 from './components/모듈명/새화면';

<Route
  path="/모듈명/새화면"
  element={
    <ProtectedRoute>     {/* 로그인 필요 */}
      <Layout>           {/* 상단 메뉴 + 탭 포함 */}
        <새화면 />
      </Layout>
    </ProtectedRoute>
  }
/>
```

**3) SpaForwardController.java에 경로 추가**
```java
// 새로고침 지원을 위해 경로 추가
@RequestMapping(value = {
    "/모듈명/**",  // ← 추가
    ...
})
public String forwardToIndex() {
    return "forward:/index.html";
}
```

---

## 5. 공통 컴포넌트 재사용 방법

### ErpSection - 섹션 박스
ERP 스타일의 테두리 박스를 만들 때 사용합니다.

```jsx
import ErpSection from '../common/ErpSection';

// 검색 조건 박스 (헤더 스타일)
<ErpSection isHeader={true}>
    <div className="erp-row">...</div>
</ErpSection>

// 일반 정보 박스 (제목 있음)
<ErpSection title="기본 정보">
    <div className="erp-row">...</div>
</ErpSection>
```

### ErpField - 라벨 + 입력 한 줄
라벨과 입력폼을 한 줄로 묶을 때 사용합니다.

```jsx
import ErpField from '../common/ErpField';

// 기본 사용
<ErpField label="차량번호" span={2}>
    <input type="text" className="erp-input" value={...} onChange={...} />
</ErpField>

// span: 가로 칸 수 (1~12, 기본값 2)
// label: 왼쪽에 표시될 라벨 텍스트
```

### useAuth - 로그인 정보 사용
어느 컴포넌트에서든 로그인한 사용자 정보를 가져올 수 있습니다.
```jsx
import { useAuth } from '../../context/AuthContext';

const MyComponent = () => {
    const { user, logout } = useAuth();
    // user.userId, user.memberId, user.memberNm 등 사용 가능
    return <div>안녕하세요, {user?.memberNm}님</div>;
};
```

---

## 6. 데이터 조회 패턴 (복사해서 쓰세요)

```jsx
import axios from 'axios';
import { useState, useEffect } from 'react';

const MyPage = () => {
    const [list, setList] = useState([]);

    // 데이터 조회 함수
    const fetchData = async () => {
        try {
            const response = await axios.post('/api/my-endpoint', {
                PARAM1: 'value1',
                PARAM2: 'value2',
            });
            if (response.data.success) {
                setList(response.data.list);   // 백엔드 응답 키에 따라 변경
            }
        } catch (error) {
            console.error('조회 실패:', error);
        }
    };

    // 화면 시작 시 자동 조회
    useEffect(() => {
        fetchData();
    }, []); // [] = 최초 1회만 실행

    return <div>...</div>;
};
```

---

## 7. 개발 시 자주 쓰는 명령어

```bash
# 프론트엔드 개발 서버 (포트 3000) - React만 따로 실행할 때
cd src/main/frontend
npm start

# 프론트엔드 빌드 (Spring Boot가 서빙하도록 static 폴더에 생성)
npm run build

# 백엔드 실행
Eclipse → Run as Spring Boot App
# 또는 포트: 8081
```

> [!IMPORTANT]
> 개발 중에는 `npm start`로 React를 띄우고 Spring Boot도 동시에 실행하세요.
> `src/main/frontend/src/setupProxy.js`에 프록시 설정이 있어 React(3000)에서 API 요청이 자동으로 Spring Boot(8081)로 전달됩니다.

> [!TIP]
> 배포할 때는 `npm run build` 후 Spring Boot만 실행하면 됩니다.
