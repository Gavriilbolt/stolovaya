const express = require('express');
const router = express.Router();
const db = require('../config/database');

// 📊 Страница оборудования
router.get('/equipment', async (req, res) => {
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
        res.render('error', { error: 'Не удалось загрузить оборудование' });
    }
});

// ➕ Добавление нового оборудования
router.post('/equipment', async (req, res) => {
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
        res.render('error', { error: 'Не удалось добавить оборудование' });
    }
});

// 🔧 Страница ремонтов
router.get('/repairs', async (req, res) => {
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
        res.render('error', { error: 'Не удалось загрузить ремонты' });
    }
});

// ➕ Добавление нового ремонта
router.post('/repairs', async (req, res) => {
    try {
        const { equipment_id, employee_id, repair_date, problem_description, solution, repair_cost } = req.body;
        
        await db.run(
            `INSERT INTO repairs (equipment_id, employee_id, repair_date, problem_description, solution, repair_cost) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [equipment_id, employee_id, repair_date, problem_description, solution, repair_cost || 0]
        );
        
        // Обновляем статус оборудования на "в ремонте"
        await db.run('UPDATE equipment SET status = "repair" WHERE id = ?', [equipment_id]);
        
        res.redirect('/repairs');
    } catch (error) {
        console.error('Ошибка добавления ремонта:', error);
        res.render('error', { error: 'Не удалось добавить ремонт' });
    }
});

// 👥 Страница сотрудников
router.get('/employees', async (req, res) => {
    try {
        const employees = await db.all('SELECT * FROM employees ORDER BY name');
        res.render('employees', {
            title: 'Сотрудники',
            employees: employees
        });
    } catch (error) {
        console.error('Ошибка загрузки сотрудников:', error);
        res.render('error', { error: 'Не удалось загрузить сотрудников' });
    }
});

// ➕ Добавление нового сотрудника
router.post('/employees', async (req, res) => {
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
        res.render('error', { error: 'Не удалось добавить сотрудника' });
    }
});

module.exports = router;