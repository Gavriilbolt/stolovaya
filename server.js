require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Настройка шаблонизатора EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Подключаем базу данных
const db = require('./config/database');

// Подключаем контроллер отчетов
const ReportController = require('./controllers/reportController');

// Главная страница - дашборд
app.get('/', async (req, res) => {
    try {
        const stats = await db.all(`
            SELECT 
                (SELECT COUNT(*) FROM equipment) as total_equipment,
                (SELECT COUNT(*) FROM equipment WHERE status = 'repair') as equipment_in_repair,
                (SELECT COUNT(*) FROM repairs) as total_repairs,
                (SELECT COUNT(*) FROM employees) as total_employees
        `);
        
        const recentRepairs = await db.all(`
            SELECT r.*, e.name as equipment_name, emp.name as employee_name
            FROM repairs r
            LEFT JOIN equipment e ON r.equipment_id = e.id
            LEFT JOIN employees emp ON r.employee_id = emp.id
            ORDER BY r.repair_date DESC LIMIT 5
        `);

        res.render('dashboard', {
            title: 'Система учета ремонта оборудования',
            stats: stats[0],
            recentRepairs: recentRepairs
        });
    } catch (error) {
        console.error('Ошибка загрузки дашборда:', error);
        res.render('dashboard', {
            title: 'Система учета ремонта оборудования',
            stats: { total_equipment: 0, equipment_in_repair: 0, total_repairs: 0, total_employees: 0 },
            recentRepairs: []
        });
    }
});

// 📋 СТРАНИЦА ОБОРУДОВАНИЯ
app.get('/equipment', async (req, res) => {
    try {
        const equipment = await db.all(`
            SELECT e.*, et.name as type_name 
            FROM equipment e 
            LEFT JOIN equipment_types et ON e.type_id = et.id 
            ORDER BY e.inventory_number
        `);
        
        const equipmentTypes = await db.all('SELECT * FROM equipment_types ORDER BY name');
        
        res.render('equipment', {
            title: 'Оборудование',
            equipment: equipment,
            equipmentTypes: equipmentTypes
        });
    } catch (error) {
        console.error('Ошибка загрузки оборудования:', error);
        res.render('equipment', {
            title: 'Оборудование',
            equipment: [],
            equipmentTypes: []
        });
    }
});

