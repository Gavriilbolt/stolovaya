const PDFDocument = require('pdfkit');
const db = require('../config/database');

class ReportController {
    
    // Отчет по ремонтам в PDF
    static async generateRepairsReport(req, res) {
        try {
            // Получаем данные о ремонтах из базы
            const repairs = await db.all(`
                SELECT r.*, e.name as equipment_name, e.inventory_number, emp.name as employee_name
                FROM repairs r
                LEFT JOIN equipment e ON r.equipment_id = e.id
                LEFT JOIN employees emp ON r.employee_id = emp.id
                ORDER BY r.repair_date DESC
            `);

            // Создаем PDF документ
            const doc = new PDFDocument();
            
            // Настраиваем заголовки для скачивания файла
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=repairs-report.pdf');
            
            // Подключаем PDF к ответу
            doc.pipe(res);

            // Заголовок отчета (английскими буквами)
            doc.fontSize(18)
               .text('REPAIRS REPORT', { align: 'center' });
            
            doc.moveDown(0.5);
            doc.fontSize(10)
               .text(`Date: ${new Date().toLocaleDateString('ru-RU')}`, { align: 'center' });
            doc.moveDown(2);

            // Статистика
            const totalCost = repairs.reduce((sum, repair) => sum + (parseFloat(repair.repair_cost) || 0), 0);
            const completedRepairs = repairs.filter(r => r.status === 'completed').length;
            const inProgressRepairs = repairs.filter(r => r.status === 'in_progress').length;

            doc.fontSize(14)
               .text('STATISTICS:');
            
            doc.fontSize(12)
               .text(`Total repairs: ${repairs.length}`)
               .text(`Completed: ${completedRepairs}`)
               .text(`In progress: ${inProgressRepairs}`)
               .text(`Total cost: ${totalCost.toFixed(2)} RUB`);
            
            doc.moveDown(2);

            // Список ремонтов
            doc.fontSize(14)
               .text('REPAIRS LIST:');
            doc.moveDown(1);

            // Добавляем каждый ремонт в отчет
            repairs.forEach((repair, index) => {
                // Если мало места на странице - создаем новую
                if (doc.y > 650) {
                    doc.addPage();
                    doc.fontSize(14)
                       .text('REPAIRS LIST (continued):');
                    doc.moveDown(1);
                }

                // Информация о ремонте
                doc.fontSize(12)
                   .text(`${index + 1}. ${repair.equipment_name}`)
                   .fontSize(10)
                   .text(`   Inventory: ${repair.inventory_number}`)
                   .text(`   Date: ${repair.repair_date}`)
                   .text(`   Technician: ${repair.employee_name}`)
                   .text(`   Problem: ${repair.problem_description}`);

                // Решение (если есть)
                if (repair.solution && repair.solution.trim() !== '') {
                    doc.text(`   Solution: ${repair.solution}`);
                }

                // Стоимость (если есть)
                if (repair.repair_cost > 0) {
                    doc.text(`   Cost: ${repair.repair_cost} RUB`);
                }

                // Статус
                const statusText = repair.status === 'completed' ? 'COMPLETED' : 
                                 repair.status === 'in_progress' ? 'IN PROGRESS' : 'CANCELLED';
                doc.text(`   Status: ${statusText}`);
                
                // Разделительная линия между ремонтами
                doc.moveDown(0.3);
                doc.text('―'.repeat(50));
                doc.moveDown(0.5);
            });

            // Футер
            if (doc.y > 700) {
                doc.addPage();
            }
            
            doc.moveDown(2);
            doc.fontSize(8)
               .text('― End of report ―', { align: 'center' })
               .text(`Total records: ${repairs.length}`, { align: 'center' });

            // Завершаем создание PDF
            doc.end();

        } catch (error) {
            console.error('Error generating PDF report:', error);
            res.status(500).send('Error generating PDF report');
        }
    }
}

module.exports = ReportController;