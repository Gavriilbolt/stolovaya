const PDFDocument = require('pdfkit');
const db = require('../config/database');
const { applyUnicodeFont } = require('../utils/pdf');

function formatTimestampForFilename(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate()),
        '-',
        pad(date.getHours()),
        pad(date.getMinutes()),
        pad(date.getSeconds())
    ].join('');
}

class ReceiptController {
    static async downloadReceipt(req, res) {
        try {
            const orderId = Number(req.params.id);
            if (!Number.isFinite(orderId) || orderId <= 0) {
                return res.status(400).render('error', { title: 'Ошибка', error: 'Некорректный ID заказа' });
            }

            const order = await db.get(
                `
                SELECT o.*, s.name AS staff_name
                FROM orders o
                LEFT JOIN staff s ON o.staff_id = s.id
                WHERE o.id = ?
                `,
                [orderId]
            );

            if (!order) {
                return res.status(404).render('error', { title: 'Не найдено', error: 'Заказ не найден' });
            }

            const items = await db.all(
                `
                SELECT
                    oi.*,
                    mi.name AS menu_item_name
                FROM order_items oi
                LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                WHERE oi.order_id = ?
                ORDER BY oi.id ASC
                `,
                [orderId]
            );

            return ReceiptController.streamReceiptPdf(res, { order, items });
        } catch (error) {
            console.error('Error generating receipt PDF:', error);
            res.status(500).send('Error generating receipt PDF');
        }
    }

    static streamReceiptPdf(res, { order, items }) {
        const now = new Date();
        const timestamp = formatTimestampForFilename(now);
        const filename = `cafeteria-receipt-${timestamp}-order-${order.id}.pdf`;

        const doc = new PDFDocument({ margin: 40 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        doc.pipe(res);

        applyUnicodeFont(doc);

        doc.fontSize(18).text('Чек столовой', { align: 'center' });
        doc.moveDown(0.6);
        doc.fontSize(10)
            .text(`Заказ №${order.id}`, { align: 'center' })
            .text(`Дата: ${new Date(order.order_date).toLocaleDateString('ru-RU')}`, { align: 'center' })
            .text(`Время: ${now.toLocaleTimeString('ru-RU')}`, { align: 'center' });
        doc.moveDown(1);

        const customerLabel =
            order.customer_type === 'student'
                ? 'Студент'
                : order.customer_type === 'teacher'
                    ? 'Преподаватель'
                    : 'Гость';

        doc.fontSize(11)
            .text(`Клиент: ${customerLabel}`)
            .text(`Сотрудник: ${order.staff_name || 'Не назначено'}`)
            .text(`Статус: ${ReceiptController.statusLabel(order.status)}`);

        if (order.comment) {
            doc.text(`Комментарий: ${order.comment}`);
        }

        doc.moveDown(1);
        doc.fontSize(12).text('Позиции', { underline: true });
        doc.moveDown(0.5);

        items.forEach((item, index) => {
            const name = item.menu_item_name || 'Блюдо удалено';
            doc.fontSize(10).text(
                `${index + 1}. ${name} — ${item.quantity} × ${Number(item.unit_price || 0).toFixed(2)} = ${Number(item.line_total || 0).toFixed(2)} руб.`
            );
        });

        doc.moveDown(0.8);
        doc.text('―'.repeat(60));
        doc.moveDown(0.4);
        doc.fontSize(12).text(`Итого: ${Number(order.total_price || 0).toFixed(2)} руб.`, { align: 'right' });

        doc.moveDown(1);
        doc.fontSize(9).text('Спасибо за покупку!', { align: 'center' });
        doc.end();
    }

    static statusLabel(status) {
        const map = {
            new: 'Новый',
            preparing: 'Готовится',
            completed: 'Выдан',
            cancelled: 'Отменен'
        };
        return map[status] || status || '—';
    }
}

module.exports = ReceiptController;

