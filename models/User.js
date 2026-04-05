const db = require('../config/database');
const bcrypt = require('bcryptjs');

class User {
    // Создание пользователя
    static async create(userData) {
        try {
            const { name, email, password } = userData;
            
            // Хеширование пароля
            const hashedPassword = await bcrypt.hash(password, 12);
            
            const result = await db.run(
                `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`,
                [name, email, hashedPassword]
            );
            
            // Получаем созданного пользователя
            const user = await this.findById(result.id);
            return user;
        } catch (error) {
            if (error.message.includes('UNIQUE constraint failed')) {
                throw new Error('Пользователь с таким email уже существует');
            }
            throw error;
        }
    }

    // Поиск пользователя по email
    static async findByEmail(email) {
        try {
            const user = await db.get(
                `SELECT id, name, email, password, role, created_at FROM users WHERE email = ?`,
                [email]
            );
            return user;
        } catch (error) {
            throw error;
        }
    }

    // Поиск пользователя по ID
    static async findById(id) {
        try {
            const user = await db.get(
                `SELECT id, name, email, role, created_at FROM users WHERE id = ?`,
                [id]
            );
            return user;
        } catch (error) {
            throw error;
        }
    }

    // Получение всех пользователей
    static async findAll() {
        try {
            const users = await db.all(
                `SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC`
            );
            return users;
        } catch (error) {
            throw error;
        }
    }

    // Проверка пароля
    static async comparePassword(candidatePassword, hashedPassword) {
        return await bcrypt.compare(candidatePassword, hashedPassword);
    }
}

module.exports = User;