// ➕ ДОБАВЛЕНИЕ НОВОГО ОБОРУДОВАНИЯ
app.post('/equipment', async (req, res) => {
    try {
        const { type_id, inventory_number, name, model, purchase_date, location } = req.body;
        
        await db.run(
            `INSERT INTO equipment (type_id, inventory_number, name, model, purchase_date, location) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [type_id, inventory_number, name, model, purchase_date, location]
        );
        
        res.redirect('/equipment');
    } catch (error) {
        console.error('Ошибка добавления оборудования:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось добавить оборудование: ' + error.message 
        });
    }
});

// ✏️ РЕДАКТИРОВАНИЕ ОБОРУДОВАНИЯ - форма
app.get('/equipment/edit/:id', async (req, res) => {
    try {
        const equipment = await db.get(`
            SELECT e.*, et.name as type_name 
            FROM equipment e 
            LEFT JOIN equipment_types et ON e.type_id = et.id 
            WHERE e.id = ?
        `, [req.params.id]);
        
        const equipmentTypes = await db.all('SELECT * FROM equipment_types ORDER BY name');
        
        res.render('equipment-edit', {
            title: 'Редактирование оборудования',
            equipment: equipment,
            equipmentTypes: equipmentTypes
        });
    } catch (error) {
        console.error('Ошибка загрузки оборудования для редактирования:', error);
        res.redirect('/equipment');
    }
});

// ✏️ РЕДАКТИРОВАНИЕ ОБОРУДОВАНИЯ - сохранение
app.post('/equipment/edit/:id', async (req, res) => {
    try {
        const { type_id, inventory_number, name, model, purchase_date, location, status } = req.body;
        
        await db.run(
            `UPDATE equipment SET 
                type_id = ?, inventory_number = ?, name = ?, model = ?, 
                purchase_date = ?, location = ?, status = ?
             WHERE id = ?`,
            [type_id, inventory_number, name, model, purchase_date, location, status, req.params.id]
        );
        
        res.redirect('/equipment');
    } catch (error) {
        console.error('Ошибка редактирования оборудования:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось обновить оборудование: ' + error.message 
        });
    }
});

// 🗑️ УДАЛЕНИЕ ОБОРУДОВАНИЯ
app.post('/equipment/delete/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM equipment WHERE id = ?', [req.params.id]);
        res.redirect('/equipment');
    } catch (error) {
        console.error('Ошибка удаления оборудования:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось удалить оборудование: ' + error.message 
        });
    }
});

// 🔧 СТРАНИЦА РЕМОНТОВ
app.get('/repairs', async (req, res) => {
    try {
        const repairs = await db.all(`
            SELECT r.*, e.name as equipment_name, e.inventory_number, emp.name as employee_name
            FROM repairs r
            LEFT JOIN equipment e ON r.equipment_id = e.id
            LEFT JOIN employees emp ON r.employee_id = emp.id
            ORDER BY r.repair_date DESC
        `);
        
        const equipment = await db.all('SELECT * FROM equipment ORDER BY name');
        const employees = await db.all('SELECT * FROM employees ORDER BY name');
        
        res.render('repairs', {
            title: 'Ремонты',
            repairs: repairs,
            equipment: equipment,
            employees: employees
        });
    } catch (error) {
        console.error('Ошибка загрузки ремонтов:', error);
        res.render('repairs', {
            title: 'Ремонты',
            repairs: [],
            equipment: [],
            employees: []
        });
    }
});

// ➕ ДОБАВЛЕНИЕ НОВОГО РЕМОНТА
app.post('/repairs', async (req, res) => {
    try {
        const { equipment_id, employee_id, repair_date, problem_description, solution, repair_cost } = req.body;
        
        await db.run(
            `INSERT INTO repairs (equipment_id, employee_id, repair_date, problem_description, solution, repair_cost) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [equipment_id, employee_id, repair_date, problem_description, solution, repair_cost || 0]
        );
        
        res.redirect('/repairs');
    } catch (error) {
        console.error('Ошибка добавления ремонта:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось добавить ремонт: ' + error.message 
        });
    }
});

// ✏️ РЕДАКТИРОВАНИЕ РЕМОНТА - форма
app.get('/repairs/edit/:id', async (req, res) => {
    try {
        const repair = await db.get(`
            SELECT r.*, e.name as equipment_name, emp.name as employee_name
            FROM repairs r
            LEFT JOIN equipment e ON r.equipment_id = e.id
            LEFT JOIN employees emp ON r.employee_id = emp.id
            WHERE r.id = ?
        `, [req.params.id]);
        
        const equipment = await db.all('SELECT * FROM equipment ORDER BY name');
        const employees = await db.all('SELECT * FROM employees ORDER BY name');
        
        res.render('repairs-edit', {
            title: 'Редактирование ремонта',
            repair: repair,
            equipment: equipment,
            employees: employees
        });
    } catch (error) {
        console.error('Ошибка загрузки ремонта для редактирования:', error);
        res.redirect('/repairs');
    }
});

// ✏️ РЕДАКТИРОВАНИЕ РЕМОНТА - сохранение
app.post('/repairs/edit/:id', async (req, res) => {
    try {
        const { equipment_id, employee_id, repair_date, problem_description, solution, repair_cost, status } = req.body;
        
        await db.run(
            `UPDATE repairs SET 
                equipment_id = ?, employee_id = ?, repair_date = ?, problem_description = ?, 
                solution = ?, repair_cost = ?, status = ?
             WHERE id = ?`,
            [equipment_id, employee_id, repair_date, problem_description, solution, repair_cost, status, req.params.id]
        );
        
        res.redirect('/repairs');
    } catch (error) {
        console.error('Ошибка редактирования ремонта:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось обновить ремонт: ' + error.message 
        });
    }
});

