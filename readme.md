# Университетская столовая (University Cafeteria App)

Веб-приложение на Node.js для учёта работы университетской столовой:

- меню блюд;
- заказы посетителей;
- персонал;
- PDF-отчёт по заказам;



## Стек проекта

### Backend
- **Node.js**
- **Express**
- **EJS** (шаблоны)
- **SQLite3** (локальная БД)
- **PDFKit** (генерация PDF-отчётов)

### Frontend
- HTML + EJS
- CSS
- Vanilla JavaScript

### Data/Tooling
- npm / nodemon


## Основные возможности

- Дашборд со статистикой (блюда, доступность, заказы, сотрудники).
- CRUD для:
  - меню (`/menu`)
  - заказов (`/orders`)
  - персонала (`/staff`)
- Заказ с несколькими блюдами (позиции заказа).
- Автоматическая генерация и скачивание PDF-чека после создания заказа.
- Выгрузка PDF-отчёта по заказам: `/reports/orders`.
- Автосоздание схемы SQLite при старте приложения (если таблиц нет).
- Сидирование БД тестовыми данными через `scripts/seed_cafeteria_db.py`.


## Запуск локально

### 1) Требования

- Node.js 18+ (рекомендуется 20+)
- npm
- Python 3 (опционально, для сид-скрипта)

### 2) Установка зависимостей

```bash
npm install
```

### 3) Запустить приложение

```bash
npm start
```

Для разработки (автоперезапуск):

```bash
npm run dev
```

После запуска приложение будет доступно по адресу:

- `http://localhost:3000`

---

## Сидирование базы данных (опционально)

По умолчанию приложение создаёт таблицы при старте. Если нужны тестовые данные:

```bash
python scripts/seed_cafeteria_db.py --db database.sqlite
```

Сбросить БД и создать заново:

```bash
python scripts/seed_cafeteria_db.py --db database.sqlite --reset
```

---

## Запуск внутри Docker-контейнера
Как собрать и запустить
```bash
docker build -t stolovaya-app .
docker run --name stolovaya-container -p 3000:3000 stolovaya-app
```


## Структура проекта (кратко)

```text
config/                  # подключение и инициализация БД
controllers/             # контроллеры (PDF-отчёт)
public/                  # статика (CSS/JS)
routes/                  # роуты
scripts/                 # утилиты (сидирование БД)
views/                   # EJS-шаблоны
server.js                # точка входа
database.sqlite          # SQLite база
```
