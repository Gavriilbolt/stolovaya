#!/usr/bin/env python3
"""Seed SQLite database with sample data for the cafeteria app.

Usage:
    python scripts/seed_cafeteria_db.py
    python scripts/seed_cafeteria_db.py --db ./database.sqlite --reset
"""

from __future__ import annotations

import argparse
import sqlite3
from datetime import date, timedelta
from pathlib import Path


CATEGORIES = [
    "Горячие блюда",
    "Супы",
    "Салаты",
    "Напитки",
    "Десерты",
]

MENU_ITEMS = [
    ("Горячие блюда", "Плов с курицей", "Рис, курица, овощи", 185.0, 540, 1),
    ("Горячие блюда", "Паста Карбонара", "Сливочный соус, бекон", 210.0, 610, 1),
    ("Супы", "Борщ", "Классический со сметаной", 130.0, 280, 1),
    ("Супы", "Куриный суп", "С лапшой и зеленью", 125.0, 240, 1),
    ("Салаты", "Цезарь", "Курица, салат, сухарики", 165.0, 320, 1),
    ("Салаты", "Овощной", "Свежие овощи", 110.0, 140, 1),
    ("Напитки", "Компот", "Ягодный компот", 55.0, 90, 1),
    ("Напитки", "Чай черный", "Порция 300 мл", 40.0, 20, 1),
    ("Десерты", "Сырники", "Со сметаной", 145.0, 350, 1),
    ("Десерты", "Наполеон", "Порционный", 120.0, 370, 0),
]

STAFF = [
    ("Иван Кузнецов", "Шеф-повар", "Утренняя", "+7-900-100-00-01", "ivan.k@university.local"),
    ("Мария Соколова", "Повар", "Дневная", "+7-900-100-00-02", "maria.s@university.local"),
    ("Олег Смирнов", "Кассир", "Дневная", "+7-900-100-00-03", "oleg.s@university.local"),
    ("Анна Петрова", "Линия раздачи", "Вечерняя", "+7-900-100-00-04", "anna.p@university.local"),
]


SCHEMA_SQL = [
    "PRAGMA foreign_keys = ON;",
    """
    CREATE TABLE IF NOT EXISTS menu_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS menu_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL DEFAULT 0,
        calories INTEGER,
        is_available INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE RESTRICT
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS staff (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        position TEXT NOT NULL,
        shift TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    """,
    """
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        menu_item_id INTEGER NOT NULL,
        staff_id INTEGER,
        order_date DATE NOT NULL,
        customer_type TEXT NOT NULL DEFAULT 'student',
        quantity INTEGER NOT NULL DEFAULT 1,
        total_price REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'new',
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
        FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE SET NULL
    );
    """,
]



def ensure_schema(conn: sqlite3.Connection) -> None:
    for statement in SCHEMA_SQL:
        conn.execute(statement)



def maybe_reset(conn: sqlite3.Connection, reset: bool) -> None:
    if not reset:
        return

    conn.execute("DELETE FROM orders")
    conn.execute("DELETE FROM menu_items")
    conn.execute("DELETE FROM staff")
    conn.execute("DELETE FROM menu_categories")



def seed_categories(conn: sqlite3.Connection) -> dict[str, int]:
    for category in CATEGORIES:
        conn.execute(
            "INSERT OR IGNORE INTO menu_categories (name) VALUES (?)",
            (category,),
        )

    rows = conn.execute("SELECT id, name FROM menu_categories").fetchall()
    return {name: category_id for category_id, name in rows}



def seed_menu_items(conn: sqlite3.Connection, category_ids: dict[str, int]) -> list[tuple[int, float]]:
    for category_name, name, description, price, calories, is_available in MENU_ITEMS:
        category_id = category_ids[category_name]
        exists = conn.execute(
            "SELECT 1 FROM menu_items WHERE name = ? AND category_id = ?",
            (name, category_id),
        ).fetchone()
        if exists:
            conn.execute(
                """
                UPDATE menu_items
                SET description = ?, price = ?, calories = ?, is_available = ?
                WHERE name = ? AND category_id = ?
                """,
                (description, price, calories, is_available, name, category_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO menu_items (category_id, name, description, price, calories, is_available)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (category_id, name, description, price, calories, is_available),
            )

    return conn.execute("SELECT id, price FROM menu_items ORDER BY id").fetchall()



def seed_staff(conn: sqlite3.Connection) -> list[int]:
    for name, position, shift, phone, email in STAFF:
        exists = conn.execute(
            "SELECT id FROM staff WHERE name = ? AND position = ?",
            (name, position),
        ).fetchone()
        if exists:
            conn.execute(
                """
                UPDATE staff
                SET shift = ?, phone = ?, email = ?
                WHERE id = ?
                """,
                (shift, phone, email, exists[0]),
            )
        else:
            conn.execute(
                """
                INSERT INTO staff (name, position, shift, phone, email)
                VALUES (?, ?, ?, ?, ?)
                """,
                (name, position, shift, phone, email),
            )

    rows = conn.execute("SELECT id FROM staff ORDER BY id").fetchall()
    return [row[0] for row in rows]



def seed_orders(conn: sqlite3.Connection, menu_rows: list[tuple[int, float]], staff_ids: list[int]) -> None:
    has_orders = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0] > 0
    if has_orders:
        return

    if not menu_rows:
        return

    staff_cycle = staff_ids if staff_ids else [None]
    statuses = ["new", "preparing", "completed", "completed", "cancelled"]
    customer_types = ["student", "teacher", "guest"]
    base_date = date.today()

    for i, (menu_item_id, price) in enumerate(menu_rows[:10]):
        quantity = (i % 3) + 1
        total_price = round((price or 0) * quantity, 2)
        order_date = base_date - timedelta(days=i)

        conn.execute(
            """
            INSERT INTO orders (
                menu_item_id, staff_id, order_date, customer_type,
                quantity, total_price, status, comment
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                menu_item_id,
                staff_cycle[i % len(staff_cycle)],
                order_date.isoformat(),
                customer_types[i % len(customer_types)],
                quantity,
                total_price,
                statuses[i % len(statuses)],
                "Автосид для демонстрации" if i % 2 == 0 else None,
            ),
        )



def print_summary(conn: sqlite3.Connection) -> None:
    tables = ["menu_categories", "menu_items", "staff", "orders"]
    print("✅ Seed completed")
    for table in tables:
        count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"- {table}: {count}")



def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed cafeteria SQLite DB")
    parser.add_argument(
        "--db",
        default="database.sqlite",
        help="Path to SQLite DB file (default: database.sqlite)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing data before seeding",
    )
    return parser.parse_args()



def main() -> None:
    args = parse_args()
    db_path = Path(args.db)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        ensure_schema(conn)
        maybe_reset(conn, args.reset)
        category_ids = seed_categories(conn)
        menu_rows = seed_menu_items(conn, category_ids)
        staff_ids = seed_staff(conn)
        seed_orders(conn, menu_rows, staff_ids)
        conn.commit()
        print_summary(conn)


if __name__ == "__main__":
    main()