// 🗑️ УДАЛЕНИЕ РЕМОНТА
app.post('/repairs/delete/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM repairs WHERE id = ?', [req.params.id]);
        res.redirect('/repairs');
    } catch (error) {
        console.error('Ошибка удаления ремонта:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось удалить ремонт: ' + error.message 
        });
    }
});

// 👥 СТРАНИЦА СОТРУДНИКОВ
app.get('/employees', async (req, res) => {
    try {
        const employees = await db.all('SELECT * FROM employees ORDER BY name');
        res.render('employees', {
            title: 'Сотрудники',
            employees: employees
        });
    } catch (error) {
        console.error('Ошибка загрузки сотрудников:', error);
        res.render('employees', {
            title: 'Сотрудники',
            employees: []
        });
    }
});

// ➕ ДОБАВЛЕНИЕ НОВОГО СОТРУДНИКА
app.post('/employees', async (req, res) => {
    try {
        const { name, position, department, phone, email } = req.body;
        
        await db.run(
            `INSERT INTO employees (name, position, department, phone, email) 
             VALUES (?, ?, ?, ?, ?)`,
            [name, position, department, phone, email]
        );
        
        res.redirect('/employees');
    } catch (error) {
        console.error('Ошибка добавления сотрудника:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось добавить сотрудника: ' + error.message 
        });
    }
});

// ✏️ РЕДАКТИРОВАНИЕ СОТРУДНИКА - форма
app.get('/employees/edit/:id', async (req, res) => {
    try {
        const employee = await db.get('SELECT * FROM employees WHERE id = ?', [req.params.id]);
        
        res.render('employees-edit', {
            title: 'Редактирование сотрудника',
            employee: employee
        });
    } catch (error) {
        console.error('Ошибка загрузки сотрудника для редактирования:', error);
        res.redirect('/employees');
    }
});

// ✏️ РЕДАКТИРОВАНИЕ СОТРУДНИКА - сохранение
app.post('/employees/edit/:id', async (req, res) => {
    try {
        const { name, position, department, phone, email } = req.body;
        
        await db.run(
            `UPDATE employees SET 
                name = ?, position = ?, department = ?, phone = ?, email = ?
             WHERE id = ?`,
            [name, position, department, phone, email, req.params.id]
        );
        
        res.redirect('/employees');
    } catch (error) {
        console.error('Ошибка редактирования сотрудника:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось обновить сотрудника: ' + error.message 
        });
    }
});

// 🗑️ УДАЛЕНИЕ СОТРУДНИКА
app.post('/employees/delete/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM employees WHERE id = ?', [req.params.id]);
        res.redirect('/employees');
    } catch (error) {
        console.error('Ошибка удаления сотрудника:', error);
        res.render('error', { 
            title: 'Ошибка',
            error: 'Не удалось удалить сотрудника: ' + error.message 
        });
    }
});

// 📊 ВЫГРУЗКА PDF ОТЧЕТА
app.get('/reports/repairs', ReportController.generateRepairsReport);

// Обработка ошибок
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Страница не найдена',
        error: 'Запрашиваемая страница не существует'
    });
});

app.use((err, req, res, next) => {
    console.error('Ошибка сервера:', err);
    res.status(500).render('error', {
        title: 'Ошибка сервера',
        error: 'Внутренняя ошибка сервера'
    });
});

// Запуск приложения
const startServer = async () => {
    try {
        await db.connect();
        console.log('✅ База данных подключена');
        
        app.listen(PORT, () => {
            console.log(`🚀 Система учета ремонта запущена на http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Ошибка запуска:', error);
    }
};

startServer();