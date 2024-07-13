# Coin Tracker


## 시작하기

### 사전 요구 사항
- Node.js
- MariaDB

### 설치

1. 리포지토리를 클론합니다:
    ```sh
    git clone https://github.com/ckdqja135/coin-tracker.git
    cd coin-tracker
    ```

2. 종속성을 설치합니다:
    ```sh
    npm i
    ```

3. `config/config.json` 파일에서 데이터베이스 구성을 설정합니다.

4. 데이터베이스 마이그레이션을 실행합니다:
    ```sh
    npx sequelize-cli db:migrate
    ```

5. 서버를 시작합니다:
    ```sh
    npm run dev
    ```
