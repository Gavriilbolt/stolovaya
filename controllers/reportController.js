const PDFDocument = require('pdfkit');
const db = require('../config/database');

class ReportController {
    static async generateOrdersReport(req, res) {
        try {
            const orders = await db.all(`
                SELECT o.*, mi.name AS menu_item_name, s.name AS staff_name
                FROM orders o
                LEFT JOIN menu_items mi ON o.menu_item_id = mi.id
                LEFT JOIN staff s ON o.staff_id = s.id
                ORDER BY o.order_date DESC, o.id DESC
            `);

            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=cafeteria-orders-report.pdf');
            doc.pipe(res);

            doc.fontSize(18).text('UNIVERSITY CAFETERIA REPORT', { align: 'center' });
            doc.moveDown(0.5);
            doc.fontSize(10).text(`Date: ${new Date().toLocaleDateString('ru-RU')}`, { align: 'center' });
            doc.moveDown(1.5);

            const revenue = orders.reduce((sum, order) => sum + (parseFloat(order.total_price) || 0), 0);
            const completedOrders = orders.filter((o) => o.status === 'completed').length;
            const newOrders = orders.filter((o) => o.status === 'new').length;

            doc.fontSize(13).text('SUMMARY');
            doc.moveDown(0.4);
            doc.fontSize(11)
                .text(`Total orders: ${orders.length}`)
                .text(`Completed: ${completedOrders}`)
                .text(`New/In progress: ${newOrders}`)
                .text(`Revenue: ${revenue.toFixed(2)} RUB`);

            doc.moveDown(1.5);
            doc.fontSize(13).text('ORDERS LIST');
            doc.moveDown(0.8);

            orders.forEach((order, index) => {
                if (doc.y > 680) {
                    doc.addPage();
                    doc.fontSize(13).text('ORDERS LIST (continued)');
                    doc.moveDown(0.8);
                }

                const statusMap = {
                    new: 'Новый',
                    preparing: 'Готовится',
                    completed: 'Выдан',
                    cancelled: 'Отменен'
                };

                doc.fontSize(11)
                    .text(`${index + 1}. ${order.menu_item_name || 'Блюдо удалено'}`)
                    .fontSize(9)
                    .text(`   Date: ${order.order_date}`)
                    .text(`   Customer: ${order.customer_type === 'student' ? 'Студент' : order.customer_type === 'teacher' ? 'Преподаватель' : 'Гость'}`)
                    .text(`   Quantity: ${order.quantity}`)
                    .text(`   Amount: ${(parseFloat(order.total_price) || 0).toFixed(2)} RUB`)
                    .text(`   Served by: ${order.staff_name || 'Не назначено'}`)
                    .text(`   Status: ${statusMap[order.status] || order.status}`);

                if (order.comment) {
                    doc.text(`   Note: ${order.comment}`);
                }

                doc.moveDown(0.2);
                doc.text('―'.repeat(52));
                doc.moveDown(0.5);
            });

            doc.moveDown(1);
            doc.fontSize(8)
                .text('― End of report ―', { align: 'center' })
                .text(`Generated records: ${orders.length}`, { align: 'center' });

            doc.end();
        } catch (error) {
            console.error('Error generating PDF report:', error);
            res.status(500).send('Error generating PDF report');
        }
    }
}

module.exports = ReportController;
