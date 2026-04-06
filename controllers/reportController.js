const PDFDocument = require("pdfkit");
const db = require("../config/database");
const { applyUnicodeFont } = require("../utils/pdf");

class ReportController {
  static async generateOrdersReport(req, res) {
    try {
      const orders = await db.all(`
                SELECT
                    o.*,
                    s.name AS staff_name,
                    COALESCE(SUM(oi.quantity), 0) AS total_quantity,
                    GROUP_CONCAT(COALESCE(mi.name, 'Блюдо удалено') || ' × ' || oi.quantity, ', ') AS items_summary
                FROM orders o
                LEFT JOIN order_items oi ON oi.order_id = o.id
                LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
                LEFT JOIN staff s ON o.staff_id = s.id
                GROUP BY o.id
                ORDER BY o.order_date DESC, o.id DESC
            `);

      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=orders-report.pdf",
      );

      doc.pipe(res);
      applyUnicodeFont(doc);

      const pageWidth =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

      const formatDate = (value) => {
        if (!value) return "—";
        const d = new Date(value);
        if (isNaN(d.getTime())) return String(value);
        return d.toLocaleDateString("ru-RU");
      };

      const formatMoney = (value) => {
        return `${(parseFloat(value) || 0).toFixed(2)} руб.`;
      };

      const customerTypeLabel = (type) => {
        if (type === "student") return "Студент";
        if (type === "teacher") return "Преподаватель";
        if (type === "guest") return "Гость";
        return "Не указано";
      };

      const statusLabel = (status) => {
        if (status === "new") return "Новый";
        if (status === "preparing") return "Готовится";
        if (status === "completed") return "Выдан";
        if (status === "cancelled") return "Отменён";
        return status || "—";
      };

      const drawSeparator = () => {
        const y = doc.y;
        doc
          .moveTo(doc.page.margins.left, y)
          .lineTo(doc.page.width - doc.page.margins.right, y)
          .stroke();
        doc.moveDown(0.6);
      };

      const estimateOrderHeight = (order) => {
        const itemsText =
          order.items_summary || "Нет данных о позициях заказа.";
        const commentText =
          order.comment && String(order.comment).trim()
            ? String(order.comment).trim()
            : "";

        const itemsHeight = doc.heightOfString(itemsText, {
          width: pageWidth,
        });

        const commentHeight = commentText
          ? doc.heightOfString(commentText, {
              width: pageWidth,
            })
          : 0;

        let height = 0;

        // Заголовок заказа
        height += 18;

        // Строки основных данных
        height += 6 * 14;

        // Заголовок "Состав заказа"
        height += 18;

        // Состав
        height += itemsHeight + 8;

        // Комментарий
        if (commentText) {
          height += 18;
          height += commentHeight + 8;
        }

        // Разделитель и отступ
        height += 20;

        return height;
      };

      doc.fontSize(16).text("Отчёт по заказам", { align: "center" });
      doc.moveDown(1);

      if (!orders.length) {
        doc.fontSize(11).text("Заказы отсутствуют.", { align: "left" });
        doc.end();
        return;
      }

      orders.forEach((order, index) => {
        const neededHeight = estimateOrderHeight(order);

        if (doc.y + neededHeight > bottomLimit()) {
          doc.addPage();
        }

        doc.fontSize(12).text(`Заказ №${order.id}`, { align: "left" });

        doc.moveDown(0.2);

        doc
          .fontSize(10)
          .text(`Дата заказа: ${formatDate(order.order_date)}`)
          .text(
            `Категория посетителя: ${customerTypeLabel(order.customer_type)}`,
          )
          .text(`Статус: ${statusLabel(order.status)}`)
          .text(`Количество позиций: ${order.total_quantity || 0}`)
          .text(`Сумма заказа: ${formatMoney(order.total_price)}`)
          .text(`Сотрудник на выдаче: ${order.staff_name || "Не назначен"}`);

        doc.moveDown(0.4);

        doc.fontSize(10).text("Состав заказа:");
        doc.moveDown(0.2);
        doc
          .fontSize(10)
          .text(order.items_summary || "Нет данных о позициях заказа.", {
            width: pageWidth,
            align: "left",
          });

        if (order.comment && String(order.comment).trim()) {
          doc.moveDown(0.4);
          doc.fontSize(10).text("Комментарий:");
          doc.moveDown(0.2);
          doc.fontSize(10).text(String(order.comment).trim(), {
            width: pageWidth,
            align: "left",
          });
        }

        doc.moveDown(0.6);

        if (index !== orders.length - 1) {
          drawSeparator();
        }
      });

      doc.end();
    } catch (error) {
      console.error("Ошибка при формировании PDF-отчёта:", error);

      if (!res.headersSent) {
        res.status(500).send("Ошибка при формировании PDF-отчёта");
      }
    }
  }
}

module.exports = ReportController;
