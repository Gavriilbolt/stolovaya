// Client-side enhancements for cafeteria forms

document.addEventListener('DOMContentLoaded', () => {
    function parseFilenameFromContentDisposition(header) {
        if (!header) {
            return null;
        }

        const match = /filename=([^;]+)/i.exec(header);
        if (!match) {
            return null;
        }

        return String(match[1]).trim().replace(/^"|"$/g, '');
    }

    function downloadBlob(blob, filename) {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'download.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    }

    function renumberOrderItemRows(container) {
        const rows = Array.from(container.querySelectorAll('.order-item-row'));
        rows.forEach((row, idx) => {
            const select = row.querySelector('select');
            const qty = row.querySelector('input[type="number"]');
            if (select) {
                select.name = `items[${idx}][menu_item_id]`;
            }
            if (qty) {
                qty.name = `items[${idx}][quantity]`;
            }
        });
    }

    function setupOrderItemsUI() {
        const container = document.getElementById('orderItemsContainer');
        const addBtn = document.getElementById('addOrderItemBtn');
        if (!container || !addBtn) {
            return;
        }

        const addRow = () => {
            const firstRow = container.querySelector('.order-item-row');
            if (!firstRow) {
                return;
            }

            const clone = firstRow.cloneNode(true);
            const select = clone.querySelector('select');
            const qty = clone.querySelector('input[type="number"]');
            if (select) {
                select.value = '';
            }
            if (qty) {
                qty.value = '1';
            }

            container.appendChild(clone);
            renumberOrderItemRows(container);
        };

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('.order-item-remove');
            if (!btn) {
                return;
            }

            const rows = container.querySelectorAll('.order-item-row');
            if (rows.length <= 1) {
                return;
            }

            btn.closest('.order-item-row')?.remove();
            renumberOrderItemRows(container);
        });

        addBtn.addEventListener('click', addRow);
        renumberOrderItemRows(container);
    }

    async function submitOrderWithReceiptDownload(form) {
        const formData = new FormData(form);
        const body = new URLSearchParams(formData);

        const response = await fetch(form.action, {
            method: 'POST',
            headers: { Accept: 'application/pdf' },
            body
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || 'Не удалось создать заказ');
        }

        const blob = await response.blob();
        const cd = response.headers.get('Content-Disposition');
        const filename = parseFilenameFromContentDisposition(cd) || 'cafeteria-receipt.pdf';
        downloadBlob(blob, filename);

        window.location.href = '/orders';
    }

    function setupReceiptDownloadForm() {
        const form = document.querySelector('form[data-download-receipt="1"]');
        if (!form) {
            return;
        }

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }
            try {
                await submitOrderWithReceiptDownload(form);
            } catch (error) {
                alert(error.message || 'Ошибка создания заказа');
            }
        });
    }

    function setupBasicValidation() {
        const forms = document.querySelectorAll('form');
        forms.forEach((form) => {
            form.addEventListener('submit', (e) => {
                const requiredInputs = form.querySelectorAll('[required]');
                let isValid = true;

                requiredInputs.forEach((input) => {
                    if (!String(input.value || '').trim()) {
                        isValid = false;
                        input.style.borderColor = '#e74c3c';
                    } else {
                        input.style.borderColor = '#ddd';
                    }
                });

                const qtyInputs = form.querySelectorAll('input[type="number"][name*="[quantity]"], input[name="quantity"]');
                qtyInputs.forEach((input) => {
                    if (Number(input.value) < 1) {
                        isValid = false;
                        input.style.borderColor = '#e74c3c';
                    }
                });

                if (!isValid) {
                    e.preventDefault();
                    alert('Проверьте обязательные поля формы');
                }
            });
        });
    }

    setupOrderItemsUI();
    setupReceiptDownloadForm();
    setupBasicValidation();
});
