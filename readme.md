# Университетская столовая (University Cafeteria App)

Веб-приложение на Node.js для учёта работы университетской столовой:

- меню блюд;
- заказы посетителей;
- персонал;
- PDF-отчёт по заказам;
- сидирование SQLite базы тестовыми данными.

---

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
- Python 3 (для сид-скрипта)
- npm / nodemon

---

## Основные возможности

- Дашборд со статистикой (блюда, доступность, заказы, сотрудники).
- CRUD для:
  - меню (`/menu`)
  - заказов (`/orders`)
  - персонала (`/staff`)
- Выгрузка PDF-отчёта по заказам: `/reports/orders`.
- Автосоздание схемы SQLite при старте приложения.
- Сидирование БД через `scripts/seed_cafeteria_db.py`.

---

## Запуск локально

### 1) Требования

- Node.js 18+ (рекомендуется 20+)
- npm

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
