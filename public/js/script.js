// Client-side enhancements for cafeteria forms

document.addEventListener('DOMContentLoaded', () => {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach((alert) => {
        setTimeout(() => {
            alert.style.opacity = '0';
            alert.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                alert.style.display = 'none';
            }, 500);
        }, 5000);
    });

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

            const quantityInput = form.querySelector('input[name="quantity"]');
            if (quantityInput && Number(quantityInput.value) < 1) {
                isValid = false;
                quantityInput.style.borderColor = '#e74c3c';
            }

            if (!isValid) {
                e.preventDefault();
                alert('Проверьте обязательные поля формы');
            }
        });
    });
});
