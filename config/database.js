const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

class Database {
    constructor() {
        this.db = null;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const dbPath = path.join(__dirname, '..', process.env.DB_FILE || './database.sqlite');
            
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('❌ Error connecting to SQLite database:', err.message);
                    reject(err);
                } else {
                    console.log('✅ Connected to SQLite database');

                    this.run('PRAGMA foreign_keys = ON')
                        .then(() => this.ensureSchema())
                        .then(() => this.checkConnection())
                        .then(() => resolve(this.db))
                        .catch(reject);
                }
            });
        });
    }

    async ensureSchema() {
        await this.exec(`
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
        `);

        const categoryCount = await this.get('SELECT COUNT(*) AS cnt FROM menu_categories');
        if ((categoryCount?.cnt || 0) === 0) {
            const defaultCategories = ['Первые блюда', 'Вторые блюда', 'Салаты', 'Напитки', 'Десерты'];
            for (const name of defaultCategories) {
                await this.run('INSERT INTO menu_categories (name) VALUES (?)', [name]);
            }
        }

        // Backfill legacy single-item orders (if any) into order_items
        try {
            await this.exec(`
                INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price, line_total)
                SELECT
                    o.id AS order_id,
                    o.menu_item_id,
                    COALESCE(o.quantity, 1) AS quantity,
                    CASE
                        WHEN o.quantity IS NULL OR o.quantity = 0 THEN o.total_price
                        ELSE (o.total_price / o.quantity)
                    END AS unit_price,
                    COALESCE(o.total_price, 0) AS line_total
                FROM orders o
                WHERE
                    o.menu_item_id IS NOT NULL
                    AND NOT EXISTS (
                        SELECT 1 FROM order_items oi WHERE oi.order_id = o.id
                    );
            `);
        } catch (error) {
            // ignore if legacy columns do not exist in a fresh schema
        }

        console.log('✅ Database schema ensured');
    }

    async checkConnection() {
        try {
            // Простая проверка что база работает
            await this.run('SELECT 1');
            console.log('✅ Database connection verified');
        } catch (error) {
            console.error('❌ Database connection test failed:', error);
            throw error;
        }
    }

    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    exec(sql) {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close();
            console.log('✅ Database connection closed');
        }
    }
}

// Создаем и экспортируем экземпляр базы данных
const database = new Database();
module.exports = database;
