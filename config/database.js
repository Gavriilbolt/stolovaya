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
                    // Просто проверяем подключение, не создаем таблицы
                    this.checkConnection()
                        .then(() => resolve(this.db))
                        .catch(reject);
                }
            });
        });
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