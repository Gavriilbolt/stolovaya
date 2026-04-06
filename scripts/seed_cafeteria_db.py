import argparse
import os
import random
import sqlite3
from datetime import date, timedelta


SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS menu_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    calories INTEGER,
    is_available INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS staff (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    position TEXT NOT NULL,
    shift TEXT NOT NULL,
    phone TEXT,
    email TEXT
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id INTEGER,
    order_date TEXT NOT NULL,
    customer_type TEXT NOT NULL,
    total_price REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    line_total REAL NOT NULL DEFAULT 0,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item ON order_items(menu_item_id);
"""


DEFAULT_CATEGORIES = ["Первые блюда", "Вторые блюда", "Салаты", "Напитки", "Десерты"]
DEFAULT_STAFF = [
    ("Иванов Иван Иванович", "Кассир", "Утренняя", "+7 924 000-00-01", "ivanov@example.com"),
    ("Петрова Анна Сергеевна", "Раздача", "Дневная", "+7 924 000-00-02", "petrova@example.com"),
    ("Сидоров Максим Олегович", "Раздача", "Вечерняя", "+7 924 000-00-03", "sidorov@example.com"),
]
DEFAULT_MENU = [
    ("Первые блюда", "Борщ", "Классический борщ со сметаной", 160.0, 220, 1),
    ("Первые блюда", "Суп куриный", "С лапшой и зеленью", 140.0, 180, 1),
    ("Вторые блюда", "Котлета с пюре", "Куриная котлета, картофельное пюре", 220.0, 430, 1),
    ("Вторые блюда", "Паста болоньезе", "Паста с мясным соусом", 260.0, 520, 1),
    ("Салаты", "Оливье", "С курицей и овощами", 130.0, 260, 1),
    ("Напитки", "Компот", "Ягодный компот", 60.0, 90, 1),
    ("Напитки", "Чай", "Чёрный чай", 40.0, 0, 1),
    ("Десерты", "Сырники", "Со сметаной и вареньем", 150.0, 340, 1),
]


def _fetchone(conn: sqlite3.Connection, sql: str, params=()):
    cur = conn.execute(sql, params)
    return cur.fetchone()


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA_SQL)


def reset_db(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        PRAGMA foreign_keys = OFF;
        DROP TABLE IF EXISTS order_items;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS staff;
        DROP TABLE IF EXISTS menu_items;
        DROP TABLE IF EXISTS menu_categories;
        PRAGMA foreign_keys = ON;
        """
    )
    ensure_schema(conn)


def seed_categories(conn: sqlite3.Connection) -> None:
    for name in DEFAULT_CATEGORIES:
        conn.execute("INSERT OR IGNORE INTO menu_categories (name) VALUES (?)", (name,))


def seed_staff(conn: sqlite3.Connection) -> None:
    for row in DEFAULT_STAFF:
        conn.execute(
            """
            INSERT OR IGNORE INTO staff (name, position, shift, phone, email)
            VALUES (?, ?, ?, ?, ?)
            """,
            row,
        )


def seed_menu(conn: sqlite3.Connection) -> None:
    categories = dict(conn.execute("SELECT name, id FROM menu_categories").fetchall())
    for category_name, name, description, price, calories, is_available in DEFAULT_MENU:
        category_id = categories.get(category_name)
        if not category_id:
            continue
        conn.execute(
            """
            INSERT OR IGNORE INTO menu_items
            (category_id, name, description, price, calories, is_available)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (category_id, name, description, price, calories, is_available),
        )


def seed_orders(conn: sqlite3.Connection, days: int) -> None:
    staff_ids = [row[0] for row in conn.execute("SELECT id FROM staff").fetchall()]
    menu_rows = conn.execute("SELECT id, price FROM menu_items WHERE is_available = 1").fetchall()
    if not menu_rows:
        return

    statuses = ["new", "preparing", "completed", "cancelled"]
    customer_types = ["student", "teacher", "guest"]
    today = date.today()

    for day_offset in range(days):
        order_day = today - timedelta(days=day_offset)
        for _ in range(random.randint(1, 5)):
            staff_id = random.choice(staff_ids) if staff_ids and random.random() > 0.2 else None
            status = random.choices(statuses, weights=[3, 3, 6, 1], k=1)[0]
            customer_type = random.choice(customer_types)
            comment = None
            if random.random() < 0.1:
                comment = "Без лука, пожалуйста"

            # create order first (total calculated after items)
            cur = conn.execute(
                """
                INSERT INTO orders (staff_id, order_date, customer_type, total_price, status, comment)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (staff_id, order_day.isoformat(), customer_type, 0, status, comment),
            )
            order_id = cur.lastrowid

            order_total = 0.0
            items_count = random.randint(1, 3)
            picked = random.sample(menu_rows, k=min(items_count, len(menu_rows)))
            for menu_item_id, price in picked:
                qty = random.randint(1, 3)
                unit_price = float(price or 0)
                line_total = unit_price * qty
                order_total += line_total

                conn.execute(
                    """
                    INSERT INTO order_items
                    (order_id, menu_item_id, quantity, unit_price, line_total)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (order_id, menu_item_id, qty, unit_price, line_total),
                )

            conn.execute("UPDATE orders SET total_price = ? WHERE id = ?", (order_total, order_id))


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed SQLite DB for the cafeteria app")
    parser.add_argument(
        "--db",
        default=os.environ.get("DB_FILE", "database.sqlite"),
        help="Path to SQLite DB file (default: DB_FILE env or database.sqlite)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Drop tables and recreate schema before seeding",
    )
    parser.add_argument(
        "--orders-days",
        type=int,
        default=7,
        help="How many past days to generate orders for (default: 7)",
    )
    args = parser.parse_args()

    conn = sqlite3.connect(args.db)
    try:
        conn.row_factory = sqlite3.Row
        if args.reset:
            reset_db(conn)
        else:
            ensure_schema(conn)

        seed_categories(conn)
        seed_staff(conn)
        seed_menu(conn)

        # only generate orders when there are none (to keep the script idempotent by default)
        row = _fetchone(conn, "SELECT COUNT(*) AS cnt FROM orders")
        if int(row["cnt"]) == 0:
            seed_orders(conn, max(args.orders_days, 0))

        conn.commit()
        print(f"Seed completed: {args.db}")
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
